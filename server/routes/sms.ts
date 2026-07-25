import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, studentsTable, gradesTable, absencesTable } from "../../shared/db.js";
import { getSubjectsForLevel, calcWeightedAvg } from "../../shared/subjects.js";
import type { Niveau } from "../../shared/types.js";

const router: IRouter = Router();

// ── GET /api/sms/alerts ───────────────────────────────────────────────────────
// Returns students that need an SMS message — either an alert or a
// congratulation:
//   - avgBelow10:  annual weighted average < 10
//   - highAbsence: total unjustified hours >= threshold (default 10)
//   - mustarrak:   average between 9.00–9.99 (borderline)
//   - passed:      annual weighted average >= 10 (congratulation candidate)
// Each student can have multiple reasons (e.g. passed + high_absence).
router.get("/sms/alerts", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const annee = (req.query.annee as string) || "2025-2026";
  const absThreshold = parseInt((req.query.absThreshold as string) || "10");

  // ── 1. Fetch all students for this user/year ────────────────────────────────
  const students = await db.select().from(studentsTable)
    .where(and(eq(studentsTable.userId, userId), eq(studentsTable.annee, annee)));

  if (!students.length) { res.set("Cache-Control", "no-store"); res.json([]); return; }

  // ── 2. Fetch all grades for these students ──────────────────────────────────
  const grades = await db.select().from(gradesTable)
    .where(and(eq(gradesTable.userId, userId), eq(gradesTable.annee, annee)));

  // ── 3. Fetch all absences for these students ────────────────────────────────
  const absences = await db.select().from(absencesTable)
    .where(and(eq(absencesTable.userId, userId), eq(absencesTable.annee, annee)));

  // ── 4. Group grades by student + trimestre ─────────────────────────────────
  const gradesByStudent = new Map<string, Map<number, Record<string, number>>>();
  for (const g of grades) {
    if (!gradesByStudent.has(g.studentId)) gradesByStudent.set(g.studentId, new Map());
    const byTrim = gradesByStudent.get(g.studentId)!;
    if (!byTrim.has(g.trimestre)) byTrim.set(g.trimestre, {});
    byTrim.get(g.trimestre)![g.subject] = parseFloat(String(g.score));
  }

  // ── 5. Group absences by student ───────────────────────────────────────────
  const absencesByStudent = new Map<string, { justified: number; unjustified: number }>();
  for (const a of absences) {
    const cur = absencesByStudent.get(a.studentId) ?? { justified: 0, unjustified: 0 };
    cur.justified += a.justifiedHours;
    cur.unjustified += a.unjustifiedHours;
    absencesByStudent.set(a.studentId, cur);
  }

  // ── 6. Compute per-student annual average ──────────────────────────────────
  type AlertReason = "avg_below_10" | "high_absence" | "mustarrak" | "passed";
  interface AlertRow {
    id: string;
    nomPrenom: string;
    niveau: string;
    classe: string;
    annee: string;
    parentPhone: string | null;
    annualAvg: number | null;
    unjustifiedHours: number;
    justifiedHours: number;
    reasons: AlertReason[];
  }

  const results: AlertRow[] = [];

  for (const s of students) {
    const byTrim = gradesByStudent.get(s.id);
    let annualAvg: number | null = null;

    if (byTrim && byTrim.size > 0) {
      const trimAvgs: number[] = [];
      // ✅ FIX: calcWeightedAvg expects a Subject[] array (from
      // getSubjectsForLevel), not the raw niveau string. Passing the
      // string directly made the function iterate over its characters
      // ('3','A','M'), find no matching .key, and always return null —
      // which meant NO student ever had an annualAvg, and the alerts
      // list was always empty regardless of real data.
      const subjects = getSubjectsForLevel(s.niveau as Niveau);
      for (const [, gradeMap] of byTrim) {
        const avg = calcWeightedAvg(gradeMap, subjects);
        if (avg !== null) trimAvgs.push(avg);
      }
      if (trimAvgs.length > 0) {
        annualAvg = Math.round((trimAvgs.reduce((a, b) => a + b, 0) / trimAvgs.length) * 100) / 100;
      }
    }

    const abs = absencesByStudent.get(s.id) ?? { justified: 0, unjustified: 0 };
    const reasons: AlertReason[] = [];

    if (annualAvg !== null && annualAvg >= 9.0 && annualAvg < 10.0) reasons.push("mustarrak");
    else if (annualAvg !== null && annualAvg < 10.0) reasons.push("avg_below_10");
    else if (annualAvg !== null && annualAvg >= 10.0) reasons.push("passed");

    if (abs.unjustified >= absThreshold) reasons.push("high_absence");

    if (reasons.length > 0) {
      results.push({
        id: s.id,
        nomPrenom: s.nomPrenom,
        niveau: s.niveau,
        classe: s.classe,
        annee: s.annee,
        parentPhone: s.parentPhone ?? null,
        annualAvg,
        unjustifiedHours: abs.unjustified,
        justifiedHours: abs.justified,
        reasons,
      });
    }
  }

  // Sort: students without phone first, then by annual avg ascending
  // (weakest students surface first — passing students naturally sort last)
  results.sort((a, b) => {
    if (!a.parentPhone && b.parentPhone) return -1;
    if (a.parentPhone && !b.parentPhone) return 1;
    return (a.annualAvg ?? 99) - (b.annualAvg ?? 99);
  });

  res.set("Cache-Control", "no-store");
  res.json(results);
});

// ── PATCH /api/students/:id/phone ─────────────────────────────────────────────
// Update (or set) a student's parent phone number
router.patch("/students/:id/phone", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const { id } = req.params;
  const { phone } = req.body as { phone?: string };

  if (!id) { res.status(400).json({ error: "Missing student id" }); return; }

  const cleaned = (phone ?? "").replace(/\s+/g, "");
  if (cleaned && !/^[+0-9()\-]{7,20}$/.test(cleaned)) {
    res.status(400).json({ error: "رقم الهاتف غير صالح" });
    return;
  }

  const [updated] = await db
    .update(studentsTable)
    .set({ parentPhone: cleaned || null })
    .where(and(eq(studentsTable.id, id), eq(studentsTable.userId, userId)))
    .returning({ id: studentsTable.id, parentPhone: studentsTable.parentPhone });

  if (!updated) { res.status(404).json({ error: "Student not found" }); return; }
  res.json({ success: true, parentPhone: updated.parentPhone });
});

export default router;