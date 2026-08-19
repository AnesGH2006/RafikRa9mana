/**
 * POST /api/notifications/send-sms
 *
 * Body: { phoneNumbers: string[], message: string }
 *
 * Validates Arabic message length (70 chars per segment) and dispatches
 * through Twilio or the school's configured gateway.
 */
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, pushSubscriptionsTable, schoolMembersTable } from "../../shared/db.js";
import { sendBulkSms, countSegments, ARABIC_SEGMENT_BYTES } from "../services/smsService.js";
import { sendPushToUser } from "../services/pushNotificationService.js";

const router = Router();

function isParent(req: any): boolean {
  return req.isAuthenticated() && req.memberContext?.role === "parent";
}

router.post("/notifications/push-subscription", async (req, res): Promise<void> => {
  if (!isParent(req)) { res.status(403).json({ error: "Parents only" }); return; }

  const subscription = req.body?.subscription as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  } | undefined;
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    res.status(400).json({ error: "Invalid push subscription" });
    return;
  }

  await db.insert(pushSubscriptionsTable).values({
    userId: req.user!.id,
    endpoint,
    p256dh,
    auth,
  }).onConflictDoUpdate({
    target: pushSubscriptionsTable.endpoint,
    set: { userId: req.user!.id, p256dh, auth, updatedAt: new Date() },
  });
  res.status(201).json({ enabled: true });
});

router.delete("/notifications/push-subscription", async (req, res): Promise<void> => {
  if (!isParent(req)) { res.status(403).json({ error: "Parents only" }); return; }
  const endpoint = req.body?.endpoint;
  if (typeof endpoint !== "string") { res.status(400).json({ error: "endpoint is required" }); return; }
  await db.delete(pushSubscriptionsTable).where(and(
    eq(pushSubscriptionsTable.userId, req.user!.id),
    eq(pushSubscriptionsTable.endpoint, endpoint),
  ));
  res.json({ enabled: false });
});

router.post("/notifications/push", async (req, res): Promise<void> => {
  if (!req.isAuthenticated() || req.memberContext) { res.status(403).json({ error: "School administrators only" }); return; }
  const { memberUserId, title, body, url, type } = req.body as Record<string, unknown>;
  if (typeof memberUserId !== "string" || typeof title !== "string" || typeof body !== "string") {
    res.status(400).json({ error: "memberUserId, title, and body are required" }); return;
  }
  const [parent] = await db.select({ memberUserId: schoolMembersTable.memberUserId })
    .from(schoolMembersTable)
    .where(and(
      eq(schoolMembersTable.schoolUserId, req.user!.id),
      eq(schoolMembersTable.memberUserId, memberUserId),
      eq(schoolMembersTable.role, "parent"),
    )).limit(1);
  if (!parent?.memberUserId) { res.status(404).json({ error: "Parent not found" }); return; }
  const sent = await sendPushToUser(memberUserId, { title, body, url: typeof url === "string" ? url : "/my-child", type: typeof type === "string" ? type : "general" });
  res.json({ success: true, sent });
});

router.post("/notifications/send-sms", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user!.id;
  const { phoneNumbers, message } = req.body as {
    phoneNumbers?: unknown;
    message?: unknown;
  };

  // ── Validate inputs ───────────────────────────────────────────────────────
  if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
    res.status(400).json({ error: "phoneNumbers must be a non-empty array" });
    return;
  }

  if (phoneNumbers.length > 500) {
    res.status(400).json({ error: "الحد الأقصى لعدد المستلمين في الدفعة الواحدة هو 500" });
    return;
  }

  if (typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "message is required and must be a non-empty string" });
    return;
  }

  const trimmedMessage = message.trim();
  const segments = countSegments(trimmedMessage);

  if (segments > 4) {
    res.status(400).json({
      error: `الرسالة طويلة جدًا (${trimmedMessage.length} حرف = ${segments} وحدات). الحد الأقصى هو 4 وحدات SMS (حوالي ${4 * 67} حرفًا).`,
      charCount: trimmedMessage.length,
      segments,
    });
    return;
  }

  // ── Sanitise phone numbers ────────────────────────────────────────────────
  const validPhones = phoneNumbers.filter((p): p is string => {
    if (typeof p !== "string") return false;
    const cleaned = p.replace(/\s+/g, "");
    return /^[+0-9]{7,20}$/.test(cleaned);
  });

  if (validPhones.length === 0) {
    res.status(400).json({ error: "لا توجد أرقام هاتف صالحة في القائمة" });
    return;
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────
  try {
    const result = await sendBulkSms({ phoneNumbers: validPhones, message: trimmedMessage, userId });
    res.json({
      success: result.success,
      channel: result.channel,
      sent:    result.sent,
      failed:  result.failed,
      total:   result.total,
      segments,
      charCount: trimmedMessage.length,
      results: result.results,
    });
  } catch (err: any) {
    req.log?.error?.({ err }, "send-sms failed");
    res.status(500).json({ error: err?.message ?? "فشل إرسال الرسائل" });
  }
});

export default router;
