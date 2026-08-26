/**
 * OCR Grade Sheet & Absence Sheet Processing
 *
 * POST /api/ocr/parse-grades?type=grades|absences&engine=auto|vision|tesseract
 *
 * Pipeline: Sharp preprocess → Groq Vision (primary) → Tesseract.js (fallback)
 */
import { Router } from "express";
import multer from "multer";
import { logger } from "../lib/logger.js";
import { processOcr, type OcrEngine } from "../services/ocrService.js";
import { db, ocrUploadsTable } from "../../shared/db.js";
import { getUserGroqKey } from "../lib/groq-key.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";
    if (!allowed) {
      cb(new Error("يجب أن يكون الملف صورة (JPEG, PNG, WebP) أو PDF"));
      return;
    }
    cb(null, true);
  },
});

router.post(
  "/ocr/parse-grades",
  upload.single("image"),
  async (req, res): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (req.memberContext || (req.user!.role !== "admin" && req.user!.subscriptionStatus !== "active")) {
      res.status(403).json({ error: "ميزة OCR متاحة لصاحب الاشتراك فقط" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "لم يتم رفع أي صورة. أرفق الصورة في حقل 'image'." });
      return;
    }

    const userId = req.user!.id;
    const ocrType = (req.query.type as string) === "absences" ? "absences" : "grades";
    if (req.file.mimetype === "application/pdf") {
      res.status(415).json({
        error: "ملفات PDF تحتاج إلى تحويل صفحاتها إلى صور قبل OCR. ارفع PNG أو JPG لكل صفحة.",
      });
      return;
    }

    const engineParam = String(req.query.engine ?? "auto") as OcrEngine;
    const engine: OcrEngine = ["auto", "vision", "tesseract"].includes(engineParam)
      ? engineParam
      : "auto";

    try {
      logger.info({ size: req.file.size, mime: req.file.mimetype, ocrType, engine }, "OCR: processing");

      const result = await processOcr(req.file.buffer, ocrType, engine, await getUserGroqKey(userId));

      if (result.rows.length === 0) {
        res.status(422).json({
          error: ocrType === "absences"
            ? "لم يتم العثور على بيانات غياب في الصورة. تأكد من جودة الصورة وحاول مرة أخرى."
            : "لم يتم العثور على أي درجات في الصورة. تأكد من جودة الصورة وحاول مرة أخرى.",
          engine: result.engine,
          rawText: result.rawText?.slice(0, 500),
        });
        return;
      }

      const rows = result.rows.map((r, i) => {
        const base = {
          rowNumber: i + 1,
          studentName: r.studentName,
          confidence: r.confidence,
          lowConfidence: r.confidence < 75,
        };
        if (ocrType === "absences" && "justifiedHours" in r) {
          return {
            ...base,
            justifiedHours: r.justifiedHours,
            unjustifiedHours: r.unjustifiedHours,
          };
        }
        if ("grade" in r) {
          return { ...base, grade: r.grade };
        }
        return base;
      });

      // Audit log
      try {
        await db.insert(ocrUploadsTable).values({
          userId,
          type: ocrType,
          engine: result.engine,
          fileName: req.file.originalname ?? null,
          rows,
          rowCount: rows.length,
        });
      } catch (logErr) {
        logger.warn({ logErr }, "OCR audit insert failed");
      }

      res.json({
        success: true,
        type: ocrType,
        engine: result.engine,
        rows,
        totalLines: rows.length,
        overallConfidence: result.overallConfidence,
        rawText: result.rawText?.slice(0, 2000),
      });
    } catch (err: any) {
      logger.error({ err }, "OCR processing failed");
      res.status(500).json({
        error: "فشل معالجة الصورة",
        details: err?.message ?? "Unknown error",
      });
    }
  },
);

export default router;
