import { useState, useEffect, useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Printer, TrendingUp, TrendingDown, Minus, Users, UserCheck,
  UserX, FileText, AlertTriangle, RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { StudentResult, SchoolInfo, SubjectAverage } from "@shared/types";

const BASE = import.meta.env.BASE_URL;

const LEVEL_LABELS: Record<string, string> = {
  "1AM": "السنة الأولى متوسط",
  "2AM": "السنة الثانية متوسط",
  "3AM": "السنة الثالثة متوسط",
  "4AM": "السنة الرابعة متوسط",
};
const LEVEL_SHORT: Record<string, string> = {
  "1AM": "1 م.م", "2AM": "2 م.م", "3AM": "3 م.م", "4AM": "4 م.م",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(v: number | null | undefined, dec = 2) {
  if (v == null) return "—";
  return v.toFixed(dec);
}
function pct(num: number, den: number) {
  if (!den) return "—";
  return `${Math.round((num / den) * 100)}%`;
}
function delta(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return Math.round((b - a) * 100) / 100;
}
function trendLabel(d: number | null, thr = 0.25): "up" | "down" | "flat" {
  if (d == null) return "flat";
  if (d > thr) return "up";
  if (d < -thr) return "down";
  return "flat";
}
function splitName(full: string) {
  const i = full.indexOf(" ");
  if (i < 0) return { nom: full, prenom: "" };
  return { nom: full.slice(0, i), prenom: full.slice(i + 1) };
}

// ─── Sub-stat type ────────────────────────────────────────────────────────────
interface SubjectStat extends SubjectAverage {
  t1ClassAvg: number | null;
  t2ClassAvg: number | null;
  t3ClassAvg: number | null;
}

// ─── Derived data builder ─────────────────────────────────────────────────────
function buildReportData(
  filtered: StudentResult[],
  subjectRows: SubjectAverage[],
) {
  const withAvg = filtered.filter(r => r.annualAvg !== null);
  const boys = filtered.filter(r => r.student.sexe === "M");
  const girls = filtered.filter(r => r.student.sexe === "F");
  const boysWithAvg = boys.filter(r => r.annualAvg !== null);
  const girlsWithAvg = girls.filter(r => r.annualAvg !== null);
  const passed = withAvg.filter(r => r.passed);
  const failed = withAvg.filter(r => r.passed === false);
  const boysPassed = boysWithAvg.filter(r => r.passed);
  const girlsPassed = girlsWithAvg.filter(r => r.passed);

  // Per-trimester subject class averages from student scores
  const subTriMap: Record<string, { t1: number[]; t2: number[]; t3: number[] }> = {};
  for (const r of filtered) {
    for (const [tri, subs] of Object.entries(r.scores)) {
      for (const [subj, score] of Object.entries(subs as Record<string, number>)) {
        subTriMap[subj] ??= { t1: [], t2: [], t3: [] };
        if (tri === "1") subTriMap[subj]!.t1.push(score);
        else if (tri === "2") subTriMap[subj]!.t2.push(score);
        else if (tri === "3") subTriMap[subj]!.t3.push(score);
      }
    }
  }
  const avg = (arr: number[]) => arr.length
    ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100
    : null;

  const enrichedSubjects: SubjectStat[] = subjectRows.map(s => ({
    ...s,
    t1ClassAvg: avg(subTriMap[s.subject]?.t1 ?? []),
    t2ClassAvg: avg(subTriMap[s.subject]?.t2 ?? []),
    t3ClassAvg: avg(subTriMap[s.subject]?.t3 ?? []),
  }));

  // Trimester progress per student (sorted best→worst by annual avg)
  const progressRows = withAvg
    .filter(r => r.t1Avg !== null || r.t2Avg !== null || r.t3Avg !== null)
    .map(r => ({
      ...r,
      d12: delta(r.t1Avg, r.t2Avg),
      d23: delta(r.t2Avg, r.t3Avg),
      d13: delta(r.t1Avg, r.t3Avg),
    }))
    .sort((a, b) => (b.annualAvg ?? 0) - (a.annualAvg ?? 0));

  // Failing students sorted by gap to 10 (closest = smallest gap first)
  const failingRows = failed
    .map(r => ({ ...r, gap: Math.round((10 - (r.annualAvg ?? 0)) * 100) / 100 }))
    .sort((a, b) => a.gap - b.gap);

  return {
    withAvg, passed, failed, boys, girls, boysWithAvg, girlsWithAvg,
    boysPassed, girlsPassed, progressRows, failingRows, enrichedSubjects,
    successRate: withAvg.length ? Math.round((passed.length / withAvg.length) * 100) : null,
    boysRate: boysWithAvg.length ? Math.round((boysPassed.length / boysWithAvg.length) * 100) : null,
    girlsRate: girlsWithAvg.length ? Math.round((girlsPassed.length / girlsWithAvg.length) * 100) : null,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  annee: string;
  school: SchoolInfo | null;
  allResults: StudentResult[];
}

export function ClassLevelReport({ annee, school, allResults }: Props) {
  const [reportType, setReportType] = useState<"classe" | "niveau">("classe");
  const [selectedValue, setSelectedValue] = useState("");
  const [subjects, setSubjects] = useState<SubjectAverage[]>([]);
  const [subLoading, setSubLoading] = useState(false);

  // Derive options from allResults
  const classOptions = [...new Set(
    allResults.map(r => `${r.student.niveau}|${r.student.classe}`)
  )].sort().map(k => {
    const [n, c] = k.split("|");
    return { value: k, label: `قسم ${c} — ${LEVEL_SHORT[n!] || n}`, niveau: n!, classe: c! };
  });
  const niveauOptions = [...new Set(allResults.map(r => r.student.niveau))].sort()
    .map(n => ({ value: n, label: LEVEL_LABELS[n] || n }));

  // Reset selection when type changes
  const handleTypeChange = (t: "classe" | "niveau") => {
    setReportType(t); setSelectedValue("");
  };

  // Filter results
  const filtered = selectedValue ? allResults.filter(r => {
    if (reportType === "classe") {
      const [n, c] = selectedValue.split("|");
      return r.student.niveau === n && r.student.classe === c;
    }
    return r.student.niveau === selectedValue;
  }) : [];

  // Fetch subjects for this filter
  const fetchSubjects = useCallback(async () => {
    if (!selectedValue) { setSubjects([]); return; }
    setSubLoading(true);
    try {
      const params = new URLSearchParams({ annee });
      if (reportType === "classe") {
        const [n, c] = selectedValue.split("|");
        params.set("niveau", n!); params.set("classe", c!);
      } else {
        params.set("niveau", selectedValue);
      }
      const res = await fetch(`${BASE}api/results/subjects?${params}`, { credentials: "include" });
      if (res.ok) setSubjects(await res.json());
    } finally { setSubLoading(false); }
  }, [selectedValue, reportType, annee]);

  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);

  // Build derived data
  const data = selectedValue ? buildReportData(filtered, subjects) : null;

  // Report title
  const reportTitle = selectedValue
    ? reportType === "classe"
      ? `قسم ${selectedValue.split("|")[1]} — ${LEVEL_LABELS[selectedValue.split("|")[0]!] || selectedValue.split("|")[0]}`
      : LEVEL_LABELS[selectedValue] || selectedValue
    : "";

  const today = new Date().toLocaleDateString("ar-DZ", { year: "numeric", month: "long", day: "numeric" });

  const handlePrint = () => {
    if (!data) return;
    const html = buildPrintHTML(reportTitle, annee, school, today, data);
    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 500);
  };

  // ─── JSX ──
  return (
    <div className="space-y-5">
      {/* Selector bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex rounded-xl overflow-hidden border border-violet-200 dark:border-violet-800 shadow-sm">
          {(["classe", "niveau"] as const).map(t => (
            <button
              key={t}
              onClick={() => handleTypeChange(t)}
              className={`px-4 py-2 text-xs font-bold transition-all ${
                reportType === t
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                  : "bg-card text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {t === "classe" ? "تقرير القسم" : "تقرير المستوى"}
            </button>
          ))}
        </div>

        <Select
          value={selectedValue || "__none__"}
          onValueChange={v => setSelectedValue(v === "__none__" ? "" : v)}
        >
          <SelectTrigger className="w-72 font-semibold text-sm h-10">
            <SelectValue placeholder={reportType === "classe" ? "اختر القسم..." : "اختر المستوى..."} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" className="text-muted-foreground">
              {reportType === "classe" ? "— اختر القسم —" : "— اختر المستوى —"}
            </SelectItem>
            {(reportType === "classe" ? classOptions : niveauOptions).map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {data && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <Button
              onClick={handlePrint}
              className="gap-2 h-10 font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-0 shadow-lg shadow-indigo-500/30 hover:from-indigo-700 hover:to-violet-700"
            >
              <Printer className="w-4 h-4" />
              طباعة / تصدير PDF
            </Button>
          </motion.div>
        )}
        {subLoading && (
          <RefreshCw className="w-4 h-4 text-violet-500 animate-spin" />
        )}
      </div>

      {/* Empty state */}
      {!selectedValue && (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/15 to-purple-500/10 flex items-center justify-center mb-4 border border-violet-200 dark:border-violet-800">
            <FileText className="w-8 h-8 text-violet-400" />
          </div>
          <p className="font-bold text-muted-foreground">اختر القسم أو المستوى لعرض التقرير</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            يمكنك بعدها طباعة التقرير أو تصديره كـ PDF
          </p>
        </div>
      )}

      {/* Report preview */}
      <AnimatePresence mode="wait">
        {data && selectedValue && (
          <motion.div
            key={selectedValue + reportType}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            {/* Title bar */}
            <div className="flex items-center justify-between bg-gradient-to-r from-violet-600/10 to-purple-600/5 border border-violet-200 dark:border-violet-800 rounded-2xl px-5 py-3">
              <div>
                <p className="font-black text-lg text-violet-700 dark:text-violet-300">{reportTitle}</p>
                <p className="text-xs text-muted-foreground">السنة الدراسية: {annee} — {today}</p>
              </div>
              {school && (
                <p className="text-xs text-muted-foreground text-left">{school.nom}<br/>{school.wilaya}</p>
              )}
            </div>

            {/* ── KPI row ── */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { label: "المجموع", val: filtered.length, cls: "from-violet-600 to-purple-700" },
                { label: "ذكور",    val: data.boys.length,       cls: "from-blue-600 to-sky-700" },
                { label: "إناث",   val: data.girls.length,      cls: "from-pink-600 to-rose-700" },
                { label: "ناجحون", val: data.passed.length,     cls: "from-emerald-500 to-green-600" },
                { label: "راسبون", val: data.failed.length,     cls: "from-red-500 to-rose-600" },
                { label: "نسبة النجاح", val: data.successRate != null ? `${data.successRate}%` : "—", cls: "from-amber-500 to-orange-500" },
              ].map(k => (
                <div key={k.label} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${k.cls} p-3 shadow-md`}>
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, rgba(255,255,255,.4) 0%, transparent 60%)" }} />
                  <p className="relative text-white/80 text-[10px] font-semibold">{k.label}</p>
                  <p className="relative text-white font-black text-2xl leading-none mt-1">{k.val}</p>
                </div>
              ))}
            </div>

            {/* ── Success breakdown ── */}
            <Card className="border-0 bg-card/80 shadow-md">
              <CardContent className="p-5">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                    <UserCheck className="w-3.5 h-3.5 text-white" />
                  </span>
                  نسبة النجاح التفصيلية
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "إجمالي", rate: data.successRate, cnt: data.passed.length, den: data.withAvg.length, color: "text-violet-600 dark:text-violet-400", border: "border-violet-200 dark:border-violet-800" },
                    { label: "ذكور",  rate: data.boysRate, cnt: data.boysPassed.length, den: data.boysWithAvg.length, color: "text-blue-600 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800" },
                    { label: "إناث", rate: data.girlsRate, cnt: data.girlsPassed.length, den: data.girlsWithAvg.length, color: "text-pink-600 dark:text-pink-400", border: "border-pink-200 dark:border-pink-800" },
                    { label: "الراسبون", rate: data.withAvg.length ? Math.round((data.failed.length / data.withAvg.length) * 100) : null, cnt: data.failed.length, den: data.withAvg.length, color: "text-red-600 dark:text-red-400", border: "border-red-200 dark:border-red-800" },
                  ].map(item => (
                    <div key={item.label} className={`border ${item.border} rounded-xl p-4 text-center`}>
                      <p className={`text-3xl font-black ${item.color}`}>{item.rate != null ? `${item.rate}%` : "—"}</p>
                      <p className="text-xs font-bold text-foreground mt-1">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{item.cnt} من {item.den} تلميذ</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ── Failing students ── */}
            <Card className="border-0 bg-card/80 shadow-md overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-2 px-5 py-3 border-b bg-red-50/50 dark:bg-red-950/20">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <h3 className="text-sm font-bold text-red-700 dark:text-red-400">
                    الراسبون وكم باقي لهم للمعدل 10
                  </h3>
                  <Badge variant="outline" className="border-red-300 text-red-600 text-xs ms-auto">
                    {data.failingRows.length} تلميذ
                  </Badge>
                </div>
                {data.failingRows.length === 0 ? (
                  <p className="text-center py-8 text-emerald-600 font-bold text-sm">
                    🎉 لا يوجد تلاميذ راسبون في هذا التحديد
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b text-muted-foreground">
                          <th className="p-3 text-center w-10">#</th>
                          <th className="p-3 text-right">الاسم واللقب</th>
                          <th className="p-3 text-center">القسم</th>
                          <th className="p-3 text-center">م.ف1</th>
                          <th className="p-3 text-center">م.ف2</th>
                          <th className="p-3 text-center">م.ف3</th>
                          <th className="p-3 text-center font-bold">المعدل السنوي</th>
                          <th className="p-3 text-center font-bold">باقي للـ10</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.failingRows.map((r, i) => {
                          const { nom, prenom } = splitName(r.student.nomPrenom);
                          const gapColor = r.gap <= 1
                            ? "text-amber-600 bg-amber-50 dark:bg-amber-950/30"
                            : r.gap <= 2
                            ? "text-red-500 bg-red-50 dark:bg-red-950/30"
                            : "text-red-700 bg-red-100/50 dark:bg-red-950/50";
                          return (
                            <tr key={r.student.id} className={`border-b last:border-0 hover:bg-muted/20 ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                              <td className="p-3 text-center text-muted-foreground font-semibold">{i + 1}</td>
                              <td className="p-3">
                                <span className="font-bold">{nom}</span>{" "}
                                <span className="text-muted-foreground">{prenom}</span>
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant="secondary" className="text-[10px]">{r.student.classe}</Badge>
                              </td>
                              <td className={`p-3 text-center font-semibold ${r.t1Avg != null && r.t1Avg < 10 ? "text-red-500" : ""}`}>{fmt(r.t1Avg)}</td>
                              <td className={`p-3 text-center font-semibold ${r.t2Avg != null && r.t2Avg < 10 ? "text-red-500" : ""}`}>{fmt(r.t2Avg)}</td>
                              <td className={`p-3 text-center font-semibold ${r.t3Avg != null && r.t3Avg < 10 ? "text-red-500" : ""}`}>{fmt(r.t3Avg)}</td>
                              <td className="p-3 text-center">
                                <span className="font-black text-red-600 text-base">{fmt(r.annualAvg)}</span>
                              </td>
                              <td className="p-3 text-center">
                                <span className={`font-black text-sm px-2 py-0.5 rounded-lg ${gapColor}`}>
                                  −{r.gap.toFixed(2)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Trimester progress ── */}
            <Card className="border-0 bg-card/80 shadow-md overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-2 px-5 py-3 border-b bg-blue-50/50 dark:bg-blue-950/20">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300">
                    تحسنات وتراجعات المعدل الفصلي لكل تلميذ
                  </h3>
                </div>
                {data.progressRows.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">لا توجد بيانات كافية</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b text-muted-foreground">
                          <th className="p-3 text-right">الاسم واللقب</th>
                          <th className="p-3 text-center">القسم</th>
                          <th className="p-3 text-center">م.ف1</th>
                          <th className="p-3 text-center">م.ف2</th>
                          <th className="p-3 text-center">م.ف3</th>
                          <th className="p-3 text-center">ف1→ف2</th>
                          <th className="p-3 text-center">ف2→ف3</th>
                          <th className="p-3 text-center">ف1→ف3</th>
                          <th className="p-3 text-center font-bold">المعدل</th>
                          <th className="p-3 text-center">النتيجة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.progressRows.map((r, i) => {
                          const { nom, prenom } = splitName(r.student.nomPrenom);
                          const DeltaCell = ({ d }: { d: number | null }) => {
                            const t = trendLabel(d);
                            return (
                              <td className="p-3 text-center">
                                <span className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                                  t === "up" ? "text-emerald-600" : t === "down" ? "text-red-500" : "text-muted-foreground"
                                }`}>
                                  {t === "up" ? <TrendingUp className="w-3 h-3" />
                                    : t === "down" ? <TrendingDown className="w-3 h-3" />
                                    : <Minus className="w-3 h-3" />}
                                  {d != null ? (d >= 0 ? "+" : "") + d.toFixed(2) : "—"}
                                </span>
                              </td>
                            );
                          };
                          return (
                            <tr key={r.student.id} className={`border-b last:border-0 hover:bg-muted/20 ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                              <td className="p-3">
                                <span className="font-bold">{nom}</span>{" "}
                                <span className="text-muted-foreground">{prenom}</span>
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant="secondary" className="text-[10px]">{r.student.classe}</Badge>
                              </td>
                              <td className="p-3 text-center font-semibold">{fmt(r.t1Avg)}</td>
                              <td className="p-3 text-center font-semibold">{fmt(r.t2Avg)}</td>
                              <td className="p-3 text-center font-semibold">{fmt(r.t3Avg)}</td>
                              <DeltaCell d={r.d12} />
                              <DeltaCell d={r.d23} />
                              <DeltaCell d={r.d13} />
                              <td className="p-3 text-center">
                                <span className="font-black text-base">{fmt(r.annualAvg)}</span>
                              </td>
                              <td className="p-3 text-center">
                                {r.passed === true
                                  ? <span className="text-emerald-600 font-bold flex items-center gap-1 justify-center"><UserCheck className="w-3 h-3" />ناجح</span>
                                  : r.passed === false
                                  ? <span className="text-red-500 font-bold flex items-center gap-1 justify-center"><UserX className="w-3 h-3" />راسب</span>
                                  : <span className="text-muted-foreground">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Subject analysis ── */}
            <Card className="border-0 bg-card/80 shadow-md overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-2 px-5 py-3 border-b bg-amber-50/50 dark:bg-amber-950/20">
                  <Users className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-amber-700 dark:text-amber-300">
                    تحسنات وتراجعات كل مادة (معدل القسم / المستوى)
                  </h3>
                </div>
                {data.enrichedSubjects.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground text-sm">لا توجد بيانات مواد</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b text-muted-foreground">
                          <th className="p-3 text-right">المادة</th>
                          <th className="p-3 text-center">م.ف1</th>
                          <th className="p-3 text-center">م.ف2</th>
                          <th className="p-3 text-center">م.ف3</th>
                          <th className="p-3 text-center">التطور ف1→ف3</th>
                          <th className="p-3 text-center text-emerald-600">ناجح</th>
                          <th className="p-3 text-center text-red-500">راسب</th>
                          <th className="p-3 text-center">نسبة الرسوب</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.enrichedSubjects.map((s, i) => {
                          const d = delta(s.t1ClassAvg, s.t3ClassAvg);
                          const t = trendLabel(d, 0.3);
                          return (
                            <tr key={s.subject} className={`border-b last:border-0 hover:bg-muted/20 ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                              <td className="p-3 font-bold">{s.arLabel}</td>
                              <td className="p-3 text-center font-semibold">{fmt(s.t1ClassAvg)}</td>
                              <td className="p-3 text-center font-semibold">{fmt(s.t2ClassAvg)}</td>
                              <td className="p-3 text-center font-semibold">{fmt(s.t3ClassAvg)}</td>
                              <td className="p-3 text-center">
                                <span className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                                  t === "up" ? "text-emerald-600" : t === "down" ? "text-red-500" : "text-muted-foreground"
                                }`}>
                                  {t === "up" ? <TrendingUp className="w-3 h-3" />
                                    : t === "down" ? <TrendingDown className="w-3 h-3" />
                                    : <Minus className="w-3 h-3" />}
                                  {d != null ? (d >= 0 ? "+" : "") + d.toFixed(2) : "—"}
                                </span>
                              </td>
                              <td className="p-3 text-center text-emerald-600 font-bold">{s.passCount}</td>
                              <td className="p-3 text-center text-red-500 font-bold">{s.failCount}</td>
                              <td className="p-3 text-center">
                                <Badge variant="outline" className={`text-[10px] ${
                                  s.failRate > 50 ? "border-red-300 text-red-600 bg-red-50 dark:bg-red-950/30"
                                    : s.failRate > 25 ? "border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/30"
                                    : "border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
                                }`}>
                                  {s.failRate}%
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Fix: filtered needs to be in scope for buildPrintHTML ───────────────────
// Re-export a patched version of buildPrintHTML that accepts filtered directly
function buildPrintHTML(
  title: string,
  annee: string,
  school: SchoolInfo | null,
  today: string,
  data: ReturnType<typeof buildReportData>,
) {
  const {
    withAvg, passed, failed, boys, girls, boysWithAvg, girlsWithAvg,
    boysPassed, girlsPassed, progressRows, failingRows, enrichedSubjects,
    successRate, boysRate, girlsRate,
  } = data;

  const arrowUp = "▲"; const arrowDown = "▼"; const arrowFlat = "─";

  const trendArrow = (d: number | null, thr = 0.25) => {
    const t = trendLabel(d, thr);
    if (t === "up")   return `<span style="color:#059669;font-weight:700">${arrowUp} +${Math.abs(d!).toFixed(2)}</span>`;
    if (t === "down") return `<span style="color:#dc2626;font-weight:700">${arrowDown} ${d!.toFixed(2)}</span>`;
    return `<span style="color:#9ca3af">${arrowFlat} ${d != null ? (d >= 0 ? "+" : "") + d.toFixed(2) : "—"}</span>`;
  };

  const td = (v: string | number, center = false, extra = "") =>
    `<td style="padding:5px 8px;border:1px solid #e5e7eb;${center ? "text-align:center;" : ""}${extra}">${v}</td>`;
  const th = (v: string, center = false) =>
    `<th style="background:#f3f4f6;padding:6px 8px;border:1px solid #e5e7eb;font-weight:700;font-size:11px;${center ? "text-align:center;" : "text-align:right;"}">${v}</th>`;

  const kpiBox = (lbl: string, val: string | number, bg: string, color: string) =>
    `<div style="flex:1;background:${bg};border-radius:10px;padding:12px 8px;text-align:center;min-width:90px">
       <div style="font-size:11px;color:#6b7280;margin-bottom:4px">${lbl}</div>
       <div style="font-size:22px;font-weight:900;color:${color}">${val}</div>
     </div>`;

  const successCard = (lbl: string, rate: number | null, cnt: number, den: number, color: string) =>
    `<div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;text-align:center;flex:1">
       <div style="font-size:24px;font-weight:900;color:${color}">${rate != null ? rate + "%" : "—"}</div>
       <div style="font-size:12px;font-weight:700;color:#374151;margin-top:4px">${lbl}</div>
       <div style="font-size:11px;color:#6b7280;margin-top:2px">${cnt} من ${den} تلميذ</div>
     </div>`;

  const failingTable = failingRows.length === 0
    ? `<p style="color:#059669;font-weight:700;padding:12px 0">🎉 لا يوجد تلاميذ راسبون</p>`
    : `<table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr>
          ${th("#", true)}${th("الاسم واللقب")}${th("القسم", true)}
          ${th("م.ف1", true)}${th("م.ف2", true)}${th("م.ف3", true)}
          ${th("المعدل السنوي", true)}${th("باقي للـ10", true)}
        </tr></thead>
        <tbody>${failingRows.map((r, i) => {
          const { nom, prenom } = splitName(r.student.nomPrenom);
          const gapColor = r.gap <= 1 ? "#f59e0b" : r.gap <= 2 ? "#ef4444" : "#b91c1c";
          return `<tr style="${i % 2 === 0 ? "" : "background:#f9fafb"}">
            ${td(i + 1, true)}
            ${td(`<span style="font-weight:700">${nom}</span> <span style="color:#6b7280">${prenom}</span>`)}
            ${td(r.student.classe, true)}
            ${td(fmt(r.t1Avg), true, r.t1Avg != null && r.t1Avg < 10 ? "color:#dc2626" : "")}
            ${td(fmt(r.t2Avg), true, r.t2Avg != null && r.t2Avg < 10 ? "color:#dc2626" : "")}
            ${td(fmt(r.t3Avg), true, r.t3Avg != null && r.t3Avg < 10 ? "color:#dc2626" : "")}
            ${td(`<span style="font-weight:900;color:#dc2626">${fmt(r.annualAvg)}</span>`, true)}
            ${td(`<span style="font-weight:900;color:${gapColor}">−${r.gap.toFixed(2)}</span>`, true)}
          </tr>`;
        }).join("")}</tbody>
      </table>`;

  const progressTable = progressRows.length === 0
    ? `<p style="color:#9ca3af;padding:12px 0">لا توجد بيانات</p>`
    : `<table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr>
          ${th("الاسم واللقب")}${th("القسم", true)}
          ${th("م.ف1", true)}${th("م.ف2", true)}${th("م.ف3", true)}
          ${th("ف1→ف2", true)}${th("ف2→ف3", true)}${th("ف1→ف3", true)}
          ${th("المعدل", true)}${th("النتيجة", true)}
        </tr></thead>
        <tbody>${progressRows.map((r, i) => {
          const { nom, prenom } = splitName(r.student.nomPrenom);
          const passColor = r.passed ? "#059669" : "#dc2626";
          const passTxt = r.passed ? "ناجح ✓" : "راسب ✗";
          const d12 = delta(r.t1Avg, r.t2Avg);
          const d23 = delta(r.t2Avg, r.t3Avg);
          const d13 = delta(r.t1Avg, r.t3Avg);
          return `<tr style="${i % 2 === 0 ? "" : "background:#f9fafb"}">
            ${td(`<span style="font-weight:700">${nom}</span> <span style="color:#6b7280">${prenom}</span>`)}
            ${td(r.student.classe, true)}
            ${td(fmt(r.t1Avg), true)}${td(fmt(r.t2Avg), true)}${td(fmt(r.t3Avg), true)}
            ${td(trendArrow(d12), true)}${td(trendArrow(d23), true)}${td(trendArrow(d13, 0.5), true)}
            ${td(`<span style="font-weight:900">${fmt(r.annualAvg)}</span>`, true)}
            ${td(`<span style="font-weight:700;color:${passColor}">${passTxt}</span>`, true)}
          </tr>`;
        }).join("")}</tbody>
      </table>`;

  const subjectTable = enrichedSubjects.length === 0
    ? `<p style="color:#9ca3af;padding:12px 0">لا توجد بيانات مواد</p>`
    : `<table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr>
          ${th("المادة")}
          ${th("م.ف1", true)}${th("م.ف2", true)}${th("م.ف3", true)}
          ${th("التطور ف1→ف3", true)}
          ${th("ناجح", true)}${th("راسب", true)}${th("نسبة الرسوب", true)}
        </tr></thead>
        <tbody>${enrichedSubjects.map((s, i) => {
          const d = delta(s.t1ClassAvg, s.t3ClassAvg);
          return `<tr style="${i % 2 === 0 ? "" : "background:#f9fafb"}">
            ${td(`<span style="font-weight:700">${s.arLabel}</span>`)}
            ${td(fmt(s.t1ClassAvg), true)}${td(fmt(s.t2ClassAvg), true)}${td(fmt(s.t3ClassAvg), true)}
            ${td(trendArrow(d, 0.3), true)}
            ${td(`<span style="color:#059669;font-weight:700">${s.passCount}</span>`, true)}
            ${td(`<span style="color:#dc2626;font-weight:700">${s.failCount}</span>`, true)}
            ${td(`${s.failRate}%`, true, s.failRate > 50 ? "color:#dc2626;font-weight:700" : "")}
          </tr>`;
        }).join("")}</tbody>
      </table>`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير — ${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', 'Tahoma', sans-serif; direction: rtl; font-size: 12px;
           color: #111827; background: #fff; padding: 20px 24px; }
    h2 { font-size: 13px; font-weight: 700; color: #4f46e5;
         border-bottom: 2px solid #e0e7ff; padding-bottom: 5px; margin-bottom: 12px; }
    .section { margin-bottom: 24px; }
    .page-break { page-break-before: always; padding-top: 16px; }
    @media print { body { padding: 8px 12px; } .section { margin-bottom: 14px; } }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;
              border-bottom:3px solid #4f46e5;padding-bottom:12px;margin-bottom:20px">
    <div>
      <div style="font-size:20px;font-weight:900;color:#4f46e5">${title}</div>
      ${school ? `<div style="font-size:12px;color:#6b7280;margin-top:3px">${school.nom} — ${school.wilaya} / ${school.commune}</div>` : ""}
      <div style="font-size:12px;color:#6b7280">السنة الدراسية: ${annee}</div>
    </div>
    <div style="text-align:left;font-size:11px;color:#6b7280">
      <div>تاريخ التقرير: ${today}</div>
      ${school?.directeur ? `<div>المدير: ${school.directeur}</div>` : ""}
    </div>
  </div>

  <div class="section">
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${kpiBox("مجموع التلاميذ", boys.length + girls.length, "#ede9fe", "#6d28d9")}
      ${kpiBox("ذكور", boys.length, "#dbeafe", "#1d4ed8")}
      ${kpiBox("إناث", girls.length, "#fce7f3", "#be185d")}
      ${kpiBox("الناجحون", passed.length, "#d1fae5", "#065f46")}
      ${kpiBox("الراسبون", failed.length, "#fee2e2", "#b91c1c")}
      ${successRate != null ? kpiBox("نسبة النجاح", successRate + "%", "#fef9c3", "#92400e") : ""}
    </div>
  </div>

  <div class="section">
    <h2>📊 نسبة النجاح التفصيلية</h2>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${successCard("إجمالي", successRate, passed.length, withAvg.length, "#4f46e5")}
      ${successCard("ذكور",  boysRate,  boysPassed.length,  boysWithAvg.length,  "#1d4ed8")}
      ${successCard("إناث", girlsRate, girlsPassed.length, girlsWithAvg.length, "#be185d")}
      <div style="border:1px solid #fee2e2;border-radius:10px;padding:12px;text-align:center;flex:1;background:#fff5f5">
        <div style="font-size:24px;font-weight:900;color:#b91c1c">${failed.length}</div>
        <div style="font-size:12px;font-weight:700;color:#374151;margin-top:4px">الراسبون</div>
        <div style="font-size:11px;color:#6b7280;margin-top:2px">${pct(failed.length, withAvg.length)} من المجموع</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>⚠️ الراسبون وكم باقي لهم للمعدل 10</h2>
    <p style="font-size:10px;color:#6b7280;margin-bottom:8px">مرتبون من الأقرب للنجاح إلى الأبعد</p>
    ${failingTable}
  </div>

  <div class="section page-break">
    <h2>📈 تحسنات وتراجعات المعدل الفصلي لكل تلميذ</h2>
    <p style="font-size:10px;color:#6b7280;margin-bottom:8px">م.ف = معدل الفصل | ف1→ف2/ف3 = التغير بين الفصول</p>
    ${progressTable}
  </div>

  <div class="section">
    <h2>📚 تحسنات وتراجعات كل مادة (معدل القسم)</h2>
    <p style="font-size:10px;color:#6b7280;margin-bottom:8px">م.ف1/2/3 = معدل القسم في المادة | التطور = الفرق بين ف1 و ف3</p>
    ${subjectTable}
  </div>

  <div style="border-top:1px solid #e5e7eb;padding-top:8px;margin-top:20px;
              display:flex;justify-content:space-between;font-size:10px;color:#9ca3af">
    <span>CEM Manager — مدير المتوسطة</span>
    <span>${title} | ${annee}</span>
  </div>
</body>
</html>`;
}
