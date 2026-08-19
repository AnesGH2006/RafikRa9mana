import { Router, type Request, type Response } from "express";
import { generateActivationBatch, redeemActivationCode } from "../services/activationCodeService.js";
import { createChargilyCheckout, settleChargilyPayment, verifyChargilySignature } from "../services/paymentService.js";

const router = Router();

function requireAuth(req: Request, res: Response): boolean {
  if (!req.isAuthenticated() || !req.user) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
}

function requireAdmin(req: Request, res: Response): boolean {
  if (!requireAuth(req, res)) return false;
  if (req.user!.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return false; }
  return true;
}

router.post("/payments/activation-codes/batches", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const count = Number(req.body?.count);
  const expiresAt = req.body?.expiresAt ? new Date(String(req.body.expiresAt)) : undefined;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) { res.status(400).json({ error: "Invalid expiresAt" }); return; }
  try {
    res.status(201).json(await generateActivationBatch(count, expiresAt));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to generate codes" });
  }
});

router.post("/payments/redeem-code", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  try {
    res.json(await redeemActivationCode(String(req.body?.code ?? ""), req.user!.id));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to redeem code" });
  }
});

router.post("/payments/chargily/checkout", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const returnUrl = typeof req.body?.returnUrl === "string" ? req.body.returnUrl : `${req.protocol}://${req.get("host")}/account`;
  try {
    const payment = await createChargilyCheckout(req.user!.id, returnUrl);
    res.status(201).json({ id: payment!.id, checkoutUrl: payment!.checkoutUrl, amountDzd: payment!.amountDzd });
  } catch (error) {
    req.log.error({ error }, "Chargily checkout creation failed");
    res.status(503).json({ error: error instanceof Error ? error.message : "Payment provider unavailable" });
  }
});

router.post("/payments/chargily/webhook", async (req, res): Promise<void> => {
  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);
  const signature = req.header("x-chargily-signature") ?? req.header("signature");
  if (!verifyChargilySignature(rawBody, signature)) { res.status(401).json({ error: "Invalid signature" }); return; }
  const payload = req.body as { id?: string; reference?: string; status?: string; metadata?: { paymentId?: string; userId?: string } };
  const reference = payload.reference ?? payload.id;
  if (!reference || !payload.status) { res.status(400).json({ error: "Invalid webhook payload" }); return; }
  const result = await settleChargilyPayment({ reference, userId: payload.metadata?.userId, status: payload.status });
  res.json({ received: true, ...result });
});

export default router;
