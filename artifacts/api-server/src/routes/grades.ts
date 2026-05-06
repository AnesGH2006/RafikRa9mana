import { Router, type IRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { UploadGradesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    const allowedExt = /\.(xlsx|xls)$/i;
    if (allowed.includes(file.mimetype) || allowedExt.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx and .xls files are allowed"));
    }
  },
});

router.post("/grades/upload", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded. Please upload an Excel file (.xlsx or .xls)." });
    return;
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: "buffer" });
  } catch {
    res.status(400).json({ error: "Could not read the file. Please ensure it is a valid Excel file." });
    return;
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    res.status(400).json({ error: "The Excel file is empty or has no sheets." });
    return;
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  if (!rawRows || rawRows.length === 0) {
    res.status(400).json({ error: "The sheet has no data. Please ensure the file has student rows." });
    return;
  }

  const parseNum = (val: unknown): number => {
    const n = parseFloat(String(val));
    return isNaN(n) ? 0 : Math.max(0, Math.min(20, n));
  };

  const PASS_THRESHOLD = 10;

  const students = rawRows.map((row, i) => {
    const name =
      String(
        row["name"] ??
        row["Name"] ??
        row["اسم"] ??
        row["الاسم"] ??
        row["Nom"] ??
        ""
      ).trim() || `Student ${i + 1}`;

    const math = parseNum(
      row["math"] ?? row["Math"] ?? row["رياضيات"] ?? row["Mathématiques"] ?? row["مرياضيات"] ?? 0
    );
    const arabic = parseNum(
      row["arabic"] ?? row["Arabic"] ?? row["عربية"] ?? row["اللغة العربية"] ?? row["Arabe"] ?? 0
    );
    const science = parseNum(
      row["science"] ?? row["Science"] ?? row["علوم"] ?? row["Sciences"] ?? 0
    );

    const average = Math.round(((math + arabic + science) / 3) * 100) / 100;
    const passed = average >= PASS_THRESHOLD;

    return { name, math, arabic, science, average, passed };
  });

  if (students.length === 0) {
    res.status(400).json({ error: "No valid student data found. Check that columns include: name, math, arabic, science." });
    return;
  }

  const sorted = [...students].sort((a, b) => b.average - a.average);
  const ranked = students.map((s) => ({
    ...s,
    rank: sorted.findIndex((x) => x.name === s.name && x.average === s.average) + 1,
  }));

  const averages = students.map((s) => s.average);
  const classAverage = Math.round((averages.reduce((a, b) => a + b, 0) / averages.length) * 100) / 100;
  const highestAverage = Math.max(...averages);
  const lowestAverage = Math.min(...averages);
  const passCount = students.filter((s) => s.passed).length;
  const failCount = students.length - passCount;
  const passRate = Math.round((passCount / students.length) * 10000) / 100;
  const topStudent = sorted[0]?.name ?? "";
  const weakestStudent = sorted[sorted.length - 1]?.name ?? "";

  const result = UploadGradesResponse.parse({
    students: ranked,
    summary: {
      classAverage,
      highestAverage,
      lowestAverage,
      passRate,
      passCount,
      failCount,
      topStudent,
      weakestStudent,
    },
    fileName: req.file.originalname,
    totalStudents: students.length,
  });

  req.log.info({ fileName: req.file.originalname, totalStudents: students.length }, "Grades analyzed");
  res.json(result);
});

export default router;
