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

// ─── HTML-XLS parser (for Algerian Ministry files) ───────────────────────────
function parseHTMLWorkbook(buffer: Buffer): unknown[][] {
  const text = buffer.toString("utf-8");
  if (!text.trim().startsWith("<")) return [];

  // Use regex to extract table rows — no DOM parser available in Node
  const rows: unknown[][] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  const tagRegex = /<[^>]+>/g;

  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRegex.exec(text)) !== null) {
    const cells: string[] = [];
    let tdMatch: RegExpExecArray | null;
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    while ((tdMatch = tdRe.exec(trMatch[1]!)) !== null) {
      const cell = tdMatch[1]!.replace(tagRegex, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
      cells.push(cell);
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

// ─── Column detection keywords ────────────────────────────────────────────────
const NAME_N   = ["اسم ولقب","اللقب و الاسم","اللقب والاسم","اسم","لقب","الاسم واللقب","nom prenom","nom et prenom","eleve","élève","name","full name","التلميذ"];
const PRENOM_N = ["الاسم","prenom","prénom","first name","fname","الإسم"];
const NOM_N    = ["اللقب","nom de famille","last name","lname","family"];
const BIRTH_N  = ["ميلاد","تاريخ الميلاد","naissance","birth","dob","تاريخ"];
const LEVEL_N  = ["مستوى","niveau","level","year","grade","السنة","الصف","المستوى"];
const CLASS_N  = ["فوج","قسم","classe","section","class","division","group","الفوج","القسم"];
const GENDER_N = ["جنس","الجنس","sexe","genre","gender","sex","النوع"];
const STATUS_N = ["الإعادة","اعاده","إعادة","وضعية","حالة","statut","status","situation","انتساب","الوضعية","redoublan"];
const RESULT_N = ["نتيجه","نتيجة","résultat","resultat","result","mention","قرار","النتيجة"];
const RAQM_N   = ["الرقم","رقم","#","no","n°","numero","numéro"];

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
    contains(joined, RAQM_N) ||
    (contains(joined, GENDER_N) && contains(joined, NAME_N.concat(NOM_N))) ||
    (contains(joined, LEVEL_N) && contains(joined, NAME_N.concat(NOM_N)))
  );
}

// ─── Value normalisers ────────────────────────────────────────────────────────
function normalizeGender(val: string): "M" | "F" | null {
  const raw = String(val ?? "").replace(/[\u0009\u000A\u000D\u0020\u00A0\u200B\u200C\u200D\uFEFF\u3000]/g, "").trim();
  if (!raw) return null;
  const v = norm(raw);
  // Male
  if (/ذكر/.test(v) || /^ذ$/.test(v) || /^م$/.test(v)) return "M";
  if (/^(m|male|masculin|garcon|garçon|homme|h)$/.test(v) || v === "1") return "M";
  // Female
  if (/انثي|انثى|اناث|انوثه|انوثة/.test(v)) return "F";
  if (/^(انثي|انثى|اناث|فتاه|فتاة|بنت)/.test(v)) return "F";
  if (/^ا$/.test(v) || /^أ$/.test(v)) return "F";
  if (/^(f|female|feminin|féminin|fille|femme)$/.test(v) || v === "2") return "F";
  if (raw.length === 1) {
    if (["m","h","1"].includes(raw.toLowerCase())) return "M";
    if (["f","2"].includes(raw.toLowerCase())) return "F";
  }
  return null;
}

function normalizeLevel(val: string): "1AM" | "2AM" | "3AM" | "4AM" | null {
  if (!val) return null;
  const v = norm(val);
  if (/^(اول|اولي|اولى|سنه اول|سنة اول|premiere|1ere|1ère)/.test(v)) return "1AM";
  if (/^(ثان|ثاني|ثانيه|ثانية|deuxieme|2eme|2ème)/.test(v)) return "2AM";
  if (/^(ثالث|ثالثه|ثالثة|troisieme|3eme|3ème)/.test(v)) return "3AM";
  if (/^(رابع|رابعه|رابعة|quatrieme|4eme|4ème)/.test(v)) return "4AM";
  const digits = v.replace(/١/g,"1").replace(/٢/g,"2").replace(/٣/g,"3").replace(/٤/g,"4").replace(/[^\d]/g," ").trim();
  const first = digits.split(/\s+/).find(d => d.length > 0);
  if (!first) return null;
  switch (first[0]) {
    case "1": return "1AM";
    case "2": return "2AM";
    case "3": return "3AM";
    case "4": return "4AM";
  }
  return null;
}

function normalizeStatut(val: string): "nouveau" | "redoublant" {
  const v = norm(String(val ?? ""));
  if (!v || v === "لا" || v === "no" || v === "non") return "nouveau";
  if (/^(r|redoublan|معيد|اعاده|إعاده|مكرر|تكرار|نعم|yes|oui)/.test(v)) return "redoublant";
  return "nouveau";
}

function normalizeResultat(val: string): "admis" | "non_admis" | null {
  if (!val) return null;
  const v = norm(val);
  if (/^(a|admis|ناجح|نجح|recu|reçu|pass|oui)/.test(v)) return "admis";
  if (/^(n|non|راسب|رسب|non_admis|refuse|refusé|fail|la)/.test(v)) return "non_admis";
  return null;
}

const AR_CLASS: Record<string, string> = {
  "أ": "A", "ا": "A", "ب": "B", "ج": "C", "د": "D", "ه": "E", "هـ": "E", "و": "F", "ز": "G",
};

// ─── Core import logic (shared between xlsx and html-xls) ─────────────────────
function processRows(
  raw: unknown[][],
  userId: string,
  annee: string,
  niveau: "1AM" | "2AM" | "3AM" | "4AM" | null, // null = auto-detect from file
  classe: string | null,                          // null = auto-detect from file
  logger: { info: (...a: any[]) => void }
): { toInsert: typeof studentsTable.$inferInsert[]; skipped: number; errors: string[] } {
  const errors: string[] = [];
  let skipped = 0;

  // Find header row
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    if (isHeaderRow(raw[i] as unknown[])) { headerRowIdx = i; break; }
  }

  const headerCells = (raw[headerRowIdx] as unknown[]).map(c => String(c ?? "").trim());
  const dataRows = raw.slice(headerRowIdx + 1);

  logger.info({ headerRowIdx, headers: headerCells }, "Headers detected");

  // Detect niveau from title rows if not provided
  let detectedNiveau = niveau;
  if (!detectedNiveau) {
    for (let i = 0; i < headerRowIdx; i++) {
      const titleText = (raw[i] as unknown[]).join(" ");
      detectedNiveau = normalizeLevel(titleText);
      if (detectedNiveau) break;
    }
  }

  const colRaqm   = findCol(headerCells, RAQM_N);
  const colName   = findCol(headerCells, NAME_N);
  const colNom    = findCol(headerCells, NOM_N);
  const colPrenom = findCol(headerCells, PRENOM_N);
  const colBirth  = findCol(headerCells, BIRTH_N);
  const colLevel  = findCol(headerCells, LEVEL_N);
  const colClass  = findCol(headerCells, CLASS_N);
  const colGender = findCol(headerCells, GENDER_N);
  const colStatus = findCol(headerCells, STATUS_N);
  const colResult = findCol(headerCells, RESULT_N);

  logger.info({ colRaqm, colName, colNom, colPrenom, colLevel, colClass, colGender, colStatus }, "Column map");

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

    // ── رقم (sequence number) ─────────────────────────────────────────────────
    const raqmRaw = cellStr(row, colRaqm);
    const raqm = raqmRaw && !isNaN(Number(raqmRaw)) ? Number(raqmRaw) : null;

    // ── Name ──────────────────────────────────────────────────────────────────
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
    if (!nomPrenom) {
      for (const h of headerCells) {
        const v = cellStr(row, h);
        if (v && v.length > 2 && /[\u0600-\u06FFa-zA-Z]/.test(v)) { nomPrenom = v; break; }
      }
    }
    if (!nomPrenom) { skipped++; continue; }

    // ── Level ─────────────────────────────────────────────────────────────────
    const niveauFinal = detectedNiveau ?? normalizeLevel(cellStr(row, colLevel));
    if (!niveauFinal) {
      if (errors.length < 30) errors.push(`صف ${i + headerRowIdx + 2}: مستوى غير محدد ← "${nomPrenom}"`);
      skipped++; continue;
    }

    // ── Class ─────────────────────────────────────────────────────────────────
    let classeRaw = classe ?? cellStr(row, colClass);
    if (!classeRaw) {
      // Try to extract class from title (e.g. "ثالثة متوسط 01")
      if (!detectedNiveau) {
        if (errors.length < 30) errors.push(`صف ${i + headerRowIdx + 2}: قسم مفقود ← "${nomPrenom}"`);
        skipped++; continue;
      }
      // Use raqm-based default class if title had class info
      classeRaw = "A";
    }
    classeRaw = AR_CLASS[classeRaw] ?? classeRaw.toUpperCase().replace(/\s+/g, "");

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
      userId, nomPrenom, dateNaissance,
      niveau: niveauFinal,
      classe: classeRaw,
      sexe, statut, resultat, annee,
      raqm,
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

  const students = await db.select().from(studentsTable).where(and(...conds))
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

    const LEVELS = ["1AM", "2AM", "3AM", "4AM"] as const;
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
  } catch (err) {
    req.log.error({ err }, "Stats query failed");
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.post("/students/import", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const userId = req.user!.id;
  const annee = (req.query.annee as string) || "2025-2026";

  // ── Detect file type and parse to row arrays ───────────────────────────────
  let raw: unknown[][] = [];
  const fileText = req.file.buffer.toString("utf-8").trimStart();
  const isHTML = fileText.startsWith("<");

  if (isHTML) {
    // HTML-disguised .xls (Algerian Ministry format)
    raw = parseHTMLWorkbook(req.file.buffer);
  } else {
    try {
      const wb = XLSX.read(req.file.buffer, { type: "buffer", raw: false });
      const ws = wb.Sheets[wb.SheetNames[0]!];
      raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, blankrows: false });
    } catch (e) {
      res.status(400).json({ error: "Invalid file format. Use .xlsx or the ministry .xls file." });
      return;
    }
  }

  if (!raw.length) { res.status(400).json({ error: "Empty file" }); return; }

  // ── Extract class from title rows for ministry files ──────────────────────
  // e.g. "تحليل النتائج الفصل الثالث 2023-2024 ثالثة متوسط 01"
  let titleClasse: string | null = null;
  let titleNiveau: "1AM" | "2AM" | "3AM" | "4AM" | null = null;
  for (let i = 0; i < Math.min(6, raw.length); i++) {
    const text = (raw[i] as unknown[]).join(" ");
    if (text.includes("متوسط")) {
      // Extract class number e.g. "01", "02"
      const classMatch = text.match(/متوسط\s*(\d+)/);
      if (classMatch) titleClasse = classMatch[1]!.replace(/^0+/, "") || "1";
      titleNiveau = normalizeLevel(text);
      break;
    }
  }

  const { toInsert, skipped, errors } = processRows(
    raw, userId, annee, titleNiveau, titleClasse, req.log
  );

  if (toInsert.length > 0) {
    for (let b = 0; b < toInsert.length; b += 200) {
      await db.insert(studentsTable).values(toInsert.slice(b, b + 200));
    }
  }

  req.log.info({ userId, imported: toInsert.length, skipped, errors: errors.slice(0, 5) }, "Students imported");
  res.json(ImportStudentsResponse.parse({ imported: toInsert.length, skipped, errors }));
});

router.post("/students/preview", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file" }); return; }

  const fileText = req.file.buffer.toString("utf-8").trimStart();
  const isHTML = fileText.startsWith("<");
  let raw: unknown[][] = [];

  if (isHTML) {
    raw = parseHTMLWorkbook(req.file.buffer);
  } else {
    try {
      const wb = XLSX.read(req.file.buffer, { type: "buffer", raw: false });
      const ws = wb.Sheets[wb.SheetNames[0]!];
      raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, blankrows: false });
    } catch {
      res.status(400).json({ error: "Invalid Excel file" }); return;
    }
  }

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    if (isHeaderRow(raw[i] as unknown[])) { headerRowIdx = i; break; }
  }

  const headers = (raw[headerRowIdx] as unknown[]).map(c => String(c ?? "").trim());
  const samples = raw.slice(headerRowIdx + 1, headerRowIdx + 4).map(r =>
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