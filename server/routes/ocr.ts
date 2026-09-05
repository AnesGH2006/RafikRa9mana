/**
 * OCR Grade Sheet & Absence Sheet Processing
 *
 * POST /api/ocr/parse-grades?type=grades|absences&engine=auto|vision|tesseract
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { logger } from "../lib/logger.js";
import { processOcr, type OcrEngine } from "../services/ocrService.js";
import { db, ocrUploadsTable } from "../../shared/db.js";
import { getUserGroqKey } from "../lib/groq-key.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const isImage = file.mimetype.startsWith("image/");
    const isPdf = file.mimetype === "application/pdf";

    if (!isImage && !isPdf) {
      callback(
        new Error("يجب أن يكون الملف صورة JPEG أو PNG أو WebP أو ملف PDF"),
      );
      return;
    }

    callback(null, true);
  },
});

router.post(
  "/ocr/parse-grades",
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("image")(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({
            error: "حجم الملف كبير جداً",
            details: "الحد الأقصى لحجم الملف هو 15MB",
          });
          return;
        }

        res.status(400).json({
          error: "فشل رفع الملف",
          details: err.message,
        });
        return;
      }

      if (err) {
        res.status(400).json({
          error: "نوع الملف غير مدعوم",
          details: err instanceof Error ? err.message : String(err),
        });
        return;
      }

      next();
    });
  },

  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.isAuthenticated()) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      /*
       * Do not reject every request merely because memberContext exists.
       * Only reject non-admin users without an active subscription.
       */
      const user = req.user as {
        id: string | number;
        role?: string;
        subscriptionStatus?: string;
      };

      const isAdmin = user.role === "admin";
      const hasActiveSubscription = user.subscriptionStatus === "active";

      if (!isAdmin && !hasActiveSubscription) {
        res.status(403).json({
          error: "ميزة OCR متاحة لصاحب الاشتراك فقط",
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          error: "لم يتم رفع أي صورة. أرسل الملف في حقل FormData باسم image.",
        });
        return;
      }

      if (req.file.mimetype === "application/pdf") {
        res.status(415).json({
          error:
            "ملفات PDF تحتاج إلى تحويل صفحاتها إلى صور قبل OCR. ارفع PNG أو JPG لكل صفحة.",
        });
        return;
      }

      const ocrType =
        String(req.query.type ?? "grades").toLowerCase() === "absences"
          ? "absences"
          : "grades";

      const requestedEngine = String(
        req.query.engine ?? "auto",
      ).toLowerCase();

      const engine: OcrEngine = ["auto", "vision", "tesseract"].includes(
        requestedEngine,
      )
        ? (requestedEngine as OcrEngine)
        : "auto";

      logger.info(
        {
          userId: user.id,
          size: req.file.size,
          mime: req.file.mimetype,
          originalName: req.file.originalname,
          ocrType,
          engine,
        },
        "OCR processing started",
      );

      const groqKey = await getUserGroqKey(user.id);

      const result = await processOcr(
        req.file.buffer,
        ocrType,
        engine,
        groqKey,
      );

      if (!result || !Array.isArray(result.rows)) {
        throw new Error("OCR service returned an invalid response");
      }

      const rows = result.rows.map((row: any, index: number) => {
        const confidence =
          typeof row.confidence === "number" ? row.confidence : 0;

        const base = {
          rowNumber: index + 1,
          studentName: String(row.studentName ?? "").trim(),
          confidence,
          lowConfidence: confidence < 80,
        };

        if (ocrType === "absences") {
          return {
            ...base,
            justifiedHours: Number(row.justifiedHours ?? 0),
            unjustifiedHours: Number(row.unjustifiedHours ?? 0),
          };
        }

        return {
          ...base,
          grade: row.grade ?? null,
        };
      });

      if (rows.length === 0) {
        res.status(422).json({
          error:
            ocrType === "absences"
              ? "لم يتم العثور على بيانات غياب في الصورة."
              : "لم يتم العثور على أي درجات في الصورة.",
          engine: result.engine ?? engine,
          suggestions: [
            "استخدم صورة واضحة وعالية الدقة",
            "تأكد من أن الجدول ظاهر بالكامل",
            "تأكد من وجود إضاءة جيدة وعدم وجود انعكاس",
            "جرّب engine=tesseract أو engine=vision",
          ],
          rawText: result.rawText?.slice(0, 1000) ?? "",
        });
        return;
      }

      try {
        await db.insert(ocrUploadsTable).values({
          userId: user.id,
          type: ocrType,
          engine: result.engine ?? engine,
          fileName: req.file.originalname || null,
          rows,
          rowCount: rows.length,
        });
      } catch (auditError) {
        logger.warn({ auditError }, "OCR audit insert failed");
      }

      res.status(200).json({
        success: true,
        type: ocrType,
        engine: result.engine ?? engine,
        rows,
        totalLines: rows.length,
        overallConfidence: result.overallConfidence ?? 0,
        rawText: result.rawText?.slice(0, 2000) ?? "",
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);

      logger.error(
        {
          error,
          message,
        },
        "OCR processing failed",
      );

      const isGroqError =
        message.toLowerCase().includes("groq") ||
        message.toLowerCase().includes("api key") ||
        message.toLowerCase().includes("401");

      res.status(500).json({
        error: "فشل معالجة الصورة",
        details: message,
        suggestion: isGroqError
          ? "تأكد من وجود GROQ_API_KEY أو اختر engine=tesseract"
          : "جرّب صورة أوضح أو اختر محرك OCR آخر",
      });
    }
  },
);

export default router;
