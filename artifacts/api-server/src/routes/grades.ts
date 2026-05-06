import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import multer from "multer";
import * as XLSX from "xlsx";
import { db, subscriptionsTable } from "@workspace/db";
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

// Column name maps per subject per language
const SUBJECT_KEYS: Record<string, string[]> = {
  name: ["name", "Name", "الاسم", "اسم", "Nom", "النقب واللقب", "prenom nom"],
  arabic: ["arabic", "Arabic", "عربية", "اللغة العربية", "Arabe", "arab"],
  french: ["french", "French", "فرنسية", "اللغة الفرنسية", "Français", "francais"],
  math: ["math", "Math", "رياضيات", "Mathématiques", "maths", "mathematiques"],
  science: ["science", "Science", "علوم", "Sciences", "sciences naturelles"],
  islamic: ["islamic", "Islamic", "تربية إسلامية", "التربية الإسلامية", "education islamique", "islam"],
  history: ["history", "History", "تاريخ", "التاريخ والجغرافيا", "Histoire-Géographie", "histoire"],
  physics: ["physics", "Physics", "فيزياء", "الفيزياء والكيمياء", "Physique-Chimie", "physique"],
  philosophy: ["philosophy", "Philosophy", "فلسفة", "الفلسفة", "Philosophie"],
  english: ["english", "English", "إنجليزية", "اللغة الإنجليزية", "Anglais"],
};

// Subjects per school mode
const CEM_SUBJECTS = ["arabic", "french", "math", "science", "islamic", "history"];
const LYCEE_SUBJECTS = ["arabic", "french", "math", "science", "physics", "english"];

function getVal(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== "") return row[key];
    // case-insensitive search
    const found = Object.keys(row).find(
      (k) => k.toLowerCase() === key.toLowerCase(),
    );
    if (found !== undefined && row[found] !== "") return row[found];
  }
  return undefined;
}

const parseNum = (val: unknown): number => {
  const n = parseFloat(String(val));
  return isNaN(n) ? 0 : Math.max(0, Math.min(20, n));
};

const PASS_THRESHOLD = 10;

router.post(
  "/grades/upload",
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized. Please log in." });
      return;
    }

    // Get subscription
    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, req.user.id));

    const plan = sub?.plan ?? "gratuit";
    const schoolMode = (req.query.mode as string) || sub?.schoolMode || "cem";

    // Validate mode access
    if (schoolMode === "lycee" && plan !== "pro" && plan !== "max") {
      res
        .status(403)
        .json({ error: "Lycée mode requires a Pro or Max subscription." });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        error: "No file uploaded. Please upload an Excel file (.xlsx or .xls).",
      });
      return;
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    } catch {
      res.status(400).json({
        error:
          "Could not read the file. Please ensure it is a valid Excel file.",
      });
      return;
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      res
        .status(400)
        .json({ error: "The Excel file is empty or has no sheets." });
      return;
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    if (!rawRows || rawRows.length === 0) {
      res.status(400).json({
        error: "The sheet has no data. Please ensure the file has student rows.",
      });
      return;
    }

    // Enforce student limit for trial plan
    const rows =
      plan === "gratuit" ? rawRows.slice(0, 15) : rawRows;

    const activeSubjects =
      schoolMode === "lycee" ? LYCEE_SUBJECTS : CEM_SUBJECTS;

    const students = rows.map((row, i) => {
      const nameVal = getVal(row, SUBJECT_KEYS["name"]!);
      const name = String(nameVal ?? "").trim() || `Student ${i + 1}`;

      const subjects: Record<string, number> = {};
      for (const subj of activeSubjects) {
        const val = getVal(row, SUBJECT_KEYS[subj]!);
        subjects[subj] = parseNum(val);
      }

      const vals = Object.values(subjects);
      const average =
        Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) /
        100;
      const passed = average >= PASS_THRESHOLD;

      return { name, subjects, average, passed };
    });

    if (students.length === 0) {
      res.status(400).json({
        error:
          "No valid student data found. Check that columns include the required subjects.",
      });
      return;
    }

    const sorted = [...students].sort((a, b) => b.average - a.average);
    const ranked = students.map((s) => ({
      ...s,
      rank:
        sorted.findIndex(
          (x) => x.name === s.name && x.average === s.average,
        ) + 1,
    }));

    const averages = students.map((s) => s.average);
    const classAverage =
      Math.round(
        (averages.reduce((a, b) => a + b, 0) / averages.length) * 100,
      ) / 100;
    const highestAverage = Math.max(...averages);
    const lowestAverage = Math.min(...averages);
    const passCount = students.filter((s) => s.passed).length;
    const failCount = students.length - passCount;
    const passRate =
      Math.round((passCount / students.length) * 10000) / 100;
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
      schoolMode,
      subjects: activeSubjects,
    });

    req.log.info(
      { fileName: req.file.originalname, totalStudents: students.length, plan, schoolMode },
      "Grades analyzed",
    );
    res.json(result);
  },
);

export default router;
