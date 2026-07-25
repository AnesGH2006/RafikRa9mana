/**
 * قوائم الموجهين
 * 4AM students who qualified for orientation to secondary school (lycée).
 * A student qualifies when annualAvg >= 10 AND niveau = 4AM.
 * The page groups them by proposed track (علمي / أدبي / تقني) and provides
 * a printable oriented-students list with class breakdown.
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, Compass, GraduationCap, Users } from "lucide-react";

const BASE = import.meta.env.BASE_URL;
const YEARS = ["2026-2027", "2025-2026", "2024-2025", "2023-2024"];
const DEFAULT_YEAR = "2025-2026";

interface StudentResult {
  student: { id: string; nomPrenom: string; niveau: string; classe: string; sexe: "M" | "F"; };
  annualAvg: number | null;
  t1Avg: number | null; t2Avg: number | null; t3Avg: number | null;
}

/** Heuristic track assignment based on annual average */
function trackFor(avg: number): { label: string; color: string } {
  if (avg >= 14) return { label: "علمي", color: "text-blue-500" };
  if (avg >= 12) return { label: "أدبي وفلسفي", color: "text-emerald-500" };
  return { label: "تقني رياضي", color: "text-amber-500" };
}

export default function YearEndGuides() {
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [annee, setAnnee] = useState(DEFAULT_YEAR);
  const [classe, setClasse] = useState("all");
  const [track, setTrack] = useState("all");

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ annee, niveau: "4AM" });
    fetch(`${BASE}api/results?${p}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((d: StudentResult[]) => { setResults(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [annee]);

  const oriented = results
    .filter(r => r.annualAvg !== null && r.annualAvg >= 10)
    .filter(r => classe === "all" || r.student.classe === classe)
    .filter(r => track === "all" || trackFor(r.annualAvg!).label === track)
    .sort((a, b) => (b.annualAvg ?? 0) - (a.annualAvg ?? 0));

  const classes = [...new Set(results.map(r => r.student.classe))].sort();

  const trackCounts = {
    "علمي": results.filter(r => (r.annualAvg ?? 0) >= 14).length,
    "أدبي وفلسفي": results.filter(r => (r.annualAvg ?? 0) >= 12 && (r.annualAvg ?? 0) < 14).length,
    "تقني رياضي": results.filter(r => (r.annualAvg ?? 0) >= 10 && (r.annualAvg ?? 0) < 12).length,
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Compass className="w-4 h-4 text-purple-400" />
            </span>
            قوائم الموجهين
          </h1>
          <p className="text-muted-foreground text-sm mt-1">تلاميذ السنة الرابعة المؤهلون للتوجيه إلى الثانوية</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1" /> طباعة
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "إجمالي الموجَّهين", value: oriented.length, color: "from-purple-500 to-violet-600" },
          ...Object.entries(trackCounts).map(([label, value]) => ({
            label, value, color:
              label === "علمي" ? "from-blue-500 to-blue-600" :
              label === "أدبي وفلسفي" ? "from-emerald-500 to-green-600" :
              "from-amber-500 to-orange-600",
          })),
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl p-4 bg-gradient-to-br ${color} text-white shadow-lg`}>
            <p className="text-white/70 text-xs font-semibold">{label}</p>
            <p className="text-3xl font-extrabold mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Track info */}
      <div className="rounded-xl border bg-muted/30 p-4 mb-5 text-sm">
        <p className="font-semibold mb-2 text-xs text-muted-foreground">معيار التوجيه (تلقائي بالمعدل)</p>
        <div className="flex flex-wrap gap-3">
          {[
            { label: "علمي", range: "معدل ≥ 14", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
            { label: "أدبي وفلسفي", range: "معدل 12 – 13.99", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
            { label: "تقني رياضي", range: "معدل 10 – 11.99", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
          ].map(t => (
            <span key={t.label} className={`px-3 py-1 rounded-full border text-xs font-semibold ${t.color}`}>
              {t.label} — {t.range}
            </span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 print:hidden">
        <Select value={annee} onValueChange={setAnnee}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={classe} onValueChange={setClasse}>
          <SelectTrigger className="w-28"><SelectValue placeholder="القسم" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأقسام</SelectItem>
            {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={track} onValueChange={setTrack}>
          <SelectTrigger className="w-36"><SelectValue placeholder="الشعبة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الشعب</SelectItem>
            <SelectItem value="علمي">علمي</SelectItem>
            <SelectItem value="أدبي وفلسفي">أدبي وفلسفي</SelectItem>
            <SelectItem value="تقني رياضي">تقني رياضي</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-purple-500/10 border-b border-purple-500/20">
            <tr>
              {["الرتبة","اسم التلميذ","القسم","الجنس","المعدل السنوي","الشعبة المقترحة"].map(h => (
                <th key={h} className="px-3 py-3 text-start text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-16 text-muted-foreground">جارٍ التحميل…</td></tr>
            ) : oriented.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-16 text-muted-foreground">لا يوجد تلاميذ موجَّهون بعد</td></tr>
            ) : oriented.map((r, i) => {
              const t = trackFor(r.annualAvg!);
              return (
                <motion.tr key={r.student.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.01, 0.3) }}
                  className={`border-t ${i % 2 === 0 ? "" : "bg-muted/10"} hover:bg-purple-500/5 transition-colors`}
                >
                  <td className="px-3 py-2.5 text-xs font-bold text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium">{r.student.nomPrenom}</td>
                  <td className="px-3 py-2.5"><Badge variant="outline">{r.student.classe}</Badge></td>
                  <td className="px-3 py-2.5 text-xs">{r.student.sexe === "M" ? "ذكر" : "أنثى"}</td>
                  <td className="px-3 py-2.5 font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {r.annualAvg?.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs font-bold ${t.color}`}>{t.label}</span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {oriented.length > 0 && <p className="text-xs text-muted-foreground mt-3 text-end">إجمالي: {oriented.length} تلميذ موجَّه</p>}
    </motion.div>
  );
}
