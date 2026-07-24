/**
 * send_sms_alert_tool
 * ───────────────────
 * Sends an official SMS to a student's parent/guardian.
 *
 * Dispatch priority:
 *   1. HTTP SMS Gateway   — if SMS_GATEWAY_URL is set (any REST gateway: Twilio, Vonage, local server…)
 *   2. Socket modem event — emits `sms:send` to the connected Desktop Agent which
 *                           controls a local USB GSM modem / Android SMS app.
 *   3. Queued log only    — if neither is available, logs the message as "queued"
 *                           so it can be retried later.
 *
 * In all cases the dispatch is recorded in smsLogsTable.
 */

import { db, studentsTable, smsLogsTable } from "../../../shared/db.js";
import { eq, and } from "drizzle-orm";
import { sendDesktopCommand } from "../../socket/agentHandler.js";
import { logger } from "../logger.js";

export interface SendSmsAlertInput {
  /** The student's DB id — used to look up parentPhone */
  student_id: string;
  /** The text message to send (Arabic ok) */
  message: string;
  /** Override the stored phone number (optional) */
  custom_phone?: string;
  /** Sender label shown on the SMS (supported by some gateways) */
  sender_id?: string;
}

// ── Gateway helper ─────────────────────────────────────────────────────────────
async function sendViaGateway(
  to: string,
  message: string,
  senderId: string,
): Promise<{ ok: boolean; ref?: string; error?: string }> {
  const url = process.env.SMS_GATEWAY_URL!;
  const apiKey = process.env.SMS_GATEWAY_API_KEY ?? "";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ to, message, sender: senderId, from: senderId }),
      signal: AbortSignal.timeout(15_000),
    });

    const body = await res.json().catch(() => ({})) as Record<string, unknown>;

    if (!res.ok) {
      return { ok: false, error: `Gateway ${res.status}: ${JSON.stringify(body)}` };
    }

    // Common gateway response fields
    const ref = String(
      body.messageId ?? body.message_id ?? body.id ?? body.sid ?? body.msgid ?? ""
    );
    return { ok: true, ref: ref || undefined };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// ── Agent modem helper ─────────────────────────────────────────────────────────
async function sendViaModem(
  userId: string,
  to: string,
  message: string,
): Promise<{ ok: boolean; ref?: string; error?: string }> {
  try {
    const result = await sendDesktopCommand(
      userId,
      "send_sms",
      { to, message },
      30_000,
    ) as Record<string, unknown>;

    return {
      ok: result?.status === "sent" || result?.ok === true,
      ref: result?.ref ? String(result.ref) : undefined,
      error: result?.error ? String(result.error) : undefined,
    };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function sendSmsAlertTool(
  input: SendSmsAlertInput,
  userId: string,
): Promise<unknown> {
  // ── 1. Resolve parent phone number ─────────────────────────────────────────
  let phone = input.custom_phone?.trim() ?? null;
  let studentName = "—";

  if (!phone || input.student_id) {
    const rows = await db
      .select({ parentPhone: studentsTable.parentPhone, nomPrenom: studentsTable.nomPrenom })
      .from(studentsTable)
      .where(and(eq(studentsTable.id, input.student_id), eq(studentsTable.userId, userId)))
      .limit(1);

    if (rows.length === 0) {
      return { success: false, message: `❌ لم يُعثر على تلميذ بالمعرّف "${input.student_id}"` };
    }

    studentName = rows[0]!.nomPrenom;
    if (!phone) phone = rows[0]!.parentPhone ?? null;
  }

  const senderId = input.sender_id ?? "SchoolMgr";

  // ── 2. No phone on record ──────────────────────────────────────────────────
  if (!phone) {
    await db.insert(smsLogsTable).values({
      userId,
      studentId: input.student_id,
      phone: null,
      message: input.message,
      status: "no_phone",
    });

    return {
      success: false,
      student: studentName,
      message: `⚠️ لا يوجد رقم هاتف مسجّل لولي أمر "${studentName}". استخدم fetch_parent_contacts_tool لاسترداد الأرقام المفقودة.`,
    };
  }

  // ── 3. Dispatch ────────────────────────────────────────────────────────────
  const hasGateway = !!process.env.SMS_GATEWAY_URL;
  let channel: "gateway" | "modem" | "socket" = "socket";
  let dispatchResult: { ok: boolean; ref?: string; error?: string };

  if (hasGateway) {
    channel = "gateway";
    dispatchResult = await sendViaGateway(phone, input.message, senderId);
  } else {
    // Try the desktop agent modem
    channel = "modem";
    dispatchResult = await sendViaModem(userId, phone, input.message);
  }

  // ── 4. Log result ──────────────────────────────────────────────────────────
  const status = dispatchResult.ok ? "sent" : "failed";

  try {
    await db.insert(smsLogsTable).values({
      userId,
      studentId: input.student_id,
      phone,
      message: input.message,
      status,
      channel,
      gatewayRef: dispatchResult.ref ?? null,
      errorMsg: dispatchResult.error ?? null,
    });
  } catch (logErr: any) {
    logger.warn({ logErr }, "SMS log insert failed");
  }

  logger.info({ userId, phone, student: studentName, channel, status }, "send_sms_alert");

  if (dispatchResult.ok) {
    return {
      success: true,
      channel,
      student: studentName,
      phone,
      ref: dispatchResult.ref,
      message: `✅ تم إرسال رسالة SMS إلى ولي أمر "${studentName}" على الرقم ${phone} عبر ${channel === "gateway" ? "بوابة SMS" : "المودم المحلي"}.`,
    };
  }

  // Dispatch failed — log as queued for retry
  return {
    success: false,
    channel,
    student: studentName,
    phone,
    error: dispatchResult.error,
    message: hasGateway
      ? `❌ فشل إرسال SMS عبر البوابة: ${dispatchResult.error}. تحقق من إعداد SMS_GATEWAY_URL و SMS_GATEWAY_API_KEY.`
      : `❌ فشل إرسال SMS عبر المودم المحلي: ${dispatchResult.error}. تحقق من اتصال وكيل سطح المكتب.`,
  };
}
