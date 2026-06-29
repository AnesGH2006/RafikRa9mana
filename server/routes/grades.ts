import crypto from "crypto";
import { Router, type IRouter } from "express";
import { and, eq, inArray, or } from "drizzle-orm";
import { db, gradesTable, absencesTable, studentsTable } from "../../shared/db.js";
import { UpsertGradesBulkBody, UpsertAbsenceBody } from "../../shared/schemas.js";
import { getSubjectsForLevel, calcWeightedAvg } from "../../shared/subjects.js";
import type { Niveau } from "../../shared/types.js";

const router: IRouter = Router();

// ── GET /api/grades?studentId=&annee=&trimestre= ──────────────────────────────
router.get("/grades", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const { studentId, annee, trimestre } = req.query as Record<string, string>;
  const conds = [eq(gradesTable.userId, userId)];
  if (studentId) conds.push(eq(gradesTable.studentId, studentId));
  if (annee) conds.push(eq(gradesTable.annee, annee));
  if (trimestre) conds.push(eq(gradesTable.trimestre, parseInt(trimestre)));
  const rows = await db.select().from(gradesTable).where(and(...conds));
  res.json(rows.map(r => ({ ...r, score: parseFloat(String(r.score)) })));
});

// ── POST /api/grades/bulk ─────────────────────────────────────────────────────
// Accepts either:
//   { studentId, annee, trimestre, grades }          ← manual entry (existing)
//   { studentName, annee, trimestre, grades }         ← Excel import (new)
router.post("/grades/bulk", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;

  const { studentId, studentName, annee, trimestre, grades } = req.body as {
    studentId?: string;
    studentName?: string;
    annee: string;
    trimestre: number;
    grades: Record<string, number>;
  };

  if (!annee || !trimestre || !grades || typeof grades !== "object") {
    res.status(400).json({ error: "Missing required fields: annee, trimestre, grades" });
    return;
  }
  if (!studentId && !studentName) {
    res.status(400).json({ error: "Provide either studentId or studentName" });
    return;
  }

  // ── Resolve student ────────────────────────────────────────────────────────
  let student: typeof studentsTable.$inferSelect | undefined;

  if (studentId) {
    // Manual entry: look up by ID (original behaviour)
    const rows = await db.select().from(studentsTable)
      .where(and(eq(studentsTable.id, studentId), eq(studentsTable.userId, userId)));
    student = rows[0];
  } else {
    // Excel import: look up by name (normalize whitespace for safety)
    const name = (studentName ?? "").trim();
    const rows = await db.select().from(studentsTable)
      .where(and(eq(studentsTable.userId, userId), eq(studentsTable.nomPrenom, name)));
    student = rows[0];

    // Fallback: try removing double spaces / different spacing
    if (!student) {
      const allStudents = await db.select().from(studentsTable)
        .where(eq(studentsTable.userId, userId));
      student = allStudents.find(s =>
        s.nomPrenom.replace(/\s+/g, " ").trim() === name.replace(/\s+/g, " ").trim()
      );
    }
  }

  if (!student) {
    res.status(404).json({ error: `Student not found: ${studentId ?? studentName}` });
    return;
  }

  // ── Update raqm if provided via Excel import ──────────────────────────────
  const raqm = (req.body as any).raqm as number | undefined;
  if (raqm && !studentId) {
    await db.update(studentsTable)
      .set({ raqm })
      .where(and(eq(studentsTable.id, student.id), eq(studentsTable.userId, userId)));
  }

  // ── Upsert grades ─────────────────────────────────────────────────────────
  await db.delete(gradesTable).where(and(
    eq(gradesTable.userId, userId),
    eq(gradesTable.studentId, student.id),
    eq(gradesTable.annee, annee),
    eq(gradesTable.trimestre, trimestre),
  ));

  // Allow grade 0 — it is a valid score (student attempted subject and scored zero).
  // Only exclude NaN / non-numeric / out-of-range values.
  const validGrades = Object.entries(grades).filter(([, score]) =>
    typeof score === "number" && !isNaN(score) && score >= 0 && score <= 20
  );

  if (validGrades.length > 0) {
    await db.insert(gradesTable).values(
      validGrades.map(([subject, score]) => ({
        id: crypto.randomBytes(8).toString("hex"),
        userId,
        studentId: student!.id,
        annee,
        trimestre,
        subject,
        score: String(Math.max(0, Math.min(20, score))),
      }))
    );
  }

  req.log.info(
    { studentId: student.id, studentName: student.nomPrenom, trimestre, count: validGrades.length },
    "Grades saved"
  );
  res.json({ success: true, studentId: student.id, saved: validGrades.length });
});

// ── POST /api/grades/batch-import ────────────────────────────────────────────
// Saves ALL students' grades in a single request instead of N×3 sequential calls.
// Body: { annee, students: [{ studentName, raqm?, trimesters: { "1"?: Record<subject,score>, "2"?: ..., "3"?: ... }, triAvgs?: { "1"?: number, "2"?: number, "3"?: number } }] }
// Special subject key used to store Ministry-provided trimester averages verbatim.
// When present, /api/results uses this value instead of recalculating from raw scores.
const AVG_SUBJECT = "__avg__";

router.post("/grades/batch-import", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const { annee, students } = req.body as {
    annee: string;
    students: Array<{
      studentName: string;
      raqm?: number;
      trimesters: Record<string, Record<string, number>>;
      // Ministry pre-calculated averages per trimestre (authoritative)
      triAvgs?: Record<string, number | null>;
    }>;
  };

  if (!annee || !Array.isArray(students) || students.length === 0) {
    res.status(400).json({ error: "Missing annee or students array" });
    return;
  }

  // ── 1. Load all students for this user at once ────────────────────────────
  const allStudents = await db.select().from(studentsTable)
    .where(eq(studentsTable.userId, userId));

  const normalize = (n: string) => n.replace(/\s+/g, " ").trim();
  const studentByName = new Map(allStudents.map(s => [normalize(s.nomPrenom), s]));

  // ── 2. Build insert rows ───────────────────────────────────────────────────
  const toDelete: Array<{ studentId: string; trimestre: number }> = [];
  const toInsert: Array<{
    id: string; userId: string; studentId: string;
    annee: string; trimestre: number; subject: string; score: string;
  }> = [];
  const raqmUpdates: Array<{ studentId: string; raqm: number }> = [];

  let savedCount = 0;
  const errors: string[] = [];

  for (const s of students) {
    const student = studentByName.get(normalize(s.studentName));
    if (!student) { errors.push(s.studentName); continue; }

    if (s.raqm && !student.raqm) {
      raqmUpdates.push({ studentId: student.id, raqm: s.raqm });
    }

    for (const [triStr, grades] of Object.entries(s.trimesters)) {
      const tri = parseInt(triStr);
      if (isNaN(tri)) continue;

      const validGrades = Object.entries(grades).filter(([, score]) =>
        typeof score === "number" && !isNaN(score) && score >= 0 && score <= 20
      );
      if (validGrades.length === 0) continue;

      toDelete.push({ studentId: student.id, trimestre: tri });

      // Raw subject scores
      for (const [subject, score] of validGrades) {
        toInsert.push({
          id: crypto.randomBytes(8).toString("hex"),
          userId, studentId: student.id, annee, trimestre: tri,
          subject, score: String(Math.max(0, Math.min(20, score))),
        });
      }

      // Store Ministry pre-calculated average as a sentinel row (__avg__)
      // so /api/results can use it directly without recalculating from raw scores.
      const providedAvg = s.triAvgs?.[String(tri)];
      if (typeof providedAvg === "number" && !isNaN(providedAvg) && providedAvg >= 0) {
        toInsert.push({
          id: crypto.randomBytes(8).toString("hex"),
          userId, studentId: student.id, annee, trimestre: tri,
          subject: AVG_SUBJECT,
          score: String(Math.round(providedAvg * 100) / 100),
        });
      }
    }
    savedCount++;
  }

  // ── 3. Execute: delete stale grades, bulk-insert new ones ─────────────────
  for (const { studentId, trimestre } of toDelete) {
    await db.delete(gradesTable).where(and(
      eq(gradesTable.userId, userId),
      eq(gradesTable.studentId, studentId),
      eq(gradesTable.annee, annee),
      eq(gradesTable.trimestre, trimestre),
    ));
  }

  const CHUNK = 500;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    await db.insert(gradesTable).values(toInsert.slice(i, i + CHUNK));
  }

  for (const { studentId, raqm } of raqmUpdates) {
    await db.update(studentsTable).set({ raqm }).where(
      and(eq(studentsTable.id, studentId), eq(studentsTable.userId, userId))
    );
  }

  req.log.info(
    { saved: savedCount, gradeRows: toInsert.length, notFound: errors.length },
    "Batch import complete"
  );
  res.json({ success: true, saved: savedCount, gradeRows: toInsert.length, notFound: errors });
});

// ── GET /api/results ──────────────────────────────────────────────────────────
router.get("/results", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const { annee, niveau, classe } = req.query as Record<string, string>;

  const studentConds = [eq(studentsTable.userId, userId)];
  if (annee) studentConds.push(eq(studentsTable.annee, annee));
  if (niveau) studentConds.push(eq(studentsTable.niveau, niveau as Niveau));
  if (classe) studentConds.push(eq(studentsTable.classe, classe));

  const students = await db.select().from(studentsTable)
    .where(and(...studentConds))
    .orderBy(studentsTable.niveau, studentsTable.classe, studentsTable.raqm, studentsTable.nomPrenom);

  if (!students.length) { res.json([]); return; }

  const studentIds = students.map(s => s.id);
  const allGrades = await db.select().from(gradesTable).where(
    and(eq(gradesTable.userId, userId), inArray(gradesTable.studentId, studentIds))
  );
  const allAbsences = await db.select().from(absencesTable).where(
    and(eq(absencesTable.userId, userId), inArray(absencesTable.studentId, studentIds))
  );

  // gradeMap: studentId → trimestre → subject → score
  // storedAvgMap: studentId → trimestre → pre-calculated Ministry average (from __avg__ sentinel)
  const gradeMap: Record<string, Record<string, Record<string, number>>> = {};
  const storedAvgMap: Record<string, Record<string, number>> = {};

  for (const g of allGrades) {
    if (g.subject === AVG_SUBJECT) {
      // Ministry-provided trimester average — use verbatim, do not recalculate
      storedAvgMap[g.studentId] ??= {};
      storedAvgMap[g.studentId]![String(g.trimestre)] = parseFloat(String(g.score));
    } else {
      gradeMap[g.studentId] ??= {};
      gradeMap[g.studentId][String(g.trimestre)] ??= {};
      gradeMap[g.studentId][String(g.trimestre)]![g.subject] = parseFloat(String(g.score));
    }
  }

  const absMap: Record<string, { j: number; u: number }> = {};
  for (const a of allAbsences) {
    absMap[a.studentId] ??= { j: 0, u: 0 };
    absMap[a.studentId]!.j += a.justifiedHours;
    absMap[a.studentId]!.u += a.unjustifiedHours;
  }

  const results = students.map(s => {
    const scores = gradeMap[s.id] ?? {};
    const storedAvgs = storedAvgMap[s.id] ?? {};
    const subs = getSubjectsForLevel(s.niveau as Niveau);

    // Prefer Ministry-provided average (stored as __avg__) over recalculation.
    // Fall back to calcWeightedAvg for manually-entered grades.
    const t1Avg = storedAvgs["1"] ?? calcWeightedAvg(scores["1"] ?? {}, subs);
    const t2Avg = storedAvgs["2"] ?? calcWeightedAvg(scores["2"] ?? {}, subs);
    const t3Avg = storedAvgs["3"] ?? calcWeightedAvg(scores["3"] ?? {}, subs);

    const avgs = [t1Avg, t2Avg, t3Avg].filter((v): v is number => v !== null);
    const annualAvg = avgs.length > 0
      ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 100) / 100
      : null;
    const passed = annualAvg !== null ? annualAvg >= 10 : null;
    const abs = absMap[s.id] ?? { j: 0, u: 0 };

    return {
      student: s, scores,
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
    const sorted = [...group]
      .filter(r => r.annualAvg !== null)
      .sort((a, b) => (b.annualAvg ?? 0) - (a.annualAvg ?? 0));
    sorted.forEach((r, i) => { r.rank = i + 1; });
  }

  res.json(results);
});

// ── GET /api/results/subjects ─────────────────────────────────────────────────
router.get("/results/subjects", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const { annee, niveau, classe, trimestre } = req.query as Record<string, string>;

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

  const subs = getSubjectsForLevel((niveau as Niveau) ?? "4AM");
  const result = subs.map(s => {
    const scores = bySubject[s.key] ?? [];
    const avg = scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : 0;
    return {
      subject: s.key, arLabel: s.arLabel, avg,
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
  const { annee, studentId } = req.query as Record<string, string>;
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