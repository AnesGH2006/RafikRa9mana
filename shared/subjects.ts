// Algerian middle school (CEM) subject coefficients
// Source: Official Algerian Ministry of Education grading system

export interface Subject {
  key: string;
  arLabel: string;
  frLabel: string;
  coef: number;
}

// ── 1AM & 2AM ─────────────────────────────────────────────────────────────────
const SUBJECTS_1_2AM: Subject[] = [
  { key: "arabe",        arLabel: "اللغة العربية",                    frLabel: "Langue Arabe",         coef: 3 },
  { key: "maths",        arLabel: "الرياضيات",                        frLabel: "Mathématiques",        coef: 3 },
  { key: "francais",     arLabel: "اللغة الفرنسية",                   frLabel: "Langue Française",     coef: 2 },
  { key: "anglais",      arLabel: "اللغة الإنجليزية",                  frLabel: "Langue Anglaise",      coef: 2 },
  { key: "histoire_geo", arLabel: "التاريخ والجغرافيا",                frLabel: "Histoire-Géographie",  coef: 2 },
  { key: "svt",          arLabel: "علوم الطبيعة والحياة",              frLabel: "SVT",                  coef: 2 },
  { key: "physique",     arLabel: "العلوم الفيزيائية والتكنولوجيا",    frLabel: "Physique-Technologie", coef: 2 },
  { key: "islam",        arLabel: "التربية الإسلامية",                 frLabel: "Éducation Islamique",  coef: 1 },
  { key: "civique",      arLabel: "التربية المدنية",                   frLabel: "Éducation Civique",    coef: 1 },
  { key: "arts",         arLabel: "التربية التشكيلية / الموسيقية",     frLabel: "Arts / Musique",       coef: 1 },
  { key: "eps",          arLabel: "التربية البدنية والرياضية",          frLabel: "EPS",                  coef: 1 },
  { key: "amazigh",      arLabel: "اللغة الأمازيغية",                  frLabel: "Langue Amazighe",      coef: 1 },
];

// ── 3AM — identical to 1AM/2AM ────────────────────────────────────────────────
const SUBJECTS_3AM: Subject[] = [
  { key: "arabe",        arLabel: "اللغة العربية",                    frLabel: "Langue Arabe",         coef: 3 },
  { key: "maths",        arLabel: "الرياضيات",                        frLabel: "Mathématiques",        coef: 3 },
  { key: "francais",     arLabel: "اللغة الفرنسية",                   frLabel: "Langue Française",     coef: 2 },
  { key: "anglais",      arLabel: "اللغة الإنجليزية",                  frLabel: "Langue Anglaise",      coef: 2 },
  { key: "histoire_geo", arLabel: "التاريخ والجغرافيا",                frLabel: "Histoire-Géographie",  coef: 2 },
  { key: "svt",          arLabel: "علوم الطبيعة والحياة",              frLabel: "SVT",                  coef: 2 },
  { key: "physique",     arLabel: "العلوم الفيزيائية والتكنولوجيا",    frLabel: "Physique-Technologie", coef: 2 },
  { key: "islam",        arLabel: "التربية الإسلامية",                 frLabel: "Éducation Islamique",  coef: 1 },
  { key: "civique",      arLabel: "التربية المدنية",                   frLabel: "Éducation Civique",    coef: 1 },
  { key: "arts",         arLabel: "التربية التشكيلية / الموسيقية",     frLabel: "Arts / Musique",       coef: 1 },
  { key: "eps",          arLabel: "التربية البدنية والرياضية",          frLabel: "EPS",                  coef: 1 },
  { key: "amazigh",      arLabel: "اللغة الأمازيغية",                  frLabel: "Langue Amazighe",      coef: 1 },
];

// ── 4AM (BEM) — higher coefficients for core subjects ─────────────────────────
const SUBJECTS_4AM: Subject[] = [
  { key: "arabe",        arLabel: "اللغة العربية",                    frLabel: "Langue Arabe",         coef: 5 },
  { key: "maths",        arLabel: "الرياضيات",                        frLabel: "Mathématiques",        coef: 4 },
  { key: "francais",     arLabel: "اللغة الفرنسية",                   frLabel: "Langue Française",     coef: 3 },
  { key: "histoire_geo", arLabel: "التاريخ والجغرافيا",                frLabel: "Histoire-Géographie",  coef: 3 },
  { key: "svt",          arLabel: "علوم الطبيعة والحياة",              frLabel: "SVT",                  coef: 2 },
  { key: "physique",     arLabel: "العلوم الفيزيائية والتكنولوجيا",    frLabel: "Physique-Technologie", coef: 2 },
  { key: "anglais",      arLabel: "اللغة الإنجليزية",                  frLabel: "Langue Anglaise",      coef: 2 },
  { key: "islam",        arLabel: "التربية الإسلامية",                 frLabel: "Éducation Islamique",  coef: 2 },
  { key: "civique",      arLabel: "التربية المدنية",                   frLabel: "Éducation Civique",    coef: 1 },
  { key: "eps",          arLabel: "التربية البدنية والرياضية",          frLabel: "EPS",                  coef: 1 },
  { key: "amazigh",      arLabel: "اللغة الأمازيغية",                  frLabel: "Langue Amazighe",      coef: 1 },
  // Note: التشكيلية/الموسيقية not listed for 4AM in official BEM coefficients
];

// ── Lookup ────────────────────────────────────────────────────────────────────
export type Niveau = "1AM" | "2AM" | "3AM" | "4AM";

export function getSubjectsForLevel(niveau: Niveau): Subject[] {
  switch (niveau) {
    case "1AM":
    case "2AM": return SUBJECTS_1_2AM;
    case "3AM": return SUBJECTS_3AM;
    case "4AM": return SUBJECTS_4AM;
    default:    return SUBJECTS_3AM;
  }
}

/**
 * Calculate weighted trimester average.
 * Formula: Σ(grade × coef) / Σ(coef)
 * Subjects with grade 0 or missing are excluded from both numerator and denominator.
 * Returns null if no valid grades exist.
 */
export function calcWeightedAvg(
  grades: Record<string, number>,
  subjects: Subject[]
): number | null {
  let weightedSum = 0;
  let totalCoef = 0;

  for (const s of subjects) {
    const grade = grades[s.key];
    // Exclude truly missing grades (undefined/null) and negative values.
    // Grade 0 IS valid and must be included so the denominator matches the Ministry's calculation.
    if (grade === undefined || grade === null || isNaN(grade) || grade < 0 || s.coef === 0) continue;
    weightedSum += grade * s.coef;
    totalCoef   += s.coef;
  }

  if (totalCoef === 0) return null;
  return Math.round((weightedSum / totalCoef) * 100) / 100;
}

/**
 * Calculate annual average from three trimester averages.
 * Uses only non-null trimesters.
 */
export function calcAnnualAvg(
  t1: number | null,
  t2: number | null,
  t3: number | null
): number | null {
  const available = [t1, t2, t3].filter((v): v is number => v !== null && v > 0);
  if (available.length === 0) return null;
  return Math.round((available.reduce((a, b) => a + b, 0) / available.length) * 100) / 100;
}

/**
 * Determine pass/fail.
 * Pass threshold is 10/20.
 */
export function isPassed(annualAvg: number | null): boolean | null {
  if (annualAvg === null) return null;
  return annualAvg >= 10;
}

// Legacy export for compatibility
export const CEM_SUBJECTS = SUBJECTS_3AM;