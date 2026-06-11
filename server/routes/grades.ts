import crypto from "crypto";
import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, gradesTable, absencesTable, studentsTable } from "../../shared/db.js";
import { UpsertGradesBulkBody, UpsertAbsenceBody } from "../../shared/schemas.js";
import { getSubjectsForLevel, calcWeightedAvg } from "../../shared/subjects.js";
import type { Niveau } from "../../shared/types.js";

const router: IRouter = Router();

// ── GET /api/grades?studentId=&annee=&trimestre= ──────────────────────────────
router.get("/grades", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const { studentId, annee, trimestre } = req.query as Record<string,string>;
  const conds = [eq(gradesTable.userId, userId)];
  if (studentId) conds.push(eq(gradesTable.studentId, studentId));
  if (annee) conds.push(eq(gradesTable.annee, annee));
  if (trimestre) conds.push(eq(gradesTable.trimestre, parseInt(trimestre)));
  const rows = await db.select().from(gradesTable).where(and(...conds));
  res.json(rows.map(r => ({ ...r, score: parseFloat(String(r.score)) })));
});

// ── POST /api/grades/bulk — upsert all subjects for one student/trimestre ─────
router.post("/grades/bulk", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const body = UpsertGradesBulkBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid data", details: body.error.flatten() }); return; }
  const { studentId, annee, trimestre, grades } = body.data;

  // Verify student belongs to user
  const [student] = await db.select().from(studentsTable)
    .where(and(eq(studentsTable.id, studentId), eq(studentsTable.userId, userId)));
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  // Delete existing grades for this student/trimestre/annee then re-insert
  await db.delete(gradesTable).where(and(
    eq(gradesTable.userId, userId),
    eq(gradesTable.studentId, studentId),
    eq(gradesTable.annee, annee),
    eq(gradesTable.trimestre, trimestre),
  ));

  if (Object.keys(grades).length > 0) {
    await db.insert(gradesTable).values(
      Object.entries(grades).map(([subject, score]) => ({
        id: crypto.randomBytes(8).toString("hex"),
        userId, studentId, annee, trimestre, subject,
        score: String(Math.max(0, Math.min(20, score))),
      }))
    );
  }

  req.log.info({ studentId, trimestre, count: Object.keys(grades).length }, "Grades saved");
  res.json({ success: true });
});

// ── GET /api/results — computed results for all students ──────────────────────
router.get("/results", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const { annee, niveau, classe } = req.query as Record<string,string>;

  const studentConds = [eq(studentsTable.userId, userId)];
  if (annee) studentConds.push(eq(studentsTable.annee, annee));
  if (niveau) studentConds.push(eq(studentsTable.niveau, niveau as Niveau));
  if (classe) studentConds.push(eq(studentsTable.classe, classe));

  const students = await db.select().from(studentsTable).where(and(...studentConds))
    .orderBy(studentsTable.niveau, studentsTable.classe, studentsTable.nomPrenom);

  if (!students.length) { res.json([]); return; }

  const studentIds = students.map(s => s.id);
  const allGrades = await db.select().from(gradesTable).where(
    and(eq(gradesTable.userId, userId), inArray(gradesTable.studentId, studentIds))
  );
  const allAbsences = await db.select().from(absencesTable).where(
    and(eq(absencesTable.userId, userId), inArray(absencesTable.studentId, studentIds))
  );

  // Build grade map: studentId → trimestre → subject → score
  const gradeMap: Record<string, Record<string, Record<string, number>>> = {};
  for (const g of allGrades) {
    gradeMap[g.studentId] ??= {};
    gradeMap[g.studentId][String(g.trimestre)] ??= {};
    gradeMap[g.studentId][String(g.trimestre)]![g.subject] = parseFloat(String(g.score));
  }

  // Build absence map: studentId → totals
  const absMap: Record<string, { j: number; u: number }> = {};
  for (const a of allAbsences) {
    absMap[a.studentId] ??= { j: 0, u: 0 };
    absMap[a.studentId]!.j += a.justifiedHours;
    absMap[a.studentId]!.u += a.unjustifiedHours;
  }

  const results = students.map(s => {
    const scores = gradeMap[s.id] ?? {};
    const subs = getSubjectsForLevel(s.niveau as Niveau);

    const t1Avg = calcWeightedAvg(scores["1"] ?? {}, subs);
    const t2Avg = calcWeightedAvg(scores["2"] ?? {}, subs);
    const t3Avg = calcWeightedAvg(scores["3"] ?? {}, subs);

    const avgs = [t1Avg, t2Avg, t3Avg].filter((v): v is number => v !== null);
    const annualAvg = avgs.length > 0 ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 100) / 100 : null;
    const passed = annualAvg !== null ? annualAvg >= 10 : null;
    const abs = absMap[s.id] ?? { j: 0, u: 0 };

    return {
      student: s,
      scores,
      t1Avg, t2Avg, t3Avg, annualAvg, passed,
      rank: null as number | null,
      totalJustified: abs.j,
      totalUnjustified: abs.u,
    };
  });

  // Rank within each class
  const byClass: Record<string, typeof results> = {};
  for (const r of results) {
    const key = `${r.student.niveau}-${r.student.classe}`;
    byClass[key] ??= [];
    byClass[key]!.push(r);
  }
  for (const group of Object.values(byClass)) {
    const sorted = [...group].filter(r => r.annualAvg !== null).sort((a, b) => (b.annualAvg ?? 0) - (a.annualAvg ?? 0));
    sorted.forEach((r, i) => { r.rank = i + 1; });
  }

  res.json(results);
});

// ── GET /api/results/subjects ─────────────────────────────────────────────────
router.get("/results/subjects", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const { annee, niveau, classe, trimestre } = req.query as Record<string,string>;

  const studentConds = [eq(studentsTable.userId, userId)];
  if (annee) studentConds.push(eq(studentsTable.annee, annee));
  if (niveau) studentConds.push(eq(studentsTable.niveau, niveau as Niveau));
  if (classe) studentConds.push(eq(studentsTable.classe, classe));
  const students = await db.select().from(studentsTable).where(and(...studentConds));
  if (!students.length) { res.json([]); return; }

  const studentIds = students.map(s => s.id);
  const gradeConds = [eq(gradesTable.userId, userId), inArray(gradesTable.studentId, studentIds)];
  if (trimestre) gradeConds.push(eq(gradesTable.trimestre, parseInt(trimestre)));
  const grades = await db.select().from(gradesTable).where(and(...gradeConds));

  const bySubject: Record<string, number[]> = {};
  for (const g of grades) {
    bySubject[g.subject] ??= [];
    bySubject[g.subject]!.push(parseFloat(String(g.score)));
  }

  const subs = getSubjectsForLevel(niveau as Niveau ?? "4AM");
  const result = subs.map(s => {
    const scores = bySubject[s.key] ?? [];
    const avg = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0;
    return {
      subject: s.key,
      arLabel: s.arLabel,
      avg,
      min: scores.length ? Math.min(...scores) : 0,
      max: scores.length ? Math.max(...scores) : 0,
      passCount: scores.filter(v => v >= 10).length,
      total: scores.length,
    };
  }).filter(s => s.total > 0);

  res.json(result);
});

// ── Absences ──────────────────────────────────────────────────────────────────
router.get("/absences", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const { annee, studentId } = req.query as Record<string,string>;
  const conds = [eq(absencesTable.userId, userId)];
  if (annee) conds.push(eq(absencesTable.annee, annee));
  if (studentId) conds.push(eq(absencesTable.studentId, studentId));
  const rows = await db.select().from(absencesTable).where(and(...conds));
  res.json(rows);
});

router.post("/absences", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const body = UpsertAbsenceBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid data" }); return; }
  const { studentId, annee, trimestre, justifiedHours, unjustifiedHours } = body.data;

  await db.delete(absencesTable).where(and(
    eq(absencesTable.userId, userId),
    eq(absencesTable.studentId, studentId),
    eq(absencesTable.annee, annee),
    eq(absencesTable.trimestre, trimestre),
  ));

  const [row] = await db.insert(absencesTable).values({
    id: crypto.randomBytes(8).toString("hex"),
    userId, studentId, annee, trimestre, justifiedHours, unjustifiedHours,
  }).returning();

  res.json(row);
});

export default router;
