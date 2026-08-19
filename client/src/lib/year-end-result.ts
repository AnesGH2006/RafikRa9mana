export interface YearEndResult {
  student: { niveau: string };
  annualAvg: number | null;
  bemAvg?: number | null;
  finalAvg?: number | null;
  finalPassed?: boolean | null;
}

export function getFinalAvg(result: YearEndResult): number | null {
  if (result.student.niveau === "4AM") return result.bemAvg ?? result.finalAvg ?? null;
  return result.annualAvg;
}

export function getFinalPassed(result: YearEndResult): boolean | null {
  const average = getFinalAvg(result);
  return average === null ? null : average >= 10;
}
