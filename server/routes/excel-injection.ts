import { Router } from "express";
import multer from "multer";
import { and, eq, inArray } from "drizzle-orm";
import { db, absencesTable, gradesTable, studentsTable } from "../../shared/db.js";
import { injectStudentValuesIntoWorkbook, inspectExcelTemplate, type ExcelInjectionOptions, type StudentCellPayload } from "../lib/excel-injection.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});

router.post("/excel-injection/inspect", upload.single("template"), async (req, res): Promise<void> => {
  if (!req.isAuthenticated() || !req.user || req.memberContext) { res.status(403).json({ error: "مسؤول المؤسسة فقط" }); return; }
  if (!req.file) { res.status(400).json({ error: "ارفع القالب أولاً" }); return; }
  try {
    const result = await inspectExcelTemplate(req.file.buffer, {
      worksheetName: typeof req.body?.worksheetName === "string" ? req.body.worksheetName : undefined,
      headerRow: Number(req.body?.headerRow) || 1,
      dataStartRow: Number(req.body?.dataStartRow) || 2,
      studentIdHeader: typeof req.body?.studentIdHeader === "string" ? req.body.studentIdHeader : "Matricule",
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "تعذر قراءة القالب" });
  }
});

router.get("/excel-injection/school-data", async (req, res): Promise<void> => {
  if (!req.isAuthenticated() || !req.user || req.memberContext) { res.status(403).json({ error: "مسؤول المؤسسة فقط" }); return; }
  const annee = String(req.query.annee ?? "2025-2026");
  const niveau = typeof req.query.niveau === "string" ? req.query.niveau : undefined;
  const conditions = [eq(studentsTable.userId, req.user.id), eq(studentsTable.annee, annee)];
  if (niveau) conditions.push(eq(studentsTable.niveau, niveau as never));
  const students = await db.select().from(studentsTable).where(and(...conditions));
  const ids = students.map(student => student.id);
  if (!ids.length) { res.json({ rows: [], fields: [] }); return; }
  const [grades, absences] = await Promise.all([
    db.select().from(gradesTable).where(and(eq(gradesTable.userId, req.user.id), inArray(gradesTable.studentId, ids), eq(gradesTable.annee, annee))),
    db.select().from(absencesTable).where(and(eq(absencesTable.userId, req.user.id), inArray(absencesTable.studentId, ids), eq(absencesTable.annee, annee))),
  ]);
  const averageMap = new Map<string, Record<string, number>>();
  for (const grade of grades) {
    const score = Number(grade.score);
    if (!Number.isFinite(score)) continue;
    const map = averageMap.get(grade.studentId) ?? {};
    const key = grade.subject === "__avg__" ? `t${grade.trimestre}_average` : `t${grade.trimestre}_score`;
    map[key] = score;
    averageMap.set(grade.studentId, map);
  }
  const absenceMap = new Map<string, { justified_hours: number; unjustified_hours: number }>();
  for (const absence of absences) {
    const current = absenceMap.get(absence.studentId) ?? { justified_hours: 0, unjustified_hours: 0 };
    current.justified_hours += absence.justifiedHours;
    current.unjustified_hours += absence.unjustifiedHours;
    absenceMap.set(absence.studentId, current);
  }
  const rows = students.map(student => {
    const averages = averageMap.get(student.id) ?? {};
    const annualValues = [averages.t1_average, averages.t2_average, averages.t3_average].filter((value): value is number => value !== undefined);
    const absence = absenceMap.get(student.id) ?? { justified_hours: 0, unjustified_hours: 0 };
    return {
      student_id: student.raqm ?? student.id,
      name: student.nomPrenom,
      value: annualValues.length ? Number((annualValues.reduce((sum, value) => sum + value, 0) / annualValues.length).toFixed(2)) : null,
      values: { ...averages, annual_average: annualValues.length ? Number((annualValues.reduce((sum, value) => sum + value, 0) / annualValues.length).toFixed(2)) : null, ...absence },
    };
  });
  res.json({ rows, fields: ["value", "t1_average", "t2_average", "t3_average", "annual_average", "justified_hours", "unjustified_hours"] });
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
      "X-Excel-Skip-Report": encodeURIComponent(JSON.stringify(result.skipped.slice(0, 100))),
    });
    res.send(result.buffer);
  } catch (error) {
    req.log.error({ error }, "Excel injection failed");
    res.status(400).json({ error: error instanceof Error ? error.message : "تعذر معالجة ملف Excel" });
  }
});

export default router;