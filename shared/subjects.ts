import type { SubjectDef, Niveau } from "./types.js";

// CEM subject definitions (Algerian curriculum)
export const CEM_SUBJECTS: SubjectDef[] = [
  { key: "arabic",  arLabel: "اللغة العربية",            coef: 3 },
  { key: "french",  arLabel: "اللغة الفرنسية",            coef: 3 },
  { key: "math",    arLabel: "الرياضيات",                coef: 4 },
  { key: "science", arLabel: "علوم الطبيعة والحياة",      coef: 2 },
  { key: "physics", arLabel: "العلوم الفيزيائية",         coef: 2, levels: ["2AM","3AM","4AM"] },
  { key: "history", arLabel: "التاريخ والجغرافيا",        coef: 2 },
  { key: "islamic", arLabel: "التربية الإسلامية",         coef: 2 },
  { key: "civic",   arLabel: "التربية المدنية",            coef: 1 },
  { key: "english", arLabel: "اللغة الإنجليزية",          coef: 2 },
  { key: "pe",      arLabel: "التربية البدنية والرياضية",  coef: 1 },
];

export function getSubjectsForLevel(niveau: Niveau): SubjectDef[] {
  return CEM_SUBJECTS.filter(s => !s.levels || s.levels.includes(niveau));
}

export function calcWeightedAvg(scores: Record<string, number>, subjects: SubjectDef[]): number | null {
  let totalScore = 0;
  let totalCoef = 0;
  for (const s of subjects) {
    const score = scores[s.key];
    if (score !== undefined && !isNaN(score)) {
      totalScore += score * s.coef;
      totalCoef += s.coef;
    }
  }
  if (totalCoef === 0) return null;
  return Math.round((totalScore / totalCoef) * 100) / 100;
}
