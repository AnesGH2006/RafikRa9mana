import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, paymentsTable, usersTable } from "../../shared/db.js";
import { PAID_PLAN_PRICES_DZD } from "../../shared/subscription.js";

const DEFAULT_AMOUNT_DZD = 1000;

// إضافة جميع المبالغ المتاحة في بطاقات الواجهة
const ALLOWED_AMOUNTS_DZD = new Set([
  1000, // ولي الأمر
  2000, // الأستاذ / المستشار Pro
  8000, // المؤسسة (School Admin)
  3000,
  7000,
  DEFAULT_AMOUNT_DZD,
  ...Object.values(PAID_PLAN_PRICES_DZD),
]);

function requireAllowedAmount(amountDzd: number): number {
  if (!Number.isInteger(amountDzd) || !ALLOWED_AMOUNTS_DZD.has(amountDzd)) {
    throw new Error("Unsupported payment amount");
  }
  return amountDzd;
}

function paidPlanForAmount(amountDzd: number): string | null {
  if (amountDzd === 1000) return "parent_premium";
  if (amountDzd === 2000) return "teacher_pro";
  if (amountDzd === 8000) return "school_full";
  if (amountDzd === 3000 || amountDzd === PAID_PLAN_PRICES_DZD.basic) return "basic";
  if (amountDzd === 7000 || amountDzd === PAID_PLAN_PRICES_DZD.pro) return "pro";
  return null;
}

export function verifyChargilySignature(rawBody: string, signature: string | undefined): boolean {
  const secret = process.env.CHARGILY_WEBHOOK_SECRET ?? process.env.CHARGILY_API_KEY;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(signature, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function activateFreePlan(userId: string): Promise<void> {
  const [user] = await db.select({
    subscriptionStatus: usersTable.subscriptionStatus,
    subscriptionPlan: usersTable.subscriptionPlan,
  }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  if (!user) throw new Error("User not found");
  if (user.subscriptionStatus === "active" && user.subscriptionPlan !== "free") {
    throw new Error("An active paid plan cannot be downgraded to free");
  }
  if (user.subscriptionStatus === "active" && user.subscriptionPlan === "free") return;
  if (user.subscriptionStatus !== "pending") {
    throw new Error("This account cannot activate the free plan");
  }

  await db.update(usersTable).set({
    subscriptionStatus: "active",
    subscriptionPlan: "free",
    subscriptionExpiresAt: null,
    updatedAt: new Date(),
  }).where(eq(usersTable.id, userId));
}

export async function createChargilyCheckout(userId: string, returnUrl: string, requestedAmountDzd = DEFAULT_AMOUNT_DZD) {
  const amountDzd = requireAllowedAmount(requestedAmountDzd);
  const apiKey = process.env.CHARGILY_API_KEY;
  const endpoint = process.env.CHARGILY_API_URL
    ?? (process.env.CHARGILY_MODE === "test"
      ? "