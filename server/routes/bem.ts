import { Router, type IRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xlsx|xls)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error("Only .xlsx/.xls files are allowed"));
  },
});

// BEM subjects with coefficients
const BEM_SUBJECTS = [
  { key: "arabic",  arLabel: "اللغة العربية",                  coef: 5,
    aliases: ["عربية", "اللغة العربية", "عربي", "arab", "arabe", "الع", "ع"] },
  { key: "french",  arLabel: "اللغة الفرنسية",                  coef: 3,
    aliases: ["فرنسية", "اللغة الفرنسية", "فرنسي", "french", "français", "francais", "الف", "ف"] },
  { key: "math",    arLabel: "الرياضيات",                       coef: 4,
    aliases: ["رياضيات", "الرياضيات", "math", "maths", "mathematiques", "الر", "ر"] },
  { key: "science", arLabel: "علوم الطبيعة والحياة",            coef: 2,
    aliases: ["علوم ط", "علوم الطبيعة", "علوم طبيعية", "sciences", "svt", "علوم طبيعة", "ع ط", "علوم"] },
  { key: "physics", arLabel: "العلوم الفيزيائية والتكنولوجية", coef: 2,
    aliases: ["فيزياء", "فيزياء وتكنولوجيا", "العلوم الفيزيائية", "physique", "physics", "ع ف", "فيز", "تكنولوجيا"] },
  { key: "history", arLabel: "التاريخ والجغرافيا",              coef: 3,
    aliases: ["تاريخ", "التاريخ والجغرافيا", "تاريخ وجغرافيا", "histoire", "history", "الت", "جغرافيا"] },
  { key: "islamic", arLabel: "التربية الإسلامية",               coef: 2,
    aliases: ["إسلامية", "التربية الإسلامية", "اسلامية", "islamic", "islam", "ت إسلامية", "ت ا", "تربية إسلامية"] },
  { key: "civic",   arLabel: "التربية المدنية",                 coef: 1,
    aliases: ["مدنية", "التربية المدنية", "civic", "civique", "ت مدنية", "ت م", "تربية مدنية"] },
  { key: "english", arLabel: "اللغة الإنجليزية",                coef: 2,
    aliases: ["إنجليزية", "اللغة الإنجليزية", "انجليزية", "english", "anglais", "الإ", "انجليزي"] },
  { key: "pe",      arLabel: "التربية البدنية والرياضية",       coef: 1,
    aliases: ["بدنية", "التربية البدنية", "ب ر", "pe", "eps", "sport", "بدني", "رياضة"] },
];

const NAME_ALIASES = [
  "الاسم واللقب", "اللقب والاسم", "الاسم الكامل", "اسم ولقب",
  "الاسم", "اللقب", "nom et prénom", "nom", "name", "prenom", "إسم",
  "التلميذ", "اسم التلميذ", "المتعلم", "اسم المتعلم",
];

const LAQAB_ALIASES = ["اللقب", "laqab", "nom de famille", "last name", "lastname"];
const ISM_ALIASES   = ["الاسم", "prenom", "first name", "firstname", "prénom"];

// Columns to skip when doing fallback name detection
const SKIP_COL_ALIASES = ["رقم", "n°", "num", "رقم التسجيل", "no", "#"];

function normalise(s: string): string {
  return String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function matchesAlias(header: string, aliases: string[]): boolean {
  const h = normalise(header);
  return aliases.some(a => {
    const an = normalise(a);
    return h === an || h.includes(an) || an.includes(h);
  });
}

function findCol(headers: string[], aliases: string[]): string | null {
  return headers.find(h => matchesAlias(h, aliases)) ?? null;
}

function parseScore(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = parseFloat(String(val).replace(",", "."));
  return isNaN(n) ? null : Math.max(0, Math.min(20, n));
}

/** Pick the most likely "name" column as a fallback when no alias matched */
function guessFallbackNameCol(
  headers: string[],
  subjectColIndices: Set<number>,
  dataRows: unknown[][]
): string | null {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h || !h.trim()) continue;
    if (subjectColIndices.has(i)) continue;
    if (matchesAlias(h, SKIP_COL_ALIASES)) continue;

    // Check that this column has mostly text values in data rows
    const sampleRows = dataRows.slice(0, Math.min(10, dataRows.length));
    const nonEmpty = sampleRows
      .map(r => (r as unknown[])[i])
      .filter(v => v !== null && v !== undefined && String(v).trim() !== "");

    if (nonEmpty.length === 0) continue;

    const textCount = nonEmpty.filter(v => isNaN(parseFloat(String(v)))).length;
    if (textCount / nonEmpty.length >= 0.6) return h;
  }
  return null;
}

// POST /api/bem/analyze
router.post("/bem/analyze", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  let wb: XLSX.WorkBook;
  try { wb = XLSX.read(req.file.buffer, { type: "buffer" }); }
  catch { res.status(400).json({ error: "Could not read Excel file" }); return; }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) { res.status(400).json({ error: "Empty file" }); return; }

  const sheet = wb.Sheets[sheetName];
  const allRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", header: 1 }) as unknown[][];

  // ── Find header row ────────────────────────────────────────────────────────
  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(15, allRows.length); i++) {
    const row = (allRows[i] ?? []) as unknown[];
    const strs = row.map(c => String(c ?? "").trim()).filter(Boolean);
    const textCells = strs.filter(s => isNaN(parseFloat(s)));
    if (textCells.length >= 2) {
      headerRowIndex = i;
      headers = row.map(c => String(c ?? "").trim());
      break;
    }
  }

  // Last resort: use row 0 as headers even if it looks numeric-ish
  if (headerRowIndex === -1 && allRows.length > 0) {
    headerRowIndex = 0;
    headers = (allRows[0] as unknown[]).map(c => String(c ?? "").trim());
  }

  if (headers.length === 0) {
    res.status(400).json({ error: "Could not detect header row" });
    return;
  }

  // ── Map columns ────────────────────────────────────────────────────────────
  const subjectCols: Record<string, number> = {};
  for (const subj of BEM_SUBJECTS) {
    const col = findCol(headers, subj.aliases);
    if (col) subjectCols[subj.key] = headers.indexOf(col);
  }

  const subjectColIndexSet = new Set(Object.values(subjectCols));
  const dataRows = allRows.slice(headerRowIndex + 1).filter(r => {
    const row = r as unknown[];
    return row.some(c => c !== null && c !== undefined && String(c).trim() !== "");
  });

  // Name column detection (with fallback)
  let nameCol   = findCol(headers, NAME_ALIASES);
  const laqabCol  = findCol(headers, LAQAB_ALIASES);
  const ismCol    = findCol(headers, ISM_ALIASES);

  if (!nameCol && !laqabCol && !ismCol) {
    nameCol = guessFallbackNameCol(headers, subjectColIndexSet, dataRows);
  }

  // ── Parse students ─────────────────────────────────────────────────────────
  const students: Array<{
    name: string;
    scores: Record<string, number | null>;
    totalScore: number;
    totalCoef: number;
    average: number | null;
    passed: boolean | null;
    rank: number;
  }> = [];

  for (const rawRow of dataRows) {
    const row = rawRow as unknown[];
    if (!row || row.length === 0) continue;

    const namedRow: Record<string, unknown> = {};
    headers.forEach((h, i) => { namedRow[h] = row[i]; });

    // Build name
    let name = "";
    if (nameCol && namedRow[nameCol] !== undefined && String(namedRow[nameCol]).trim()) {
      name = String(namedRow[nameCol]).trim();
    } else if (laqabCol && ismCol) {
      const l = String(namedRow[laqabCol] ?? "").trim();
      const f = String(namedRow[ismCol] ?? "").trim();
      name = [l, f].filter(Boolean).join(" ");
    } else if (laqabCol) {
      name = String(namedRow[laqabCol] ?? "").trim();
    }

    // Skip clearly invalid rows
    if (!name || name === "0" || !isNaN(parseFloat(name))) continue;
    // Skip header-like repeating rows
    if (matchesAlias(name, NAME_ALIASES)) continue;

    // Parse scores
    const scores: Record<string, number | null> = {};
    for (const subj of BEM_SUBJECTS) {
      const ci = subjectCols[subj.key];
      scores[subj.key] = ci !== undefined ? parseScore(row[ci]) : null;
    }

    // Weighted average
    let totalScore = 0;
    let totalCoef  = 0;
    for (const subj of BEM_SUBJECTS) {
      const s = scores[subj.key];
      if (s !== null) { totalScore += s * subj.coef; totalCoef += subj.coef; }
    }
    const average = totalCoef > 0 ? Math.round((totalScore / totalCoef) * 100) / 100 : null;

    students.push({
      name, scores, totalScore, totalCoef,
      average, passed: average !== null ? average >= 10 : null, rank: 0,
    });
  }

  if (students.length === 0) {
    // Return helpful debug info so you can see exactly what the parser found
    res.status(400).json({
      error: "No valid student data found in file",
      debug: {
        headerRowIndex,
        detectedHeaders: headers,
        nameCol,
        laqabCol,
        ismCol,
        subjectCols,
        sampleRows: allRows.slice(headerRowIndex + 1, headerRowIndex + 4),
      },
    });
    return;
  }

  // ── Sort + rank ────────────────────────────────────────────────────────────
  const sorted = [...students]
    .filter(s => s.average !== null)
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));

  sorted.forEach((s, i) => { s.rank = i + 1; });
  const noAvg = students.filter(s => s.average === null);
  const allRanked = [...sorted, ...noAvg];

  const passCount = sorted.filter(s => s.passed).length;
  const classAvg = sorted.length
    ? Math.round((sorted.reduce((sum, s) => sum + (s.average ?? 0), 0) / sorted.length) * 100) / 100
    : null;

  const detectedSubjects = BEM_SUBJECTS.filter(s => subjectCols[s.key] !== undefined);

  req.log.info({ file: req.file.originalname, total: students.length, passed: passCount }, "BEM analyzed");

  res.json({
    students: allRanked,
    summary: {
      total: students.length,
      withAvg: sorted.length,
      passCount,
      failCount: sorted.filter(s => !s.passed).length,
      passRate: sorted.length > 0 ? Math.round((passCount / sorted.length) * 10000) / 100 : 0,
      classAvg,
      first: sorted[0] ?? null,
      last:  sorted[sorted.length - 1] ?? null,
    },
    detectedSubjects: detectedSubjects.map(s => ({ key: s.key, arLabel: s.arLabel, coef: s.coef })),
    fileName: req.file.originalname,
  });
});

export default router;