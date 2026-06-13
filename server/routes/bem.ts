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

const BEM_SUBJECTS = [
  { key: "math",    arLabel: "الرياضيات",                       coef: 4 },
  { key: "arabic",  arLabel: "اللغة العربية",                   coef: 5 },
  { key: "french",  arLabel: "اللغة الفرنسية",                  coef: 3 },
  { key: "english", arLabel: "اللغة الإنجليزية",                coef: 2 },
  { key: "islamic", arLabel: "التربية الإسلامية",               coef: 2 },
  { key: "civic",   arLabel: "التربية المدنية",                 coef: 1 },
  { key: "history", arLabel: "التاريخ والجغرافيا",              coef: 3 },
  { key: "science", arLabel: "علوم الطبيعة والحياة",            coef: 2 },
  { key: "physics", arLabel: "العلوم الفيزيائية والتكنولوجية", coef: 2 },
  { key: "pe",      arLabel: "التربية البدنية والرياضية",       coef: 1 },
];

function normalise(s: string): string {
  return String(s).toLowerCase().replace(/\s+/g, "").replace(/[^\p{L}\p{N}]/gu, "");
}

function parseScore(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = parseFloat(String(val).replace(",", "."));
  return isNaN(n) ? null : Math.max(0, Math.min(20, n));
}

function detectSubjectKey(header: string): string | null {
  const h = normalise(header);
  if (h.includes("رياضيات")) return "math";
  if (h.includes("عربية") || h.includes("العربية")) return "arabic";
  if (h.includes("فرنسية") || h.includes("الفرنسية")) return "french";
  if (h.includes("إنجليزية") || h.includes("الإنجليزية") || h.includes("انجليزية")) return "english";
  if (h.includes("إسلامية") || h.includes("اسلامية")) return "islamic";
  if (h.includes("مدنية")) return "civic";
  if (h.includes("ميلاد")) return null;
  if (h.includes("تاريخ") || h.includes("جغرافيا")) return "history";
  if (h.includes("علومط") || (h.includes("علوم") && h.includes("ط"))) return "science";
  if (h.includes("فيزياء")) return "physics";
  if (h.includes("بدنية")) return "pe";
  return null;
}

function isNameColumn(header: string): boolean {
  const h = normalise(header);
  return h.includes("لقب") || h.includes("اسم") || h.includes("إسم") ||
    h.includes("nom") || h.includes("name") || h.includes("prenom") ||
    h.includes("متعلم") || h.includes("تلميذ");
}

function isAverageColumn(header: string): boolean {
  const h = normalise(header);
  return (h.includes("معدل") && (h.includes("شتم") || h.includes("bem") ||
    h.includes("انتقال") || h.includes("إنتقال"))) || h === "معدل";
}

function detectGender(name: string): "male" | "female" | "unknown" {
  const femaleSuffixes = ["ة", "ى", "اء", "ين", "ينة", "ية"];
  const maleNames = ["محمد", "أحمد", "علي", "عمر", "يوسف", "إبراهيم", "خالد", "عبد"];
  const femaleNames = ["فاطمة", "عائشة", "مريم", "زينب", "سارة", "نور", "هند", "ليلى", "أمينة", "خديجة", "سلمى", "رقية", "حفصة", "أسماء", "رحمة", "وسام", "إيمان", "هاجر", "آية", "نجاة"];
  const n = name.trim();
  for (const fn of femaleNames) if (n.includes(fn)) return "female";
  for (const mn of maleNames) if (n.includes(mn)) return "male";
  for (const sf of femaleSuffixes) if (n.endsWith(sf) && n.length > sf.length + 2) return "female";
  return "unknown";
}

router.post("/bem/analyze", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  let wb: XLSX.WorkBook;
  try { wb = XLSX.read(req.file.buffer, { type: "buffer" }); }
  catch { res.status(400).json({ error: "Could not read Excel file" }); return; }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) { res.status(400).json({ error: "Empty file" }); return; }

  const sheet = wb.Sheets[sheetName];
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { defval: null, header: 1 }) as unknown[][];

  let headerRowIndex = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(20, allRows.length); i++) {
    const row = allRows[i] as unknown[];
    const textCells = row.filter(c => typeof c === "string" && c.trim().length > 1);
    if (textCells.length >= 3) {
      headerRowIndex = i;
      headers = row.map(c => (c == null ? "" : String(c).trim()));
      break;
    }
  }

  if (headerRowIndex === -1) {
    res.status(400).json({ error: "Could not detect header row" });
    return;
  }

  let nameColIdx = -1;
  let avgColIdx  = -1;
  const subjectColMap: Record<string, number> = {};

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h) continue;
    if (nameColIdx === -1 && isNameColumn(h)) { nameColIdx = i; continue; }
    if (avgColIdx  === -1 && isAverageColumn(h)) { avgColIdx = i; continue; }
    const subjKey = detectSubjectKey(h);
    if (subjKey && !(subjKey in subjectColMap)) subjectColMap[subjKey] = i;
  }

  const dataRows = allRows.slice(headerRowIndex + 1);

  const students: Array<{
    name: string; gender: "male" | "female" | "unknown";
    scores: Record<string, number | null>;
    average: number | null; passed: boolean | null; rank: number;
  }> = [];

  for (const rawRow of dataRows) {
    const row = rawRow as unknown[];
    if (!row || row.every(c => c === null || c === "")) continue;
    const name = nameColIdx >= 0 ? String(row[nameColIdx] ?? "").trim() : "";
    if (!name || !isNaN(Number(name))) continue;

    const scores: Record<string, number | null> = {};
    for (const subj of BEM_SUBJECTS) {
      const ci = subjectColMap[subj.key];
      scores[subj.key] = ci !== undefined ? parseScore(row[ci]) : null;
    }

    let average: number | null = null;
    if (avgColIdx >= 0) average = parseScore(row[avgColIdx]);
    if (average === null) {
      let totalScore = 0, totalCoef = 0;
      for (const subj of BEM_SUBJECTS) {
        const s = scores[subj.key];
        if (s !== null) { totalScore += s * subj.coef; totalCoef += subj.coef; }
      }
      if (totalCoef > 0) average = Math.round((totalScore / totalCoef) * 100) / 100;
    }

    students.push({
      name, gender: detectGender(name), scores, average,
      passed: average !== null ? average >= 10 : null, rank: 0,
    });
  }

  if (students.length === 0) {
    res.status(400).json({
      error: "No valid student data found in file",
      debug: { headerRowIndex, headers, nameColIdx, avgColIdx, subjectColMap,
               sample: allRows.slice(headerRowIndex + 1, headerRowIndex + 3) },
    });
    return;
  }

  // Sort + rank
  const sorted = [...students].filter(s => s.average !== null)
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  sorted.forEach((s, i) => { s.rank = i + 1; });
  const noAvg = students.filter(s => s.average === null);
  const allRanked = [...sorted, ...noAvg];

  const passCount = sorted.filter(s => s.passed).length;
  const classAvg = sorted.length
    ? Math.round((sorted.reduce((sum, s) => sum + (s.average ?? 0), 0) / sorted.length) * 100) / 100
    : null;

  // Gender stats
  const males   = students.filter(s => s.gender === "male");
  const females = students.filter(s => s.gender === "female");
  const genderStats = {
    males:          males.length,
    females:        females.length,
    unknown:        students.filter(s => s.gender === "unknown").length,
    malePass:       males.filter(s => s.passed).length,
    maleFail:       males.filter(s => s.passed === false).length,
    femalePass:     females.filter(s => s.passed).length,
    femaleFail:     females.filter(s => s.passed === false).length,
    malePassRate:   males.length > 0 ? Math.round((males.filter(s => s.passed).length / males.length) * 10000) / 100 : 0,
    femalePassRate: females.length > 0 ? Math.round((females.filter(s => s.passed).length / females.length) * 10000) / 100 : 0,
  };

  // Subject stats
  const detectedSubjects = BEM_SUBJECTS.filter(s => subjectColMap[s.key] !== undefined);
  const subjectStats = detectedSubjects.map(subj => {
    const scores = students.map(s => s.scores[subj.key]).filter((v): v is number => v !== null);
    const passC  = scores.filter(v => v >= 10).length;
    const avg    = scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : null;
    return {
      key: subj.key, arLabel: subj.arLabel, coef: subj.coef,
      avg, passCount: passC, total: scores.length,
      passRate: scores.length > 0 ? Math.round((passC / scores.length) * 10000) / 100 : 0,
    };
  });

  // Score distribution (1-point buckets)
  const scoreDistribution = Array.from({ length: 20 }, (_, i) => ({
    range: String(i),
    count: students.filter(s => s.average !== null && Math.floor(s.average) === i).length,
  }));

  req.log.info({ file: req.file.originalname, total: students.length, passed: passCount }, "BEM analyzed");

  res.json({
    students: allRanked,
    summary: {
      total: students.length, withAvg: sorted.length,
      passCount, failCount: sorted.filter(s => !s.passed).length,
      passRate: sorted.length > 0 ? Math.round((passCount / sorted.length) * 10000) / 100 : 0,
      classAvg,
      first: sorted[0] ?? null,
      last:  sorted[sorted.length - 1] ?? null,
    },
    genderStats,
    subjectStats,
    scoreDistribution,
    detectedSubjects: detectedSubjects.map(s => ({ key: s.key, arLabel: s.arLabel, coef: s.coef })),
    fileName: req.file.originalname,
  });
});

export default router;