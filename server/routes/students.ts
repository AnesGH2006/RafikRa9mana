import crypto from "crypto";
import { Router, type IRouter } from "express";
import { eq, and, ilike } from "drizzle-orm";
import multer from "multer";
import * as XLSX from "xlsx";
import { db, studentsTable } from "../../shared/db.js";
import {
  ListStudentsResponse,
  ImportStudentsResponse,
  DashboardStatsResponse,
  NiveauEnum,
  SexeEnum,
  StatutEnum,
} from "../../shared/schemas.js";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Normalisation ─────────────────────────────────────────────────────────────
function norm(s: string): string {
  return String(s ?? "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")   // diacritics + tatweel
    .replace(/[أإآا]/g, "ا")
    .replace(/[ةه]/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function contains(hay: string, needles: string[]): boolean {
  const h = norm(hay);
  return needles.some(n => h.includes(norm(n)));
}

// ─── Column detection keywords ────────────────────────────────────────────────
const NAME_N   = ["اسم ولقب","اسم","لقب","اللقب والاسم","الاسم واللقب","nom prenom","nom et prenom","eleve","élève","name","full name","etudiant","التلميذ"];
const PRENOM_N = ["الاسم","prenom","prénom","first name","fname","الإسم"];
const NOM_N    = ["اللقب","nom de famille","last name","lname","family"];
const BIRTH_N  = ["ميلاد","naissance","birth","dob","تاريخ"];
const LEVEL_N  = ["مستوى","niveau","level","year","grade","السنة","الصف","المستوى","الصف الدراسي"];
const CLASS_N  = ["فوج","قسم","classe","section","class","division","group","الفوج","القسم"];
const GENDER_N = ["جنس","sexe","genre","gender","sex","النوع","الجنس"];
const STATUS_N = ["وضعية","حاله","حالة","statut","status","situation","انتساب","الوضعية"];
const RESULT_N = ["نتيجه","نتيجة","résultat","resultat","result","mention","قرار","النتيجة"];

function findCol(headers: string[], needles: string[]): string | null {
  return headers.find(h => contains(h, needles)) ?? null;
}

function cellStr(row: Record<string, unknown>, key: string | null): string {
  if (!key) return "";
  const v = row[key];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

// Detect if a row looks like a real header row (has at least level+gender or name signals)
function isHeaderRow(row: unknown[]): boolean {
  const cells = row.map(c => norm(String(c ?? "")));
  const joined = cells.join(" ");
  const hasLevel  = contains(joined, LEVEL_N);
  const hasGender = contains(joined, GENDER_N);
  const hasName   = contains(joined, NAME_N) || contains(joined, NOM_N) || contains(joined, PRENOM_N);
  return (hasLevel && hasGender) || (hasName && hasLevel) || (hasName && hasGender);
}

// ─── Value normalisers ────────────────────────────────────────────────────────
function normalizeGender(val: string): "M" | "F" | null {
  const v = norm(val);
  if (!v) return null;
  if (/^(م$|ذ|ذكر|m|male|masculin|garcon|h\b|homme)/.test(v)) return "M";
  if (/^(أ|انثى|اناث|f|female|feminin|fille|girl|femme)/.test(v)) return "F";
  // single char
  if (v.length === 1) {
    if (["ذ","م","m","h"].includes(v)) return "M";
    if (["ا","أ","f"].includes(v)) return "F";
  }
  return null;
}

function normalizeLevel(val: string): "1AM" | "2AM" | "3AM" | "4AM" | null {
  if (!val) return null;
  const v = norm(val);

  // Arabic ordinal words (most common in Algerian school files)
  if (/^(اول|اولي|اولى|سنه اول|سنة اول|premiere|1ere|1ère)/.test(v)) return "1AM";
  if (/^(ثان|ثاني|ثانيه|ثانية|deuxieme|2eme|2ème)/.test(v))          return "2AM";
  if (/^(ثالث|ثالثه|ثالثة|troisieme|3eme|3ème)/.test(v))              return "3AM";
  if (/^(رابع|رابعه|رابعة|quatrieme|4eme|4ème)/.test(v))              return "4AM";

  // Extract first digit (latin or arabic-indic)
  const digits = v
    .replace(/١/g,"1").replace(/٢/g,"2").replace(/٣/g,"3").replace(/٤/g,"4")
    .replace(/[^\d]/g," ")
    .trim();
  const first = digits.split(/\s+/).find(d => d.length > 0);
  if (!first) return null;
  switch(first[0]) {
    case "1": return "1AM";
    case "2": return "2AM";
    case "3": return "3AM";
    case "4": return "4AM";
  }
  return null;
}

function normalizeStatut(val: string): "nouveau" | "redoublant" {
  const v = norm(val);
  if (!v) return "nouveau";
  if (/^(r|redoublan|معيد|اعاده|إعاده|مكرر|تكرار|م\.?$)/.test(v)) return "redoublant";
  return "nouveau";
}

function normalizeResultat(val: string): "admis" | "non_admis" | null {
  if (!val) return null;
  const v = norm(val);
  if (/^(a|admis|ناجح|نجح|recu|reçu|pass|oui)/.test(v)) return "admis";
  if (/^(n|non|راسب|رسب|non_admis|refuse|refusé|fail|la)/.test(v)) return "non_admis";
  return null;
}

// Arabic class letters → Latin
const AR_CLASS: Record<string,string> = {"أ":"A","ا":"A","ب":"B","ج":"C","د":"D","ه":"E","هـ":"E","و":"F","ز":"G"};

// ─── Routes ───────────────────────────────────────────────────────────────────

/** POST /api/students/preview — returns detected headers + 3 sample rows */
router.post("/students/preview", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file" }); return; }
  let wb: XLSX.WorkBook;
  try { wb = XLSX.read(req.file.buffer, { type: "buffer", raw: false }); }
  catch { res.status(400).json({ error: "Invalid Excel file" }); return; }

  const ws = wb.Sheets[wb.SheetNames[0]!];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, blankrows: false });

  // Find header row
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    if (isHeaderRow(raw[i] as unknown[])) { headerRowIdx = i; break; }
  }

  const headers = (raw[headerRowIdx] as unknown[]).map(c => String(c ?? "").trim());
  const samples = raw.slice(headerRowIdx + 1, headerRowIdx + 4).map(r =>
    Object.fromEntries(headers.map((h,i) => [h, String((r as unknown[])[i] ?? "")]))
  );

  res.json({ headerRow: headerRowIdx, headers, samples });
});

router.get("/students", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const { annee, niveau, classe, sexe, statut, q } = req.query as Record<string,string>;

  const conds = [eq(studentsTable.userId, userId)];
  if (annee) conds.push(eq(studentsTable.annee, annee));
  if (niveau && NiveauEnum.safeParse(niveau).success) conds.push(eq(studentsTable.niveau, niveau as any));
  if (classe) conds.push(eq(studentsTable.classe, classe));
  if (sexe && SexeEnum.safeParse(sexe).success) conds.push(eq(studentsTable.sexe, sexe as any));
  if (statut && StatutEnum.safeParse(statut).success) conds.push(eq(studentsTable.statut, statut as any));
  if (q) conds.push(ilike(studentsTable.nomPrenom, `%${q}%`));

  const students = await db.select().from(studentsTable).where(and(...conds))
    .orderBy(studentsTable.niveau, studentsTable.classe, studentsTable.nomPrenom);
  res.json(ListStudentsResponse.parse({ students, total: students.length }));
});

router.get("/stats", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const { annee } = req.query as Record<string,string>;
  const conds = [eq(studentsTable.userId, userId)];
  if (annee) conds.push(eq(studentsTable.annee, annee));
  const all = await db.select().from(studentsTable).where(and(...conds));

  const LEVELS = ["1AM","2AM","3AM","4AM"] as const;
  const byLevel = LEVELS.map(niveau => {
    const g = all.filter(s => s.niveau === niveau);
    return {
      niveau, total: g.length,
      boys: g.filter(s => s.sexe === "M").length,
      girls: g.filter(s => s.sexe === "F").length,
      admis: g.filter(s => s.resultat === "admis").length,
      nonAdmis: g.filter(s => s.resultat === "non_admis").length,
    };
  }).filter(l => l.total > 0);

  res.json(DashboardStatsResponse.parse({
    total: all.length,
    boys: all.filter(s => s.sexe === "M").length,
    girls: all.filter(s => s.sexe === "F").length,
    admis: all.filter(s => s.resultat === "admis").length,
    nonAdmis: all.filter(s => s.resultat === "non_admis").length,
    byLevel,
  }));
});

router.post("/students/import", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const userId = req.user!.id;
  const annee = (req.query.annee as string) || "2025-2026";

  let wb: XLSX.WorkBook;
  try { wb = XLSX.read(req.file.buffer, { type: "buffer", raw: false }); }
  catch { res.status(400).json({ error: "Invalid Excel file" }); return; }

  const ws = wb.Sheets[wb.SheetNames[0]!];
  // Read as 2D array first — lets us find the real header row
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, blankrows: false });

  if (!raw.length) { res.status(400).json({ error: "Empty file" }); return; }

  // ── Find the real header row (skip school-name / logo / merged-cell rows) ──
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    if (isHeaderRow(raw[i] as unknown[])) { headerRowIdx = i; break; }
  }

  const headerCells = (raw[headerRowIdx] as unknown[]).map(c => String(c ?? "").trim());
  const dataRows = raw.slice(headerRowIdx + 1);

  // Build header→index map
  const headerIdx: Record<string, number> = {};
  headerCells.forEach((h, i) => { if (h) headerIdx[h] = i; });

  req.log.info({ headerRowIdx, headers: headerCells }, "Excel headers detected");

  // ── Detect columns ────────────────────────────────────────────────────────
  const colName   = findCol(headerCells, NAME_N);
  const colNom    = findCol(headerCells, NOM_N);
  const colPrenom = findCol(headerCells, PRENOM_N);
  const colBirth  = findCol(headerCells, BIRTH_N);
  const colLevel  = findCol(headerCells, LEVEL_N);
  const colClass  = findCol(headerCells, CLASS_N);
  const colGender = findCol(headerCells, GENDER_N);
  const colStatus = findCol(headerCells, STATUS_N);
  const colResult = findCol(headerCells, RESULT_N);

  req.log.info({ colName, colNom, colPrenom, colLevel, colClass, colGender, colStatus }, "Detected column mapping");

  // Convert 2D row to object using our headers
  function rowToObj(r: unknown[]): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    headerCells.forEach((h, i) => { if (h) obj[h] = (r as unknown[])[i] ?? ""; });
    return obj;
  }

  const toInsert: typeof studentsTable.$inferInsert[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const rawRow = dataRows[i] as unknown[];
    // Skip blank rows
    if (!rawRow || rawRow.every(c => !c || String(c).trim() === "")) { skipped++; continue; }

    const row = rowToObj(rawRow);

    // ── Name ─────────────────────────────────────────────────────────────────
    // Prefer colNom + colPrenom combination (e.g. اللقب + الاسم columns)
    let nomPrenom = "";
    if (colNom && colPrenom) {
      nomPrenom = [cellStr(row, colNom), cellStr(row, colPrenom)].filter(Boolean).join(" ");
    } else if (colNom) {
      nomPrenom = cellStr(row, colNom);
    } else if (colPrenom) {
      nomPrenom = cellStr(row, colPrenom);
    } else if (colName) {
      nomPrenom = cellStr(row, colName);
    }
    // Last resort: use first non-numeric string cell in the row
    if (!nomPrenom) {
      for (const h of headerCells) {
        const v = cellStr(row, h);
        if (v && v.length > 2 && /[\u0600-\u06FFa-zA-Z]/.test(v)) { nomPrenom = v; break; }
      }
    }
    if (!nomPrenom) { skipped++; continue; }

    // ── Level ─────────────────────────────────────────────────────────────────
    const levelRaw = cellStr(row, colLevel);
    const niveau = normalizeLevel(levelRaw);
    if (!niveau) {
      if (errors.length < 30) errors.push(`صف ${i + headerRowIdx + 2}: مستوى غير صحيح "${levelRaw}" ← "${nomPrenom}"`);
      skipped++; continue;
    }

    // ── Class ─────────────────────────────────────────────────────────────────
    let classeRaw = cellStr(row, colClass);
    if (!classeRaw) {
      if (errors.length < 30) errors.push(`صف ${i + headerRowIdx + 2}: قسم مفقود ← "${nomPrenom}"`);
      skipped++; continue;
    }
    classeRaw = AR_CLASS[classeRaw] ?? classeRaw.toUpperCase().replace(/\s+/g,"");

    // ── Gender ────────────────────────────────────────────────────────────────
    const genderRaw = cellStr(row, colGender);
    const sexe = normalizeGender(genderRaw);
    if (!sexe) {
      if (errors.length < 30) errors.push(`صف ${i + headerRowIdx + 2}: جنس غير صحيح "${genderRaw}" ← "${nomPrenom}"`);
      skipped++; continue;
    }

    const dateNaissance = cellStr(row, colBirth) || null;
    const statut = normalizeStatut(cellStr(row, colStatus));
    const resultat = normalizeResultat(cellStr(row, colResult));

    toInsert.push({
      id: crypto.randomBytes(16).toString("hex"),
      userId, nomPrenom, dateNaissance, niveau,
      classe: classeRaw, sexe, statut, resultat, annee,
    });
  }

  if (toInsert.length > 0) {
    for (let b = 0; b < toInsert.length; b += 200) {
      await db.insert(studentsTable).values(toInsert.slice(b, b + 200));
    }
  }

  req.log.info({ userId, imported: toInsert.length, skipped, errors: errors.slice(0,5) }, "Students imported");
  res.json(ImportStudentsResponse.parse({ imported: toInsert.length, skipped, errors }));
});

router.delete("/students", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const { annee } = req.query as Record<string,string>;
  const conds = [eq(studentsTable.userId, userId)];
  if (annee) conds.push(eq(studentsTable.annee, annee));
  await db.delete(studentsTable).where(and(...conds));
  res.json({ success: true });
});

export default router;
