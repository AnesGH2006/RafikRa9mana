/**
 * OCR Grade Sheet Processing  (v2 — Sharp preprocessing)
 *
 * POST /api/ocr/parse-grades
 *   Accepts an uploaded image of a printed grade sheet.
 *   Pipeline: Sharp preprocess → Tesseract (ara+fra) → grade-line parser
 *   Returns: { rows, totalLines, overallConfidence, rawText }
 */
import { Router } from "express";
import multer from "multer";
import { createWorker } from "tesseract.js";
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

// ── Image preprocessing ────────────────────────────────────────────────────────
/**
 * Converts the uploaded image to a high-contrast greyscale PNG that Tesseract
 * reads much more reliably than a raw photo.
 *
 * Steps:
 *  1. Greyscale
 *  2. Upscale to at least 2 400 px wide (Tesseract prefers >300 dpi)
 *  3. Sharpen edges
 *  4. Normalize contrast (stretch histogram)
 *  5. Adaptive threshold — turns the result B&W
 */
async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 800;
  const h = meta.height ?? 600;

  // Target ~3 000 px wide for better Tesseract accuracy (300+ dpi equivalent)
  const targetWidth = Math.max(3000, w);

  // First pass: upscale + grayscale + strong unsharp mask
  const pass1 = await sharp(buffer)
    .grayscale()
    .resize({ width: targetWidth, withoutEnlargement: false, kernel: "lanczos3" })
    .sharpen({ sigma: 2.0, m1: 2.0, m2: 0.5 })
    .normalize()               // stretch histogram to 0-255
    .toBuffer();

  // Second pass: mild threshold to binarize cleanly
  // Use 128 (midpoint) for average-contrast documents
  return sharp(pass1)
    .threshold(128)
    .png({ compressionLevel: 0 }) // no compression for speed
    .toBuffer();
}

// ── Grade line parser ──────────────────────────────────────────────────────────
/**
 * Looks for lines that contain a grade value (0–20, with optional decimal).
 * Handles both "Name .... 14.50" and "14.50 .... Name" layouts.
 * Arabic grade sheets usually have the score at the END of the row.
 */
interface ParsedRow {
  rowNumber: number;
  studentName: string;
  grade: number | null;
  confidence: number;
  lowConfidence: boolean;
}

const GRADE_RE = /\b(20(?:[.,]0{1,2})?|1[0-9](?:[.,]\d{1,2})?|[0-9](?:[.,]\d{1,2})?)\b/g;

function extractGrade(line: string): { grade: number; rest: string } | null {
  const matches = [...line.matchAll(GRADE_RE)];
  if (!matches.length) return null;

  // Prefer the LAST match (grade is usually at the right in Arabic sheets)
  const m = matches[matches.length - 1];
  const gradeStr = m[0].replace(",", ".");
  const grade = parseFloat(gradeStr);
  if (isNaN(grade) || grade < 0 || grade > 20) return null;

  const rest = (line.slice(0, m.index!) + line.slice(m.index! + m[0].length))
    .replace(/[|_\-–—=]+/g, " ")  // strip table borders
    .replace(/\s+/g, " ")
    .trim();

  return { grade, rest };
}

function parseGradeLines(rawText: string): ParsedRow[] {
  const lines = rawText
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 2);

  const results: ParsedRow[] = [];
  let rowNum = 0;

  for (const line of lines) {
    rowNum++;
    const extracted = extractGrade(line);
    if (!extracted) continue;

    const { grade, rest } = extracted;

    // Remove leading row numbers / indices ("1." "2-" etc.)
    const name = rest.replace(/^\d+[\s.,\-–)]+/, "").trim();
    if (name.length < 2) continue;

    results.push({
      rowNumber: rowNum,
      studentName: name,
      grade,
      confidence: 100,
      lowConfidence: false,
    });
  }

  return results;
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

    const lang = typeof req.query.lang === "string" ? req.query.lang : "ara+fra";
    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

    try {
      logger.info({ size: req.file.size, lang }, "OCR: preprocessing image");

      // ── Step 1: preprocess ──────────────────────────────────────────────────
      const processed = await preprocessImage(req.file.buffer);

      logger.info({ processedSize: processed.length }, "OCR: starting Tesseract");

      // ── Step 2: Tesseract with optimal settings ─────────────────────────────
      worker = await createWorker(lang);

      await worker.setParameters({
        // PSM 4 = single column of text — best for grade sheets with name + score columns
        tessedit_pageseg_mode: "4" as any,
        // Keep inter-word spaces so Arabic names aren't merged
        preserve_interword_spaces: "1" as any,
        // Whitelist digits, decimal separators, and Arabic characters for better accuracy
        tessedit_char_whitelist: "" as any,
      });

      const { data } = await worker.recognize(processed);

      logger.info(
        { confidence: data.confidence },
        "OCR: recognition complete",
      );

      // ── Step 3: build word-confidence map ───────────────────────────────────
      const wordConfMap: Record<string, number> = {};
      for (const block of data.blocks ?? []) {
        for (const para of block.paragraphs ?? []) {
          for (const line of para.lines ?? []) {
            for (const word of line.words ?? []) {
              if (word.text) wordConfMap[word.text] = Math.max(wordConfMap[word.text] ?? 0, word.confidence);
            }
          }
        }
      }

      // ── Step 4: parse grade lines ────────────────────────────────────────────
      const rows = parseGradeLines(data.text);

      // Annotate per-row confidence from word map
      const LOW_CONF_THRESHOLD = 70;
      for (const row of rows) {
        const words = row.studentName.split(/\s+/);
        const confs = words.map(w => wordConfMap[w] ?? data.confidence);
        const avg = confs.reduce((a, b) => a + b, 0) / (confs.length || 1);
        row.confidence = Math.round(avg);
        row.lowConfidence = row.confidence < LOW_CONF_THRESHOLD;
      }

      res.json({
        success: true,
        rows,
        totalLines: rows.length,
        overallConfidence: Math.round(data.confidence),
        rawText: data.text,
      });
    } catch (err: any) {
      logger.error({ err }, "OCR: processing failed");
      res.status(500).json({
        error: "فشل معالجة الصورة بالـ OCR",
        details: err?.message ?? "Unknown error",
      });
    } finally {
      if (worker) await worker.terminate().catch(() => {});
    }
  },
);

export default router;
