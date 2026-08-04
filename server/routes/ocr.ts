/**
 * OCR Grade Sheet & Absence Sheet Processing  (v5 — absences mode added)
 *
 * POST /api/ocr/parse-grades?type=grades   (default) → extract grades
 * POST /api/ocr/parse-grades?type=absences           → extract absence hours
 *
 * Pipeline: resize with Sharp → Groq Vision LLM (qwen3.6-27b) → structured JSON
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

// ── Resize image for Vision API ────────────────────────────────────────────────
async function prepareForVision(buffer: Buffer): Promise<{ data: string; mimeType: string }> {
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 800;
  const processed = await sharp(buffer)
    .resize({ width: Math.min(w, 1920), withoutEnlargement: true, kernel: "lanczos3" })
    .jpeg({ quality: 88 })
    .toBuffer();
  return { data: processed.toString("base64"), mimeType: "image/jpeg" };
}

// ── Shared Groq Vision caller ──────────────────────────────────────────────────
async function callGroqVision(imageB64: string, mimeType: string, prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("مفتاح GROQ_API_KEY غير مضبوط. أضفه من قائمة الأسرار في لوحة Replit لتفعيل الـ OCR.");

  const body = JSON.stringify({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageB64}` } },
        { type: "text", text: prompt },
      ],
    }],
    max_tokens: 4096,
    temperature: 0,
  });

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Groq API ${res.status}: ${err}`);
  }

  const json = await res.json() as { choices: Array<{ message: { content: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

// ── Grades extraction ──────────────────────────────────────────────────────────
interface GroqGradeRow { studentName: string; grade: number }

async function extractGradesWithGroqVision(imageB64: string, mimeType: string): Promise<GroqGradeRow[]> {
  const prompt = `هذه صورة كشف درجات مدرسي جزائري.
استخرج جدول التلاميذ والدرجات بدقة تامة.
أعد مصفوفة JSON فقط بالشكل التالي — لا تضف أي نص قبلها أو بعدها:
[{"studentName": "لقب الاسم", "grade": 14.5}, ...]

قواعد:
- الدرجات من 0 إلى 20، أرقام عشرية مسموحة.
- استخرج أسماء التلاميذ كاملة كما تظهر في الجدول (عربي).
- تجاهل أرقام التسلسل والعناوين والخانات الفارغة.
- لا تخترع بيانات، استخرج ما هو موجود فقط.`;

  const content = await callGroqVision(imageB64, mimeType, prompt);
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as Array<unknown>;
    return parsed.filter(
      (r): r is GroqGradeRow =>
        typeof r === "object" && r !== null &&
        typeof (r as any).studentName === "string" &&
        typeof (r as any).grade === "number" &&
        (r as any).grade >= 0 && (r as any).grade <= 20,
    );
  } catch {
    return [];
  }
}

// ── Absences extraction ────────────────────────────────────────────────────────
interface GroqAbsenceRow { studentName: string; justifiedHours: number; unjustifiedHours: number }

async function extractAbsencesWithGroqVision(imageB64: string, mimeType: string): Promise<GroqAbsenceRow[]> {
  const prompt = `هذه صورة كشف غياب مدرسي جزائري.
استخرج جدول التلاميذ وساعات الغياب بدقة تامة.
أعد مصفوفة JSON فقط بالشكل التالي — لا تضف أي نص قبلها أو بعدها:
[{"studentName": "لقب الاسم", "justifiedHours": 2, "unjustifiedHours": 5}, ...]

قواعد:
- ساعات الغياب أرقام صحيحة من 0 إلى 500.
- إذا وجدت عمود واحد للغياب فقط (بدون تمييز)، ضع القيمة في "unjustifiedHours" و 0 في "justifiedHours".
- استخرج أسماء التلاميذ كاملة كما تظهر في الجدول (عربي).
- تجاهل أرقام التسلسل والعناوين والخانات الفارغة.
- لا تخترع بيانات، استخرج ما هو موجود فقط.`;

  const content = await callGroqVision(imageB64, mimeType, prompt);
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as Array<unknown>;
    return parsed.filter(
      (r): r is GroqAbsenceRow =>
        typeof r === "object" && r !== null &&
        typeof (r as any).studentName === "string" &&
        typeof (r as any).justifiedHours === "number" &&
        typeof (r as any).unjustifiedHours === "number" &&
        (r as any).justifiedHours >= 0 &&
        (r as any).unjustifiedHours >= 0,
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

    const ocrType = (req.query.type as string) === "absences" ? "absences" : "grades";

    try {
      logger.info({ size: req.file.size, mime: req.file.mimetype, ocrType }, "OCR (Vision): preparing image");

      const { data: imageB64, mimeType } = await prepareForVision(req.file.buffer);
      logger.info({ bytes: Math.round(imageB64.length * 0.75) }, "OCR (Vision): calling Groq");

      if (ocrType === "absences") {
        // ── Absences mode ────────────────────────────────────────────────────
        const rawRows = await extractAbsencesWithGroqVision(imageB64, mimeType);
        logger.info({ count: rawRows.length }, "OCR (Vision): absence extraction complete");

        if (rawRows.length === 0) {
          res.status(422).json({
            error: "لم يتم العثور على بيانات غياب في الصورة. تأكد من جودة الصورة وحاول مرة أخرى.",
          });
          return;
        }

        const rows = rawRows.map((r, i) => ({
          rowNumber:      i + 1,
          studentName:    r.studentName.trim(),
          justifiedHours: r.justifiedHours,
          unjustifiedHours: r.unjustifiedHours,
          confidence:     95,
          lowConfidence:  false,
        }));

        res.json({
          success: true,
          type: "absences",
          rows,
          totalLines: rows.length,
          overallConfidence: 95,
        });
      } else {
        // ── Grades mode (default) ─────────────────────────────────────────────
        const rawRows = await extractGradesWithGroqVision(imageB64, mimeType);
        logger.info({ count: rawRows.length }, "OCR (Vision): grade extraction complete");

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
          type: "grades",
          rows,
          totalLines: rows.length,
          overallConfidence: 95,
          rawText: rawRows.map(r => `${r.studentName}: ${r.grade}`).join("\n"),
        });
      }
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
