/**
 * Student QR Generator
 * --------------------
 * Generates a signed QR code payload for a student, suitable for:
 *   • Fast attendance scanning at the gate
 *   • Printing on school ID cards
 *
 * Payload structure (JSON, HMAC-SHA256 signed):
 *   { sid, name, niveau, classe, annee, iat, sig }
 *
 * The signature uses SESSION_SECRET so QR codes cannot be forged externally.
 * The route returns either a PNG image (base64 data URL) or raw SVG.
 *
 * GET /api/qr/student/:studentId?format=png|svg|json
 */

import type { Request, Response } from "express";
import { createHmac } from "crypto";
import QRCode from "qrcode";
import { eq, and } from "drizzle-orm";
import { db, studentsTable } from "../../shared/db.js";
import { logger } from "../lib/logger.js";

// ── Signature helper ──────────────────────────────────────────────────────────

const SECRET = process.env.SESSION_SECRET ?? "school-qr-fallback-secret";

interface QrPayload {
  sid: string;
  name: string;
  niveau: string;
  classe: string;
  annee: string;
  iat: number;
  sig: string;
}

function signPayload(raw: Omit<QrPayload, "sig">): string {
  const data = JSON.stringify(raw, Object.keys(raw).sort());
  return createHmac("sha256", SECRET).update(data).digest("hex").slice(0, 16);
}

export function buildQrPayload(student: {
  id: string;
  nomPrenom: string;
  niveau: string;
  classe: string;
  annee: string;
}): QrPayload {
  const raw: Omit<QrPayload, "sig"> = {
    sid:    student.id,
    name:   student.nomPrenom,
    niveau: student.niveau,
    classe: student.classe,
    annee:  student.annee,
    iat:    Math.floor(Date.now() / 1000),
  };
  return { ...raw, sig: signPayload(raw) };
}

// ── Controller ────────────────────────────────────────────────────────────────

/**
 * GET /api/qr/student/:studentId
 *
 * Query params:
 *   format  — "png" (default) | "svg" | "json"
 *   size    — pixel width for PNG (64–1024, default 256)
 */
export async function generateStudentQr(req: Request, res: Response): Promise<void> {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user!.id;
  const { studentId } = req.params as { studentId: string };
  const format = String(req.query.format ?? "png").toLowerCase() as "png" | "svg" | "json";
  const size   = Math.min(Math.max(parseInt(String(req.query.size ?? "256")), 64), 1024);

  if (!studentId) {
    res.status(400).json({ error: "studentId is required" });
    return;
  }

  // ── Fetch student (scoped to the authenticated user) ─────────────────────
  const [student] = await db
    .select({
      id:        studentsTable.id,
      nomPrenom: studentsTable.nomPrenom,
      niveau:    studentsTable.niveau,
      classe:    studentsTable.classe,
      annee:     studentsTable.annee,
    })
    .from(studentsTable)
    .where(and(eq(studentsTable.id, studentId), eq(studentsTable.userId, userId)))
    .limit(1);

  if (!student) {
    res.status(404).json({ error: "التلميذ غير موجود أو لا تملك صلاحية الوصول إليه" });
    return;
  }

  const payload = buildQrPayload(student);
  const payloadStr = JSON.stringify(payload);

  try {
    if (format === "json") {
      res.json({ studentId: student.id, student: student.nomPrenom, payload });
      return;
    }

    if (format === "svg") {
      const svg = await QRCode.toString(payloadStr, {
        type: "svg",
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="qr-${student.id}.svg"`,
      );
      res.send(svg);
      return;
    }

    // Default: PNG as base64 data URL or raw buffer
    const wantBuffer = req.query.raw === "1";
    if (wantBuffer) {
      const buf = await QRCode.toBuffer(payloadStr, {
        type: "png",
        width: size,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      res.setHeader("Content-Type", "image/png");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="qr-${student.id}.png"`,
      );
      res.send(buf);
    } else {
      const dataUrl = await QRCode.toDataURL(payloadStr, {
        type: "image/png",
        width: size,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      res.json({
        studentId:  student.id,
        student:    student.nomPrenom,
        niveau:     student.niveau,
        classe:     student.classe,
        annee:      student.annee,
        format:     "png",
        width:      size,
        dataUrl,
        payload,
      });
    }
  } catch (err: any) {
    logger.error({ err, studentId }, "QR generation failed");
    res.status(500).json({ error: "فشل إنشاء رمز QR" });
  }
}

/**
 * POST /api/qr/students/batch
 *
 * Body: { studentIds: string[], format?: "json" | "png" | "svg", size?: number }
 * Returns an array of QR payloads (JSON mode) or a 400 for image batch requests.
 */
export async function batchStudentQr(req: Request, res: Response): Promise<void> {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user!.id;
  const { studentIds, format = "json" } = req.body as {
    studentIds?: string[];
    format?: string;
  };

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    res.status(400).json({ error: "studentIds must be a non-empty array" });
    return;
  }

  if (studentIds.length > 200) {
    res.status(400).json({ error: "الحد الأقصى للدفعة الواحدة هو 200 تلميذ" });
    return;
  }

  if (format !== "json") {
    res.status(400).json({
      error: "الإنشاء الجماعي لصور QR غير مدعوم — استخدم format=json ثم اطبع القوائم من الواجهة",
    });
    return;
  }

  const students = await db
    .select({
      id:        studentsTable.id,
      nomPrenom: studentsTable.nomPrenom,
      niveau:    studentsTable.niveau,
      classe:    studentsTable.classe,
      annee:     studentsTable.annee,
    })
    .from(studentsTable)
    .where(eq(studentsTable.userId, userId));

  const idSet = new Set(studentIds);
  const scoped = students.filter((s) => idSet.has(s.id));

  const results = scoped.map((s) => ({
    studentId: s.id,
    student:   s.nomPrenom,
    niveau:    s.niveau,
    classe:    s.classe,
    annee:     s.annee,
    payload:   buildQrPayload(s),
  }));

  res.json({ count: results.length, items: results });
}
