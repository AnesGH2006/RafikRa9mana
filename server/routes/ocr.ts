/**
 * OCR Grade Sheet Processing  (v4 — Groq Vision LLM, updated model)
 *
 * POST /api/ocr/parse-grades
 *   Accepts an uploaded image of a printed grade sheet.
 *   Pipeline: resize with Sharp → Groq Vision LLM (qwen3.6-27b) → structured JSON
 *   Returns: { rows, totalLines, overallConfidence, rawText }
 */
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { logger } from "../lib/logger.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("يجب أن يكون الملف صورة (JPEG, PNG, WebP, …)"));
      return;
    }
    cb(null, true);
  },
});

// ── Resize image for Vision API (max 1920px, JPEG for smaller payload) ─────────
async function prepareForVision(buffer: Buffer): Promise<{ data: string; mimeType: string }> {
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 800;

  const targetWidth = Math.min(w, 1920);
  const processed = await sharp(buffer)
    .resize({ width: targetWidth, withoutEnlargement: true, kernel: "lanczos3" })
    .jpeg({ quality: 88 })
    .toBuffer();

  return {
    data: processed.toString("base64"),
    mimeType: "image/jpeg",
  };
}

// ── Call Groq Vision API ────────────────────────────────────────────────────────
interface GroqRow { studentName: string; grade: number }

async function extractWithGroqVision(imageB64: string, mimeType: string): Promise<GroqRow[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY غير مضبوط");

  const prompt = `هذه صورة كشف درجات مدرسي جزائري.
استخرج جدول التلاميذ والدرجات بدقة تامة.
أعد مصفوفة JSON فقط بالشكل التالي — لا تضف أي نص قبلها أو بعدها:
[{"studentName": "لقب الاسم", "grade": 14.5}, ...]

قواعد:
- الدرجات من 0 إلى 20، أرقام عشرية مسموحة.
- استخرج أسماء التلاميذ كاملة كما تظهر في الجدول (عربي).
- تجاهل أرقام التسلسل والعناوين والخانات الفارغة.
- لا تخترع بيانات، استخرج ما هو موجود فقط.`;

  const body = JSON.stringify({
    // ✅ FIX: "meta-llama/llama-4-scout-17b-16e-instruct" was deprecated by
    // Groq on June 17, 2026 and no longer exists — every call failed with
    // a 404 model_not_found error, regardless of image quality or content.
    // "qwen/qwen3.6-27b" is Groq's current vision-capable multimodal model
    // (their other suggested replacement, openai/gpt-oss-120b, is text-only
    // and cannot process images — it would fail differently if used here).
    model: "qwen/qwen3.6-27b",
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageB64}` } },
          { type: "text",      text: prompt },
        ],
      },
    ],
    max_tokens: 4096,
    temperature: 0,
  });

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Groq API ${res.status}: ${err}`);
  }

  const json = await res.json() as { choices: Array<{ message: { content: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "";

  // Pull out the JSON array (the model sometimes adds a brief sentence before/after)
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]) as Array<unknown>;
    return parsed.filter(
      (r): r is GroqRow =>
        typeof r === "object" && r !== null &&
        typeof (r as any).studentName === "string" &&
        typeof (r as any).grade === "number" &&
        (r as any).grade >= 0 && (r as any).grade <= 20,
    );
  } catch {
    return [];
  }
}

// ── Route ──────────────────────────────────────────────────────────────────────
router.post(
  "/ocr/parse-grades",
  upload.single("image"),
  async (req, res): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "لم يتم رفع أي صورة. أرفق الصورة في حقل 'image'." });
      return;
    }

    try {
      logger.info({ size: req.file.size, mime: req.file.mimetype }, "OCR (Vision): preparing image");

      const { data: imageB64, mimeType } = await prepareForVision(req.file.buffer);

      logger.info({ bytes: Math.round(imageB64.length * 0.75) }, "OCR (Vision): calling Groq");

      const rawRows = await extractWithGroqVision(imageB64, mimeType);

      logger.info({ count: rawRows.length }, "OCR (Vision): extraction complete");

      if (rawRows.length === 0) {
        res.status(422).json({
          error: "لم يتم العثور على أي درجات في الصورة. تأكد من جودة الصورة وحاول مرة أخرى.",
        });
        return;
      }

      const rows = rawRows.map((r, i) => ({
        rowNumber:     i + 1,
        studentName:   r.studentName.trim(),
        grade:         r.grade,
        confidence:    95,
        lowConfidence: false,
      }));

      res.json({
        success: true,
        rows,
        totalLines: rows.length,
        overallConfidence: 95,
        rawText: rawRows.map(r => `${r.studentName}: ${r.grade}`).join("\n"),
      });
    } catch (err: any) {
      logger.error({ err }, "OCR (Vision): processing failed");
      res.status(500).json({
        error: "فشل معالجة الصورة بالذكاء الاصطناعي",
        details: err?.message ?? "Unknown error",
      });
    }
  },
);

export default router;