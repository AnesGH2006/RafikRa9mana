/**
 * OCR Service — Groq Vision (primary) + Tesseract.js (fallback)
 *
 * Supports grade sheets and absence lists with confidence scoring.
 */
import sharp from "sharp";
import Tesseract from "tesseract.js";
import { logger } from "../lib/logger.js";

export type OcrEngine = "vision" | "tesseract" | "auto";
export type OcrType = "grades" | "absences";

export interface OcrGradeRow {
  studentName: string;
  grade: number;
  confidence: number;
}

export interface OcrAbsenceRow {
  studentName: string;
  justifiedHours: number;
  unjustifiedHours: number;
  confidence: number;
}

export interface OcrResult {
  engine: OcrEngine;
  type: OcrType;
  rows: Array<OcrGradeRow | OcrAbsenceRow>;
  rawText?: string;
  overallConfidence: number;
}

// ── Image preprocessing ─────────────────────────────────────────────────────────

export async function prepareImage(buffer: Buffer): Promise<{ data: string; mimeType: string; tesseractBuffer: Buffer }> {
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 800;
  const targetWidth = Math.min(Math.max(w, 1600), 2400);

  const processed = await sharp(buffer)
    .autoOrient()
    .resize({ width: Math.min(Math.max(w, 1200), 1920), withoutEnlargement: false, kernel: "lanczos3" })
    .jpeg({ quality: 88 })
    .toBuffer();

  const tesseractBuffer = await sharp(buffer)
    .autoOrient()
    .resize({ width: targetWidth, withoutEnlargement: false, kernel: "lanczos3" })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.2 })
    .jpeg({ quality: 92 })
    .toBuffer();

  return {
    data: processed.toString("base64"),
    mimeType: "image/jpeg",
    tesseractBuffer,
  };
}

// ── Groq Vision ─────────────────────────────────────────────────────────────────

async function callGroqVision(imageB64: string, mimeType: string, prompt: string, apiKey: string | null): Promise<string> {
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

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

const GRADES_PROMPT = `هذه صورة كشف درجات مدرسي جزائري، وقد تكون مطبوعة أو مكتوبة بخط اليد، بالعربية أو الفرنسية، وبأي اتجاه للأعمدة.
استخرج جدول التلاميذ والدرجات بدقة تامة.
أعد مصفوفة JSON فقط بالشكل التالي — لا تضف أي نص قبلها أو بعدها:
[{"studentName": "لقب الاسم", "grade": 14.5}, ...]

قواعد:
- الدرجات من 0 إلى 20، أرقام عشرية مسموحة.
- استخرج أسماء التلاميذ كاملة كما تظهر في الجدول (عربي).
- اقرأ الصفوف حتى لو كانت الكتابة اليدوية أو الصورة مائلة أو الأعمدة غير منتظمة.
- ميّز رقم التسلسل عن الدرجة، واربط الدرجة بالاسم في الصف نفسه لا بمجرد قربها البصري.
- إذا كانت الخانة غير مقروءة، لا تخمّنها وأعد الصف بدونها.
- تجاهل أرقام التسلسل والعناوين والخانات الفارغة.
- لا تخترع بيانات، استخرج ما هو موجود فقط.`;

const ABSENCES_PROMPT = `هذه صورة كشف غياب مدرسي جزائري، وقد تكون مطبوعة أو مكتوبة بخط اليد، بالعربية أو الفرنسية، وبأي ترتيب للأعمدة.
استخرج جدول التلاميذ وساعات الغياب بدقة تامة.
أعد مصفوفة JSON فقط بالشكل التالي — لا تضف أي نص قبلها أو بعدها:
[{"studentName": "لقب الاسم", "justifiedHours": 2, "unjustifiedHours": 5}, ...]

قواعد:
- ساعات الغياب أرقام صحيحة من 0 إلى 500.
- إذا وجدت عمود واحد للغياب فقط (بدون تمييز)، ضع القيمة في "unjustifiedHours" و 0 في "justifiedHours".
- استخرج أسماء التلاميذ كاملة كما تظهر في الجدول (عربي).
- اقرأ الجدول حتى لو كانت الكتابة اليدوية أو الصورة مائلة أو الأعمدة غير منتظمة.
- اربط كل رقم بالاسم في الصف نفسه، ولا تعتبر رقم التسلسل ساعة غياب.
- إذا كانت خانة غير مقروءة، لا تخمّنها واستخدم 0 فقط عندما يكون العمود غير موجود أصلاً.
- تجاهل أرقام التسلسل والعناوين والخانات الفارغة.
- لا تخترع بيانات، استخرج ما هو موجود فقط.`;

function extractJsonArrayCandidate(raw: string): string | null {
  const candidates: string[] = [];

  const codeFence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  if (codeFence) candidates.push(codeFence);

  const firstBracket = raw.indexOf("[");
  const lastBracket = raw.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    candidates.push(raw.slice(firstBracket, lastBracket + 1));
  }

  const fromObject = raw.match(/\[[\s\S]*\]/)?.[0];
  if (fromObject) candidates.push(fromObject);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return candidate;
    } catch {
      // try next candidate
    }
  }

  return null;
}

async function extractWithVision(
  imageB64: string,
  mimeType: string,
  type: OcrType,
  apiKey: string | null,
): Promise<{ rows: OcrGradeRow[] | OcrAbsenceRow[]; rawText: string }> {
  const prompt = type === "absences" ? ABSENCES_PROMPT : GRADES_PROMPT;
  const content = await callGroqVision(imageB64, mimeType, prompt, apiKey);
  const jsonCandidate = extractJsonArrayCandidate(content);
  if (!jsonCandidate) return { rows: [], rawText: content };

  try {
    const parsed = JSON.parse(jsonCandidate) as unknown;
    if (!Array.isArray(parsed)) return { rows: [], rawText: content };
    if (type === "absences") {
      const rows = parsed
        .filter(r =>
          typeof r.studentName === "string" &&
          Number.isFinite(Number(r.justifiedHours)) &&
          Number.isFinite(Number(r.unjustifiedHours)) &&
          Number(r.justifiedHours) >= 0 &&
          Number(r.unjustifiedHours) >= 0,
        )
        .map(r => ({
          studentName: String(r.studentName).trim(),
          justifiedHours: Math.round(Number(r.justifiedHours)),
          unjustifiedHours: Math.round(Number(r.unjustifiedHours)),
          confidence: 90,
        }));
      return { rows, rawText: content };
    }

    const rows = parsed
      .filter(r =>
        typeof r.studentName === "string" &&
        Number.isFinite(Number(r.grade)) &&
        Number(r.grade) >= 0 &&
        Number(r.grade) <= 20,
      )
      .map(r => ({
        studentName: String(r.studentName).trim(),
        grade: Number(r.grade),
        confidence: 90,
      }));
    return { rows, rawText: content };
  } catch {
    return { rows: [], rawText: content };
  }
}

// ── Tesseract.js ──────────────────────────────────────────────────────────────────

/** Parse a line like "محمد بن أحمد  14.5" or "14.5  محمد بن أحمد" */
function parseGradeLine(line: string): OcrGradeRow | null {
  const trimmed = line.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.length < 3) return null;

  const candidates = [...trimmed.matchAll(/(?<!\d)(\d{1,2}(?:[.,]\d{1,2})?)(?!\d)/g)]
    .map(match => ({ value: parseFloat(match[1]!.replace(",", ".")), index: match.index!, length: match[0].length }))
    .filter(candidate => Number.isFinite(candidate.value) && candidate.value >= 0 && candidate.value <= 20);
  const gradeMatch = candidates.at(-1);
  if (!gradeMatch) return null;

  const grade = gradeMatch.value;

  const name = `${trimmed.slice(0, gradeMatch.index)} ${trimmed.slice(gradeMatch.index + gradeMatch.length)}`
    .replace(/^\s*\d+\s*/, "").replace(/\s*\d+\s*$/, "").trim();
  if (!name || name.length < 2) return null;

  return { studentName: name, grade, confidence: 72 };
}

function parseAbsenceLine(line: string): OcrAbsenceRow | null {
  const trimmed = line.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))).replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.length < 3) return null;

  const numbers = [...trimmed.matchAll(/(\d{1,3})/g)].map(m => parseInt(m[1]!, 10));
  if (numbers.length === 0) return null;

  const namePart = trimmed.replace(/\d+/g, " ").replace(/\s+/g, " ").trim();
  if (!namePart || namePart.length < 2) return null;

  const values = numbers.length > 2 ? numbers.slice(-2) : numbers;
  if (values.length >= 2) {
    return {
      studentName: namePart,
      justifiedHours: values[0]!,
      unjustifiedHours: values[1]!,
      confidence: 68,
    };
  }

  return {
    studentName: namePart,
    justifiedHours: 0,
    unjustifiedHours: numbers[0]!,
    confidence: 65,
  };
}

async function extractWithTesseract(
  buffer: Buffer,
  type: OcrType,
): Promise<{ rows: OcrGradeRow[] | OcrAbsenceRow[]; rawText: string }> {
  logger.info("OCR: running Tesseract.js (ara+fra)");

  const { data } = await Tesseract.recognize(buffer, "ara+fra", {
    logger: m => {
      if (m.status === "recognizing text") {
        logger.debug({ progress: Math.round(m.progress * 100) }, "Tesseract progress");
      }
    },
  });

  const rawText = data.text ?? "";
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows: OcrGradeRow[] | OcrAbsenceRow[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (/^(اسم|الاسم|اللقب|رقم|#|total|مجموع)/i.test(line)) continue;
    const parsed = type === "absences" ? parseAbsenceLine(line) : parseGradeLine(line);
    if (parsed) {
      const key = type === "grades"
        ? `${parsed.studentName}:${(parsed as OcrGradeRow).grade}`
        : `${parsed.studentName}:${(parsed as OcrAbsenceRow).justifiedHours}:${(parsed as OcrAbsenceRow).unjustifiedHours}`;
      if (!seen.has(key)) {
        seen.add(key);
        (rows as Array<OcrGradeRow | OcrAbsenceRow>).push(parsed);
      }
    }
  }

  return { rows, rawText };
}

// ── Public API ────────────────────────────────────────────────────────────────────

export function resolveEngine(requested: OcrEngine, apiKey: string | null): OcrEngine {
  if (requested === "auto") {
    return apiKey ? "vision" : "tesseract";
  }
  if (requested === "vision" && !apiKey) {
    return "tesseract";
  }
  return requested;
}

export async function processOcr(
  buffer: Buffer,
  type: OcrType,
  engine: OcrEngine = "auto",
  apiKey: string | null = null,
): Promise<OcrResult> {
  const resolved = resolveEngine(engine, apiKey);
  const { data, mimeType, tesseractBuffer } = await prepareImage(buffer);

  let rows: Array<OcrGradeRow | OcrAbsenceRow> = [];
  let rawText = "";
  let usedEngine = resolved;

  if (resolved === "vision") {
    try {
      const result = await extractWithVision(data, mimeType, type, apiKey);
      rows = result.rows;
      rawText = result.rawText;

      if (rows.length === 0) {
        logger.warn("Vision OCR returned no rows — falling back to Tesseract");
        const fallback = await extractWithTesseract(tesseractBuffer, type);
        rows = fallback.rows;
        rawText = fallback.rawText;
        usedEngine = "tesseract";
      }
    } catch (err) {
      logger.warn({ err }, "Vision OCR failed — falling back to Tesseract");
      const fallback = await extractWithTesseract(tesseractBuffer, type);
      rows = fallback.rows;
      rawText = fallback.rawText;
      usedEngine = "tesseract";
    }
  } else {
    const result = await extractWithTesseract(tesseractBuffer, type);
    rows = result.rows;
    rawText = result.rawText;
  }

  const confidences = rows.map(r => r.confidence);
  const overallConfidence = confidences.length
    ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
    : 0;

  return {
    engine: usedEngine,
    type,
    rows,
    rawText,
    overallConfidence,
  };
}
