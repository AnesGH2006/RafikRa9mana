import crypto from "crypto";
import { Router, type IRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { eq, and, inArray } from "drizzle-orm";
import { db, studentsTable, gradesTable, orientationWishesTable } from "../../shared/db.js";
import { ImportOrientationWishesResponse } from "../../shared/schemas.js";
import type { Niveau } from "../../shared/types.js";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Normalisation (mirrors students.ts) ───────────────────────────────────────
function norm(s: string): string {
  return String(s ?? "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
    .replace(/[أإآا]/g, "ا")
    .replace(/[ةه]/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Split a "الرغبات" cell like "1 -جذع مشترك علوم و تكنولوجيا2 -جذع مشترك آداب3 -تعليم مهني4 -تكوين مهني"
// into an ordered array of choice labels.
function parseChoices(cell: string): string[] {
  const text = String(cell ?? "");
  const parts = text.split(/\d+\s*-/).map(p => p.trim()).filter(Boolean);
  return parts;
}

function suggestTrack(annualAvg: number | null, _scores: Record<string, number>): string | null {
  if (annualAvg === null) return null;
  if (annualAvg < 8)  return "تكوين مهني";
  if (annualAvg < 10) return "تعليم مهني";
  if (annualAvg >= 14) return "جذع مشترك علوم";
  return "جذع مشترك آداب وفلسفة";
}

// ── POST /api/orientation/wishes/import ────────────────────────────────────────
router.post("/orientation/wishes/import", upload.array("files", 20), async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const annee = String((req.body as any).annee ?? "").trim();
  if (!annee) { res.status(400).json({ error: "annee مطلوبة" }); return; }

  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) { res.status(400).json({ error: "لم يتم إرفاق أي ملف" }); return; }

  const students = await db.select().from(studentsTable)
    .where(and(eq(studentsTable.userId, userId), eq(studentsTable.annee, annee), eq(studentsTable.niveau, "4AM" as Niveau)));

  const seenNationalIds = new Set<string>();
  const toInsert: (typeof orientationWishesTable.$inferInsert)[] = [];
  const unmatched: string[] = [];
  let matched = 0;

  for (const file of files) {
    let rows: any[][];
    try {
      const wb = XLSX.read(file.buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]!];
      if (!ws) continue;
      rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    } catch {
      continue;
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]!;
      const [rawNationalId, lastName, firstName, birthDate, wishesCell] = row;
      const nationalId = rawNationalId ? String(rawNationalId).trim() : "";
      const last = String(lastName ?? "").trim();
      const first = String(firstName ?? "").trim();
      if (!last && !first) continue;

      const dedupeKey = nationalId || `${norm(last)}|${norm(first)}`;
      if (seenNationalIds.has(dedupeKey)) continue;
      seenNationalIds.add(dedupeKey);

      const choices = parseChoices(wishesCell);

      const fullNameA = norm(`${last} ${first}`);
      const fullNameB = norm(`${first} ${last}`);
      const student = students.find(s => {
        const n = norm(s.nomPrenom);
        return n === fullNameA || n === fullNameB;
      });

      if (student) matched++;
      else unmatched.push(`${last} ${first}`.trim());

      toInsert.push({
        id: crypto.randomUUID(),
        userId,
        annee,
        nationalId: nationalId || null,
        lastName: last,
        firstName: first,
        birthDate: birthDate ? String(birthDate).trim() : null,
        choices,
        studentId: student?.id ?? null,
      });
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(orientationWishesTable).where(
      and(eq(orientationWishesTable.userId, userId), eq(orientationWishesTable.annee, annee))
    );
    const CHUNK = 500;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      await tx.insert(orientationWishesTable).values(toInsert.slice(i, i + CHUNK));
    }
  });

  res.json(ImportOrientationWishesResponse.parse({
    success: true,
    imported: toInsert.length,
    matched,
    unmatched,
  }));
});

// ── GET /api/orientation/wishes ─────────────────────────────────────────────────
router.get("/orientation/wishes", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const annee = String((req.query as any).annee ?? "").trim();
  if (!annee) { res.status(400).json({ error: "annee مطلوبة" }); return; }

  const wishes = await db.select().from(orientationWishesTable)
    .where(and(eq(orientationWishesTable.userId, userId), eq(orientationWishesTable.annee, annee)));

  const studentIds = wishes.map(w => w.studentId).filter((id): id is string => !!id);
  const students = studentIds.length
    ? await db.select().from(studentsTable).where(and(eq(studentsTable.userId, userId), inArray(studentsTable.id, studentIds)))
    : [];
  const studentMap = new Map(students.map(s => [s.id, s]));

  const grades = studentIds.length
    ? await db.select().from(gradesTable).where(and(eq(gradesTable.userId, userId), inArray(gradesTable.studentId, studentIds)))
    : [];

  // gradeMap: studentId → trimestre → subject → score (mirrors /api/results)
  const gradeMap: Record<string, Record<string, Record<string, number>>> = {};
  const storedAvgMap: Record<string, Record<string, number>> = {};
  const AVG_SUBJECT = "__avg__";
  for (const g of grades) {
    if (g.subject === AVG_SUBJECT) {
      storedAvgMap[g.studentId] ??= {};
      storedAvgMap[g.studentId]![String(g.trimestre)] = parseFloat(String(g.score));
    } else {
      gradeMap[g.studentId] ??= {};
      gradeMap[g.studentId][String(g.trimestre)] ??= {};
      gradeMap[g.studentId][String(g.trimestre)]![g.subject] = parseFloat(String(g.score));
    }
  }

  const subs4AM = getSubjectsForLevel("4AM");
  const result = wishes.map(w => {
    const student = w.studentId ? studentMap.get(w.studentId) ?? null : null;
    let annualAvg: number | null = null;
    let latestScores: Record<string, number> = {};
    if (student) {
      const scores = gradeMap[student.id] ?? {};
      const storedAvgs = storedAvgMap[student.id] ?? {};
      const t1 = storedAvgs["1"] ?? calcWeightedAvg(scores["1"] ?? {}, subs4AM);
      const t2 = storedAvgs["2"] ?? calcWeightedAvg(scores["2"] ?? {}, subs4AM);
      const t3 = storedAvgs["3"] ?? calcWeightedAvg(scores["3"] ?? {}, subs4AM);
      const avgs = [t1, t2, t3].filter((v): v is number => v !== null);
      annualAvg = avgs.length > 0 ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 100) / 100 : null;
      // use the most recent trimester with data for the science/literary heuristic
      latestScores = scores["3"] ?? scores["2"] ?? scores["1"] ?? {};
    }
    const suggestedTrack = student ? suggestTrack(annualAvg, latestScores) : null;
    const firstChoice = w.choices[0] ?? null;
    const firstChoiceMatchesSuggestion = suggestedTrack && firstChoice
      ? norm(firstChoice) === norm(suggestedTrack)
      : null;

    return {
      id: w.id,
      annee: w.annee,
      nationalId: w.nationalId,
      lastName: w.lastName,
      firstName: w.firstName,
      birthDate: w.birthDate,
      choices: w.choices,
      studentId: w.studentId,
      matchedStudent: student,
      annualAvg,
      suggestedTrack,
      firstChoiceMatchesSuggestion,
    };
  });

  result.sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`, "ar"));

  res.json(result);
});

export default router;
