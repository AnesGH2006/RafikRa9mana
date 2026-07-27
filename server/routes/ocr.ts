/**
 * OCR Grade Sheet Processing
 *
 * POST /api/ocr/parse-grades
 *   Accepts an uploaded image of a printed grade sheet.
 *   Returns: [{ rowNumber, studentName, grade, confidence, lowConfidence }]
 */
import { Router } from "express";
import multer from "multer";
import { createWorker } from "tesseract.js";
import { logger } from "../lib/logger.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("يجب أن يكون الملف صورة (JPEG, PNG, WebP, …)"));
      return;
    }
    cb(null, true);
  },
});

// ── Grade line parser ─────────────────────────────────────────────────────────
// A grade-sheet row typically looks like:
//   [name part]   [score 0–20, possibly with decimal]
// We search for the first float in [0, 20] range.

interface ParsedRow {
  rowNumber: number;
  studentName: string;
  grade: number | null;
  confidence: number;
  lowConfidence: boolean;
}

function parseGradeLines(
  words: Awaited<ReturnType<typeof createWorker>>[""],
  rawText: string,
): ParsedRow[] {
  const lines = rawText
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 1);

  const results: ParsedRow[] = [];
  let globalRow = 0;

  for (const line of lines) {
    globalRow++;
    // Match numbers 0–20 (with optional decimal)
    const gradeMatch = line.match(/\b(20|1[0-9]|[0-9])([.,]\d{1,2})?\b/);
    if (!gradeMatch) continue;

    const gradeStr = gradeMatch[0].replace(",", ".");
    const grade = parseFloat(gradeStr);
    if (isNaN(grade) || grade < 0 || grade > 20) continue;

    // Remove the grade token — what remains is the student name
    const nameRaw = line.replace(gradeMatch[0], "").replace(/\s+/g, " ").trim();
    if (nameRaw.length < 2) continue;

    results.push({
      rowNumber: globalRow,
      studentName: nameRaw,
      grade,
      confidence: 100, // word-level confidence added below if possible
      lowConfidence: false,
    });
  }

  return results;
}

// ── Route ─────────────────────────────────────────────────────────────────────

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

    // Optional hint about languages — default: Arabic + French
    const lang = typeof req.query.lang === "string" ? req.query.lang : "ara+fra";

    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

    try {
      logger.info({ size: req.file.size, lang }, "OCR: starting recognition");

      worker = await createWorker(lang);
      const { data } = await worker.recognize(req.file.buffer);

      logger.info({ confidence: data.confidence, lines: data.lines?.length }, "OCR: recognition complete");

      // Build word-level confidence map (word text → avg confidence)
      const wordConfMap: Record<string, number> = {};
      for (const block of data.blocks ?? []) {
        for (const para of block.paragraphs ?? []) {
          for (const line of para.lines ?? []) {
            for (const word of line.words ?? []) {
              wordConfMap[word.text] = word.confidence;
            }
          }
        }
      }

      const rows = parseGradeLines(null as any, data.text);

      // Annotate confidence per row
      for (const row of rows) {
        const words = row.studentName.split(/\s+/);
        const confs = words.map(w => wordConfMap[w] ?? data.confidence);
        const avg = confs.reduce((a, b) => a + b, 0) / (confs.length || 1);
        row.confidence = Math.round(avg);
        row.lowConfidence = row.confidence < 70;
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
