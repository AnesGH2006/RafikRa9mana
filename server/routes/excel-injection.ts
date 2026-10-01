import { Router } from "express";
import multer from "multer";
import { injectStudentValuesIntoWorkbook, type ExcelInjectionOptions, type StudentCellPayload } from "../lib/excel-injection.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});

router.post("/excel-injection", upload.single("template"), async (req, res): Promise<void> => {
  if (!req.isAuthenticated() || !req.user || req.memberContext) {
    res.status(403).json({ error: "هذه العملية متاحة لمسؤول المؤسسة فقط" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "ارفع ملف قالب Excel أولاً" });
    return;
  }
  if (!/\.xlsx$/i.test(req.file.originalname)) {
    res.status(400).json({ error: "يجب أن يكون القالب بصيغة .xlsx" });
    return;
  }

  let students: StudentCellPayload[];
  let options: ExcelInjectionOptions;
  try {
    const parsedStudents: unknown = JSON.parse(String(req.body?.studentsJson ?? ""));
    const parsedOptions: unknown = JSON.parse(String(req.body?.optionsJson ?? "{}"));
    if (!Array.isArray(parsedStudents)) throw new Error("studentsJson يجب أن يكون مصفوفة JSON");
    if (!parsedOptions || typeof parsedOptions !== "object") throw new Error("optionsJson غير صالح");
    students = parsedStudents as StudentCellPayload[];
    options = parsedOptions as ExcelInjectionOptions;
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "بيانات JSON غير صالحة" });
    return;
  }

  try {
    const result = await injectStudentValuesIntoWorkbook(req.file.buffer, students, options);
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="injected-${Date.now()}.xlsx"`,
      "X-Excel-Updated": String(result.updated),
      "X-Excel-Skipped": String(result.skipped.length),
    });
    res.send(result.buffer);
  } catch (error) {
    req.log.error({ error }, "Excel injection failed");
    res.status(400).json({ error: error instanceof Error ? error.message : "تعذر معالجة ملف Excel" });
  }
});

export default router;