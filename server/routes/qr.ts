/**
 * QR Code routes
 *
 * GET  /api/qr/student/:studentId   — single QR (PNG data URL, SVG, or JSON payload)
 * POST /api/qr/students/batch       — batch JSON payloads (up to 200)
 */
import { Router } from "express";
import { generateStudentQr, batchStudentQr } from "../controllers/qr.js";

const router = Router();

router.get("/qr/student/:studentId", generateStudentQr);
router.post("/qr/students/batch", batchStudentQr);

export default router;
