import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, paymentsTable, usersTable } from "../../shared/db.js";

const AMOUNT_DZD = 1000;

export function verifyChargilySignature(rawBody: string, signature: string | undefined): boolean {
  const secret = process.env.CHARGILY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(signature, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function createChargilyCheckout(userId: string, returnUrl: string) {
  const apiKey = process.env.CHARGILY_API_KEY;
  const endpoint = process.env.CHARGILY_API_URL ?? "https://pay.chargily.com/test/api/v2/checkouts";
  if (!apiKey) throw new Error("CHARGILY_API_KEY is not configured");

  const [payment] = await db.insert(paymentsTable).values({
    userId,
    provider: "chargily",
    amountDzd: AMOUNT_DZD,
    status: "pending",
    metadata: { returnUrl },
  }).returning();
  if (!payment) throw new Error("Unable to create payment record");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ amount: AMOUNT_DZD, currency: "dzd", success_url: returnUrl, failure_url: returnUrl, metadata: { paymentId: payment.id, userId } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    await db.update(paymentsTable).set({ status: "failed", updatedAt: new Date() }).where(eq(paymentsTable.id, payment.id));
    throw new Error(`Chargily checkout failed with HTTP ${response.status}`);
  }

  const payload = await response.json() as { id?: string; checkout_url?: string; url?: string };
  const checkoutUrl = payload.checkout_url ?? payload.url;
  if (!payload.id || !checkoutUrl) throw new Error("Chargily returned an incomplete checkout response");

  const [updated] = await db.update(paymentsTable).set({ providerReference: payload.id, checkoutUrl, updatedAt: new Date() }).where(eq(paymentsTable.id, payment.id)).returning();
  return updated;
}

export async function settleChargilyPayment(input: { reference: string; userId?: string; status: string }) {
  if (!['paid', 'success', 'completed'].includes(input.status.toLowerCase())) return { settled: false };
  const [payment] = await db.select().from(paymentsTable).where(and(eq(paymentsTable.provider, "chargily"), eq(paymentsTable.providerReference, input.reference))).limit(1);
  if (!payment) return { settled: false };
  if (payment.status === "paid") return { settled: true, idempotent: true };

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(paymentsTable).set({ status: "paid", paidAt: now, updatedAt: now }).where(eq(paymentsTable.id, payment.id));
    await tx.update(usersTable).set({ subscriptionStatus: "active", subscriptionExpiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), updatedAt: now }).where(eq(usersTable.id, payment.userId));
  });
  return { settled: true, idempotent: false };
}
