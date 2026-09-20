import { Router, type Request } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "../../shared/db.js";
import { encryptGroqKey, encryptGeminiKey } from "../lib/groq-key.js";

const router = Router();
const canUseAssistant = (req: Request) => !req.memberContext && (req.user?.role === "admin" || req.user?.subscriptionStatus === "active");

router.get("/assistant/settings", async (req, res) => {
  if (!req.isAuthenticated() || !req.user) { res.status(401).json({ error: "غير مصرح" }); return; }
  if (!canUseAssistant(req)) { res.status(403).json({ error: "هذه الميزة متاحة للمشتركين فقط" }); return; }
  const [user] = await db
    .select({ groqApiKey: usersTable.groqApiKey, geminiApiKey: usersTable.geminiApiKey })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id));
  res.json({
    hasGroqApiKey: Boolean(user?.groqApiKey),
    hasGeminiApiKey: Boolean(user?.geminiApiKey),
  });
});

router.put("/assistant/settings", async (req, res) => {
  if (!req.isAuthenticated() || !req.user) { res.status(401).json({ error: "غير مصرح" }); return; }
  if (!canUseAssistant(req)) { res.status(403).json({ error: "هذه الميزة متاحة للمشتركين فقط" }); return; }

  const body = req.body as { groqApiKey?: unknown; geminiApiKey?: unknown };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const response: Record<string, boolean> = {};

  // Only touch groqApiKey if the request actually included that field
  if (typeof body?.groqApiKey === "string") {
    const key = body.groqApiKey.trim();
    if (key && !/^gsk_[A-Za-z0-9_-]{20,}$/.test(key)) {
      res.status(400).json({ error: "مفتاح Groq غير صالح" });
      return;
    }
    updates.groqApiKey = key ? encryptGroqKey(key) : null;
    response.hasGroqApiKey = Boolean(key);
  }

  // Only touch geminiApiKey if the request actually included that field
  if (typeof body?.geminiApiKey === "string") {
    const key = body.geminiApiKey.trim();
    if (key && key.length < 20) {
      res.status(400).json({ error: "مفتاح Gemini غير صالح" });
      return;
    }
    updates.geminiApiKey = key ? encryptGeminiKey(key) : null;
    response.hasGeminiApiKey = Boolean(key);
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, req.user.id));
  res.json(response);
});

export default router;