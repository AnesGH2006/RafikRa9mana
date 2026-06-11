import crypto from "crypto";
import { Router, type IRouter } from "express";
import { eq, and, ilike, sql } from "drizzle-orm";
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
  ResultatEnum,
} from "../../shared/schemas.js";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const NAME_KEYS = ["nom", "nomprenom", "nom prénom", "nom et prénom", "اسم", "اسم ولقب", "name", "full name", "élève", "eleve", "prenom nom"];
const BIRTH_KEYS = ["naissance", "date de naissance", "date naissance", "datenaissance", "تاريخ الميلاد", "تاريخ", "birth", "dob", "birthdate", "né le"];
const LEVEL_KEYS = ["niveau", "المستوى", "مستوى", "level", "class level", "year"];
const CLASS_KEYS = ["classe", "section", "قسم", "القسم", "class", "classroom", "division"];
const GENDER_KEYS = ["sexe", "genre", "جنس", "الجنس", "gender", "sex"];
const STATUS_KEYS = ["statut", "حالة", "الحالة", "status", "type", "condition", "situation"];
const RESULT_KEYS = ["résultat", "resultat", "نتيجة", "النتيجة", "result", "mention", "décision"];

function findVal(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const found = Object.keys(row).find(k => k.toLowerCase().replace(/\s+/g, "").includes(key.replace(/\s+/g, "")));
    if (found !== undefined && row[found] !== undefined && row[found] !== "") return String(row[found]).trim();
  }
  return "";
}

function normalizeGender(val: string): "M" | "F" | null {
  const v = val.toLowerCase().trim();
  if (["m", "male", "masculin", "ذكر", "garçon", "garcon", "boy", "h", "homme"].some(x => v.startsWith(x))) return "M";
  if (["f", "female", "féminin", "feminin", "أنثى", "انثى", "fille", "girl", "femme"].some(x => v.startsWith(x))) return "F";
  return null;
}

function normalizeLevel(val: string): "1AM" | "2AM" | "3AM" | "4AM" | null {
  const v = val.toLowerCase().trim().replace(/\s+/g, "").replace(/[ère|ème|eme|ere]/g, "");
  if (v.includes("1") || v.includes("première") || v.includes("premiere") || v.includes("السنةالأولى")) return "1AM";
  if (v.includes("2") || v.includes("deuxième") || v.includes("deuxieme") || v.includes("السنةالثانية")) return "2AM";
  if (v.includes("3") || v.includes("troisième") || v.includes("troisieme") || v.includes("السنةالثالثة")) return "3AM";
  if (v.includes("4") || v.includes("quatrième") || v.includes("quatrieme") || v.includes("السنةالرابعة")) return "4AM";
  return null;
}

function normalizeStatut(val: string): "nouveau" | "redoublant" {
  const v = val.toLowerCase().trim();
  if (["r", "redoublant", "معيد", "repeater", "ancien", "rep"].some(x => v.startsWith(x))) return "redoublant";
  return "nouveau";
}

function normalizeResultat(val: string): "admis" | "non_admis" | null {
  if (!val) return null;
  const v = val.toLowerCase().trim();
  if (["a", "admis", "ناجح", "pass", "reçu", "recu", "oui"].some(x => v.startsWith(x))) return "admis";
  if (["n", "non", "na", "راسب", "fail", "refusé", "refuse", "non_admis"].some(x => v.startsWith(x))) return "non_admis";
  return null;
}

router.get("/students", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const { annee, niveau, classe, sexe, statut, q } = req.query as Record<string, string>;

  const conditions = [eq(studentsTable.userId, userId)];
  if (annee) conditions.push(eq(studentsTable.annee, annee));
  if (niveau && NiveauEnum.safeParse(niveau).success) conditions.push(eq(studentsTable.niveau, niveau as any));
  if (classe) conditions.push(eq(studentsTable.classe, classe));
  if (sexe && SexeEnum.safeParse(sexe).success) conditions.push(eq(studentsTable.sexe, sexe as any));
  if (statut && StatutEnum.safeParse(statut).success) conditions.push(eq(studentsTable.statut, statut as any));
  if (q) conditions.push(ilike(studentsTable.nomPrenom, `%${q}%`));

  const students = await db.select().from(studentsTable).where(and(...conditions)).orderBy(studentsTable.niveau, studentsTable.classe, studentsTable.nomPrenom);

  res.json(ListStudentsResponse.parse({ students, total: students.length }));
});

router.get("/stats", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const { annee } = req.query as Record<string, string>;

  const conditions = [eq(studentsTable.userId, userId)];
  if (annee) conditions.push(eq(studentsTable.annee, annee));

  const all = await db.select().from(studentsTable).where(and(...conditions));

  const LEVELS = ["1AM", "2AM", "3AM", "4AM"] as const;
  const byLevel = LEVELS.map(niveau => {
    const group = all.filter(s => s.niveau === niveau);
    return {
      niveau,
      total: group.length,
      boys: group.filter(s => s.sexe === "M").length,
      girls: group.filter(s => s.sexe === "F").length,
      admis: group.filter(s => s.resultat === "admis").length,
      nonAdmis: group.filter(s => s.resultat === "non_admis").length,
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

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: "buffer" });
  } catch {
    res.status(400).json({ error: "Invalid Excel file" }); return;
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  if (!rows.length) { res.status(400).json({ error: "Empty file" }); return; }

  const toInsert: typeof studentsTable.$inferInsert[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const nomPrenom = findVal(row, NAME_KEYS);
    if (!nomPrenom) { skipped++; continue; }

    const levelRaw = findVal(row, LEVEL_KEYS);
    const niveau = normalizeLevel(levelRaw);
    if (!niveau) {
      errors.push(`Row ${i + 2}: niveau invalide "${levelRaw}" pour "${nomPrenom}"`);
      skipped++; continue;
    }

    const classeRaw = findVal(row, CLASS_KEYS);
    if (!classeRaw) {
      errors.push(`Row ${i + 2}: classe manquante pour "${nomPrenom}"`);
      skipped++; continue;
    }

    const genderRaw = findVal(row, GENDER_KEYS);
    const sexe = normalizeGender(genderRaw);
    if (!sexe) {
      errors.push(`Row ${i + 2}: sexe invalide "${genderRaw}" pour "${nomPrenom}"`);
      skipped++; continue;
    }

    const statutRaw = findVal(row, STATUS_KEYS);
    const statut = normalizeStatut(statutRaw);
    const dateNaissance = findVal(row, BIRTH_KEYS) || null;
    const resultatRaw = findVal(row, RESULT_KEYS);
    const resultat = normalizeResultat(resultatRaw);

    toInsert.push({
      id: crypto.randomBytes(16).toString("hex"),
      userId,
      nomPrenom,
      dateNaissance,
      niveau,
      classe: classeRaw.toUpperCase(),
      sexe,
      statut,
      resultat,
      annee,
    });
  }

  if (toInsert.length > 0) {
    await db.insert(studentsTable).values(toInsert);
  }

  req.log.info({ userId, imported: toInsert.length, skipped }, "Students imported");
  res.json(ImportStudentsResponse.parse({ imported: toInsert.length, skipped, errors: errors.slice(0, 20) }));
});

router.delete("/students", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user!.id;
  const { annee } = req.query as Record<string, string>;

  const conditions = [eq(studentsTable.userId, userId)];
  if (annee) conditions.push(eq(studentsTable.annee, annee));

  await db.delete(studentsTable).where(and(...conditions));
  res.json({ success: true });
});

export default router;
