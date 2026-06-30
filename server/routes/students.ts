import crypto from "crypto";
import { Router, type IRouter } from "express";
import { eq, and, ilike } from "drizzle-orm";
import multer from "multer";
import * as XLSX from "xlsx";
import { db, studentsTable } from "../../shared/db.js";
import {
  ListStudentsResponse, ImportStudentsResponse, DashboardStatsResponse,
  NiveauEnum, SexeEnum, StatutEnum,
} from "../../shared/schemas.js";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Normalisation ─────────────────────────────────────────────────────────────
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

function contains(hay: string, needles: string[]): boolean {
  const h = norm(hay);
  return needles.some(n => h.includes(norm(n)));
}

// ─── HTML entity decoder ──────────────────────────────────────────────────────
function decodeHTMLEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_: string, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_: string, h: string) => String.fromCharCode(parseInt(h, 16)));
}

// ─── HTML-XLS parser ─────────────────────────────────────────────────────────
export function parseHTMLWorkbook(buffer: Buffer): { rows: unknown[][]; error?: string } {
  const text = buffer.toString("utf-8");
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("<")) return { rows: [], error: "ليس ملف HTML" };
  if (/<frameset/i.test(text) && /<frame\s/i.test(text) && !/<tbody/i.test(text)) {
    return { rows: [], error: "هذا الملف يستخدم نسق الإطارات (Frameset). الرجاء تصدير الملف بصيغة .xlsx مباشرة." };
  }

  const rows: unknown[][] = [];
  const tagRegex = /<[^>]+>/g;
  const trSplitRegex = /<tr[^>]*>/gi;
  const segments: string[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = trSplitRegex.exec(text)) !== null) {
    if (lastIdx > 0) segments.push(text.slice(lastIdx, m.index));
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx > 0) segments.push(text.slice(lastIdx));

  for (const seg of segments) {
    const cells: string[] = [];
    const tdRe = /<t[dh][^>]*>([\s\S]*?)(?:<\/t[dh]>|$)/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRe.exec(seg)) !== null) {
      const raw = tdMatch[1]!.replace(tagRegex, "");
      const cell = decodeHTMLEntities(raw).replace(/\s+/g, " ").trim();
      cells.push(cell);
    }
    if (cells.length > 0) rows.push(cells);
  }
  return { rows };
}

// ─── Gender inference from Arabic name ───────────────────────────────────────
const FEMALE_NAMES = new Set([
  "فاطمة","عائشة","مريم","زينب","سارة","نور","هند","ليلى","أمينة","خديجة",
  "سلمى","رقية","حفصة","أسماء","رحمة","وسام","إيمان","هاجر","آية","نجاة",
  "كوثر","منال","هدى","ندى","شيماء","نهال","ملاك","بشرى","أمال","سهام",
  "إخلاص","اخلاص","سجى","صفاء","وفاء","دلال","ربيعة","حياة","نسرين","لمياء",
  "ياسمين","زهرة","نادية","سميرة","نجمة","جميلة","مليكة","لطيفة","رزيقة","زليخة",
  "حنان","إيناس","رانية","نسيمة","كريمة","حليمة","فريدة","نفيسة","مسعودة",
  "وئام","إيناس","أنيسة","حياة","سعاد","نعيمة","صفية","فضيلة","قمر","بدور",
  "تسنيم","شهد","لجين","غادة","روضة","عبير","بسمة","هيفاء","لبنى","شيماء",
]);
const MALE_NAMES = new Set([
  "محمد","أحمد","علي","عمر","يوسف","إبراهيم","خالد","عبد","عبدالله","حسن",
  "حسين","عبدالرحمن","طارق","كريم","سامي","رامي","أنس","بلال","سعيد","رشيد",
  "مصطفى","إسماعيل","نور","يونس","إلياس","ياسين","أمين","زكريا","هارون","صالح",
  "عمار","رضا","فيصل","أيوب","منصور","سليم","ثابت","حمزة","معاذ","صلاح",
]);

function inferGenderFromName(fullName: string): "M" | "F" | null {
  if (!fullName) return null;
  const words = fullName.trim().split(/\s+/);
  for (const word of words) {
    const w = word.replace(/[\u064B-\u065F\u0670\u0640]/g, "");
    for (const fn of FEMALE_NAMES) if (w === fn || w.includes(fn)) return "F";
    for (const mn of MALE_NAMES) if (w === mn || w.includes(mn)) return "M";
  }
  for (let i = 1; i < words.length; i++) {
    const w = words[i]!.replace(/[\u064B-\u065F\u0670\u0640]/g, "");
    if (w.length > 3 && (w.endsWith("ة") || w.endsWith("ى") || w.endsWith("اء"))) return "F";
  }
  return null;
}

// ─── Column keywords ──────────────────────────────────────────────────────────
const NAME_N   = ["اسم ولقب","اللقب و الاسم","اللقب والاسم","لقب و اسم","لقب واسم","اسم","لقب","الاسم واللقب","nom prenom","nom et prenom","eleve","élève","name","full name","التلميذ","المتعلم"];
const PRENOM_N = ["الاسم","prenom","prénom","first name","fname","الإسم"];
const NOM_N    = ["اللقب","nom de famille","last name","lname","family"];
const BIRTH_N  = ["ميلاد","تاريخ الميلاد","naissance","birth","dob","تاريخ الازدياد","تاريخ"];
const LEVEL_N  = ["مستوى","niveau","level","year","grade","السنة","الصف","المستوى"];
const CLASS_N  = ["فوج","قسم","classe","section","class","division","group","الفوج","القسم"];
const GENDER_N = ["جنس","الجنس","sexe","genre","gender","sex","النوع"];
const STATUS_N = ["الإعادة","اعاده","إعاده","وضعية","حالة","statut","status","situation","انتساب","الوضعية","redoublan"];
const RESULT_N = ["نتيجه","نتيجة","résultat","resultat","result","mention","قرار","النتيجة"];

// ✅ FIX 1: أزلنا "رقم" و"الرقم" لأنهما يلتقطان "رقم التعريف" الوطني (16 خانة)
//    وأضفنا "رقم القيد" بشكل صريح
const RAQM_N = ["رقم القيد","رقم التلميذ","رقم الفوج","رقم المتعلم","no","n°","numero","numéro","#"];

// ─── Column detector ──────────────────────────────────────────────────────────
function findCol(headers: string[], needles: string[]): string | null {
  return headers.find(h => contains(h, needles)) ?? null;
}

function cellStr(row: Record<string, unknown>, key: string | null): string {
  if (!key) return "";
  const v = row[key];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function isHeaderRow(row: unknown[]): boolean {
  const cells = row.map(c => norm(String(c ?? "")));
  const joined = cells.join(" ");
  return (
    (contains(joined, GENDER_N) && contains(joined, NAME_N.concat(NOM_N))) ||
    (contains(joined, LEVEL_N)  && contains(joined, NAME_N.concat(NOM_N))) ||
    (contains(joined, NAME_N)   && cells.filter(c => c.length > 1).length >= 3) ||
    // ✅ FIX: detect header by presence of رقم التعريف (national ID column)
    joined.includes(norm("رقم التعريف")) ||
    joined.includes(norm("رقم القيد"))
  );
}

// ─── Value normalisers ────────────────────────────────────────────────────────

// ✅ FIX 2: "أنثى" بعد norm() تصبح "انثي" — أضفنا هذه الحالة صراحةً
function normalizeGender(val: string): "M" | "F" | null {
  const raw = String(val ?? "")
    .replace(/[\u0009\u000A\u000D\u0020\u00A0\u200B\u200C\u200D\uFEFF\u3000]/g, "")
    .trim();
  if (!raw) return null;

  // Apply same normalization as norm() for comparison
  const v = raw
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآا]/g, "ا")
    .replace(/[ةه]/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();

  // Male
  if (/^ذكر$/.test(v) || /^ذ$/.test(v) || /^م$/.test(v)) return "M";
  if (/^(m|male|masculin|garcon|garçon|homme|h|1)$/.test(v)) return "M";

  // Female — "أنثى" normalizes to "انثي", "أنثى" direct also handled
  if (/^انثي$/.test(v) || /^انثى$/.test(v) || /^اناث$/.test(v)) return "F";
  if (/^انثي/.test(v) || /^انثى/.test(v) || /^انوث/.test(v)) return "F";
  if (/^ا$/.test(v) || /^أ$/.test(v)) return "F";
  if (/^(f|female|feminin|féminin|fille|femme|2)$/.test(v)) return "F";

  if (raw.length === 1) {
    if (["m","h","1"].includes(raw.toLowerCase())) return "M";
    if (["f","2"].includes(raw.toLowerCase())) return "F";
  }
  return null;
}

// ✅ FIX 3: "أولى" after norm() = "اولي", "ثانية" = "ثانيه" — regex updated
function normalizeLevel(val: string): "1AM" | "2AM" | "3AM" | "4AM" | null {
  if (!val) return null;
  const v = String(val)
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآا]/g, "ا")
    .replace(/[ةه]/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .trim();

  if (/^(اول|اولي|اولى|سنه اول|premiere|1ere|1ère|first)/.test(v)) return "1AM";
  if (/^(ثان|ثاني|ثانيه|deuxieme|2eme|2ème|second)/.test(v)) return "2AM";
  if (/^(ثالث|ثالثه|troisieme|3eme|3ème|third)/.test(v)) return "3AM";
  if (/^(رابع|رابعه|quatrieme|4eme|4ème|fourth)/.test(v)) return "4AM";

  const digits = v
    .replace(/١/g,"1").replace(/٢/g,"2").replace(/٣/g,"3").replace(/٤/g,"4")
    .replace(/[^\d]/g," ").trim();
  const first = digits.split(/\s+/).find(d => d.length > 0);
  if (!first) return null;
  return ({ "1":"1AM","2":"2AM","3":"3AM","4":"4AM" } as Record<string, "1AM"|"2AM"|"3AM"|"4AM">)[first[0]!] ?? null;
}

function normalizeStatut(val: string): "nouveau" | "redoublant" {
  const v = norm(String(val ?? ""));
  if (!v || v === "لا" || v === "no" || v === "non") return "nouveau";
  if (/^(r|redoublan|معيد|اعاده|إعاده|مكرر|تكرار|نعم|yes|oui)/.test(v)) return "redoublant";
  return "nouveau";
}

function normalizeResultat(val: string): "admis" | "non_admis" | "mustarrak" | null {
  if (!val) return null;
  const v = norm(val);
  if (/^(a|admis|ناجح|نجح|recu|reçu|pass|oui)/.test(v)) return "admis";
  if (/^(m|must|استدراك|مستدرك|rattrap|oral)/.test(v)) return "mustarrak";
  if (/^(n|non|راسب|رسب|non_admis|refuse|refusé|fail|la)/.test(v)) return "non_admis";
  return null;
}

const AR_CLASS: Record<string, string> = {
  "أ":"A","ا":"A","ب":"B","ج":"C","د":"D","ه":"E","هـ":"E","و":"F","ز":"G",
};

// ─── Core import ──────────────────────────────────────────────────────────────
function processRows(
  raw: unknown[][],
  userId: string,
  annee: string,
  niveau: "1AM"|"2AM"|"3AM"|"4AM"|null,
  classe: string|null,
  logger: { info: (...a: any[]) => void }
): { toInsert: typeof studentsTable.$inferInsert[]; skipped: number; errors: string[] } {
  const errors: string[] = [];
  let skipped = 0;

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(15, raw.length); i++) {
    if (isHeaderRow(raw[i] as unknown[])) { headerRowIdx = i; break; }
  }

  const headerCells = (raw[headerRowIdx] as unknown[]).map(c => String(c ?? "").trim());
  const dataRows    = raw.slice(headerRowIdx + 1);

  logger.info({ headerRowIdx, headers: headerCells }, "Headers detected");

  let detectedNiveau = niveau;
  if (!detectedNiveau) {
    for (let i = 0; i < headerRowIdx; i++) {
      const titleText = (raw[i] as unknown[]).join(" ");
      detectedNiveau = normalizeLevel(titleText);
      if (detectedNiveau) break;
    }
  }
  if (!detectedNiveau) detectedNiveau = normalizeLevel(headerCells.join(" "));

  const colNom    = findCol(headerCells, NOM_N);
  const colPrenom = findCol(headerCells, PRENOM_N);
  const colName   = findCol(headerCells, NAME_N);
  const colBirth  = findCol(headerCells, BIRTH_N);
  const colLevel  = findCol(headerCells, LEVEL_N);
  const colClass  = findCol(headerCells, CLASS_N);
  const colGender = findCol(headerCells, GENDER_N);
  const colStatus = findCol(headerCells, STATUS_N);
  const colResult = findCol(headerCells, RESULT_N);
  const colRaqm   = findCol(headerCells, RAQM_N);   // ✅ now correctly picks "رقم القيد"

  logger.info({ colNom, colPrenom, colName, colLevel, colClass, colGender, colRaqm }, "Column map");

  function rowToObj(r: unknown[]): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    headerCells.forEach((h, i) => { if (h) obj[h] = (r as unknown[])[i] ?? ""; });
    return obj;
  }

  const toInsert: typeof studentsTable.$inferInsert[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const rawRow = dataRows[i] as unknown[];
    if (!rawRow || rawRow.every(c => !c || String(c).trim() === "")) { skipped++; continue; }
    const row = rowToObj(rawRow);

    // ── رقم القيد ─────────────────────────────────────────────────────────────
    const raqmRaw = cellStr(row, colRaqm);
    // ✅ FIX: only accept raqm values that fit in a safe integer (not national IDs)
    const raqmNum = raqmRaw && !isNaN(Number(raqmRaw)) ? Number(raqmRaw) : null;
    const raqm = raqmNum !== null && raqmNum < 2_147_483_647 && raqmNum > 0 ? raqmNum : null;

    // ── الاسم ─────────────────────────────────────────────────────────────────
    let nomPrenom = "";
    if (colNom && colPrenom) {
      // ✅ File has separate "اللقب" and "الاسم" columns — combine them
      nomPrenom = [cellStr(row, colNom), cellStr(row, colPrenom)].filter(Boolean).join(" ");
    } else if (colNom) {
      nomPrenom = cellStr(row, colNom);
    } else if (colPrenom) {
      nomPrenom = cellStr(row, colPrenom);
    } else if (colName) {
      nomPrenom = cellStr(row, colName);
    }
    if (!nomPrenom) {
      for (const h of headerCells) {
        const v = cellStr(row, h);
        if (v && v.length > 2 && /[\u0600-\u06FFa-zA-Z]/.test(v)) { nomPrenom = v; break; }
      }
    }
    if (!nomPrenom) { skipped++; continue; }

    // ── المستوى ───────────────────────────────────────────────────────────────
    const niveauFinal = detectedNiveau ?? normalizeLevel(cellStr(row, colLevel));
    if (!niveauFinal) {
      if (errors.length < 30) errors.push(`صف ${i + headerRowIdx + 2}: مستوى غير محدد ← "${nomPrenom}"`);
      skipped++; continue;
    }

    // ── القسم ─────────────────────────────────────────────────────────────────
    let classeRaw = classe ?? cellStr(row, colClass);
    if (!classeRaw) classeRaw = "A";
    classeRaw = AR_CLASS[classeRaw] ?? classeRaw.toUpperCase().replace(/\s+/g, "");

    // ── الجنس ─────────────────────────────────────────────────────────────────
    const genderRaw = cellStr(row, colGender);
    let sexe: "M"|"F"|null = normalizeGender(genderRaw);
    if (!sexe) sexe = inferGenderFromName(nomPrenom);
    if (!sexe) {
      sexe = "M";
      if (errors.length < 30) errors.push(`صف ${i+headerRowIdx+2}: جنس غير محدد — افتراضي ذكر ← "${nomPrenom}"`);
    }

    const dateNaissance = cellStr(row, colBirth) || null;
    const statut  = normalizeStatut(cellStr(row, colStatus));
    const resultat = normalizeResultat(cellStr(row, colResult));

    toInsert.push({
      id: crypto.randomBytes(16).toString("hex"),
      userId, nomPrenom, dateNaissance,
      niveau: niveauFinal, classe: classeRaw,
      sexe, statut, resultat, annee, raqm,
    });
  }

  return { toInsert, skipped, errors };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/students", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const { annee, niveau, classe, sexe, statut, q } = req.query as Record<string, string>;
  const conds = [eq(studentsTable.userId, userId)];
  if (annee) conds.push(eq(studentsTable.annee, annee));
  if (niveau && NiveauEnum.safeParse(niveau).success) conds.push(eq(studentsTable.niveau, niveau as any));
  if (classe) conds.push(eq(studentsTable.classe, classe));
  if (sexe && SexeEnum.safeParse(sexe).success) conds.push(eq(studentsTable.sexe, sexe as any));
  if (statut && StatutEnum.safeParse(statut).success) conds.push(eq(studentsTable.statut, statut as any));
  if (q) conds.push(ilike(studentsTable.nomPrenom, `%${q}%`));
  const students = await db.select().from(studentsTable)
    .where(and(...conds))
    .orderBy(studentsTable.niveau, studentsTable.classe, studentsTable.raqm, studentsTable.nomPrenom);
  res.json(ListStudentsResponse.parse({ students, total: students.length }));
});

router.get("/stats", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const userId = req.user!.id;
    const { annee } = req.query as Record<string, string>;
    const conds = [eq(studentsTable.userId, userId)];
    if (annee) conds.push(eq(studentsTable.annee, annee));
    const all = await db.select().from(studentsTable).where(and(...conds));
    const currentYear = new Date().getFullYear();
    const calcAge = (dob: string | null): number | null => {
      if (!dob) return null;
      // Accepts formats: YYYY-MM-DD, DD/MM/YYYY
      let year: number | null = null;
      const isoMatch = dob.match(/^(\d{4})-\d{2}-\d{2}/);
      const slashMatch = dob.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (isoMatch) year = parseInt(isoMatch[1]!);
      else if (slashMatch) year = parseInt(slashMatch[3]!);
      if (!year || year < 1990 || year > currentYear) return null;
      return currentYear - year;
    };

    const LEVELS = ["1AM","2AM","3AM","4AM"] as const;
    const byLevel = LEVELS.map(niveau => {
      const g = all.filter(s => s.niveau === niveau);
      const ages = g.map(s => calcAge(s.dateNaissance)).filter((a): a is number => a !== null);
      const avgAge = ages.length ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10 : null;
      const minAge = ages.length ? Math.min(...ages) : null;
      const maxAge = ages.length ? Math.max(...ages) : null;
      const ageDist: { age: number; count: number }[] = [];
      for (const age of ages) {
        const existing = ageDist.find(a => a.age === age);
        if (existing) existing.count++;
        else ageDist.push({ age, count: 1 });
      }
      ageDist.sort((a, b) => a.age - b.age);
      return {
        niveau, total: g.length,
        boys: g.filter(s => s.sexe === "M").length,
        girls: g.filter(s => s.sexe === "F").length,
        admis: g.filter(s => s.resultat === "admis").length,
        nonAdmis: g.filter(s => s.resultat === "non_admis").length,
        mustarrak: g.filter(s => s.resultat === "mustarrak").length,
        nouveau: g.filter(s => s.statut === "nouveau").length,
        redoublant: g.filter(s => s.statut === "redoublant").length,
        avgAge, minAge, maxAge, ageDist,
      };
    }).filter(l => l.total > 0);
    res.json(DashboardStatsResponse.parse({
      total: all.length,
      boys: all.filter(s => s.sexe === "M").length,
      girls: all.filter(s => s.sexe === "F").length,
      admis: all.filter(s => s.resultat === "admis").length,
      nonAdmis: all.filter(s => s.resultat === "non_admis").length,
      mustarrak: all.filter(s => s.resultat === "mustarrak").length,
      nouveau: all.filter(s => s.statut === "nouveau").length,
      redoublant: all.filter(s => s.statut === "redoublant").length,
      byLevel,
    }));
  } catch (err) {
    req.log.error({ err }, "Stats query failed");
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.post("/students/import", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const userId = req.user!.id;
  const annee  = (req.query.annee as string) || "2025-2026";

  let raw: unknown[][] = [];
  const fileText = req.file.buffer.toString("utf-8").trimStart();
  const isHTML   = fileText.startsWith("<");

  if (isHTML) {
    const { rows, error } = parseHTMLWorkbook(req.file.buffer);
    if (error) { res.status(400).json({ error }); return; }
    raw = rows;
  } else {
    try {
      const wb = XLSX.read(req.file.buffer, { type: "buffer", raw: false });
      const ws = wb.Sheets[wb.SheetNames[0]!];
      raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, blankrows: false });
    } catch {
      res.status(400).json({ error: "صيغة الملف غير صالحة. استخدم .xlsx أو ملف .xls من المنظومة." });
      return;
    }
  }

  if (!raw.length) {
    res.status(400).json({ error: "الملف فارغ أو لا يحتوي على بيانات قابلة للقراءة" });
    return;
  }

  // Extract class/level from title rows
  let titleClasse: string|null = null;
  let titleNiveau: "1AM"|"2AM"|"3AM"|"4AM"|null = null;
  for (let i = 0; i < Math.min(8, raw.length); i++) {
    const text = (raw[i] as unknown[]).join(" ");
    if (text.includes("متوسط")) {
      const classMatch = text.match(/متوسط\s*(\d+)/);
      if (classMatch) titleClasse = classMatch[1]!.replace(/^0+/, "") || "1";
      titleNiveau = normalizeLevel(text);
      break;
    }
  }

  const { toInsert, skipped, errors } = processRows(raw, userId, annee, titleNiveau, titleClasse, req.log);

  if (toInsert.length > 0) {
    for (let b = 0; b < toInsert.length; b += 200) {
      await db.insert(studentsTable).values(toInsert.slice(b, b + 200));
    }
  }

  req.log.info({ userId, imported: toInsert.length, skipped, errors: errors.slice(0,5) }, "Students imported");
  res.json(ImportStudentsResponse.parse({ imported: toInsert.length, skipped, errors }));
});

router.post("/students/preview", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "No file" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file" }); return; }
  const fileText = req.file.buffer.toString("utf-8").trimStart();
  const isHTML = fileText.startsWith("<");
  let raw: unknown[][] = [];
  if (isHTML) {
    const { rows, error } = parseHTMLWorkbook(req.file.buffer);
    if (error) { res.status(400).json({ error }); return; }
    raw = rows;
  } else {
    try {
      const wb = XLSX.read(req.file.buffer, { type: "buffer", raw: false });
      const ws = wb.Sheets[wb.SheetNames[0]!];
      raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, blankrows: false });
    } catch {
      res.status(400).json({ error: "ملف Excel غير صالح" }); return;
    }
  }
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(15, raw.length); i++) {
    if (isHeaderRow(raw[i] as unknown[])) { headerRowIdx = i; break; }
  }
  const headers = (raw[headerRowIdx] as unknown[]).map(c => String(c ?? "").trim());
  const samples = raw.slice(headerRowIdx+1, headerRowIdx+4).map(r =>
    Object.fromEntries(headers.map((h, i) => [h, String((r as unknown[])[i] ?? "")]))
  );
  res.json({ headerRow: headerRowIdx, headers, samples });
});

router.delete("/students", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const { annee } = req.query as Record<string, string>;
  const conds = [eq(studentsTable.userId, userId)];
  if (annee) conds.push(eq(studentsTable.annee, annee));
  await db.delete(studentsTable).where(and(...conds));
  res.json({ success: true });
});

export default router;