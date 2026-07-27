/**
 * POST /api/notifications/send-sms
 *
 * Body: { phoneNumbers: string[], message: string }
 *
 * Validates Arabic message length (70 chars per segment) and dispatches
 * through Twilio or the school's configured gateway.
 */
import { Router } from "express";
import { sendBulkSms, countSegments, ARABIC_SEGMENT_BYTES } from "../services/smsService.js";

const router = Router();

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
