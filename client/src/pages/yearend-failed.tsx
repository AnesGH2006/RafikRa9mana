import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, AlertCircle, Users } from "lucide-react";

const BASE = import.meta.env.BASE_URL;
const YEARS = ["2026-2027", "2025-2026", "2024-2025", "2023-2024"];
const DEFAULT_YEAR = "2025-2026";

interface StudentResult {
  student: { id: string; nomPrenom: string; niveau: string; classe: string; sexe: "M" | "F"; statut: "nouveau" | "redoublant"; };
  annualAvg: number | null;
  t1Avg: number | null; t2Avg: number | null; t3Avg: number | null;
}

const LEVEL_LABELS: Record<string, string> = { "1AM": "1م", "2AM": "2م", "3AM": "3م", "4AM": "4م" };
const LEVEL_COLORS: Record<string, string> = { "1AM": "#6366f1", "2AM": "#8b5cf6", "3AM": "#a855f7", "4AM": "#d946ef" };

export default function YearEndFailed() {
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [annee, setAnnee] = useState(DEFAULT_YEAR);
  const [niveau, setNiveau] = useState("all");
  const [classe, setClasse] = useState("all");

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ annee });
    if (niveau !== "all") p.set("niveau", niveau);
    fetch(`${BASE}api/results?${p}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((d: StudentResult[]) => { setResults(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [annee, niveau]);

  const failed = results
    .filter(r => r.annualAvg !== null && r.annualAvg < 9)
    .filter(r => classe === "all" || r.student.classe === classe)
    .sort((a, b) => (b.annualAvg ?? 0) - (a.annualAvg ?? 0));

  const classes = [...new Set(results.map(r => r.student.classe))].sort();
  const redoublants = failed.filter(r => r.student.statut === "redoublant").length;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-400" />
            </span>
            قوائم التلاميذ الراسبين
          </h1>
          <p className="text-muted-foreground text-sm mt-1">التلاميذ الذين لم يبلغ معدلهم السنوي 9/20</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1" /> طباعة
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "إجمالي الراسبين", value: failed.length, color: "from-red-500 to-rose-600" },
          { label: "معيدون", value: redoublants, color: "from-orange-500 to-amber-600" },
          { label: "جدد", value: failed.length - redoublants, color: "from-slate-500 to-slate-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl p-4 bg-gradient-to-br ${color} text-white shadow-lg`}>
            <p className="text-white/70 text-xs font-semibold">{label}</p>
            <p className="text-3xl font-extrabold mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-4 print:hidden">
        <Select value={annee} onValueChange={setAnnee}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={niveau} onValueChange={v => { setNiveau(v); setClasse("all"); }}>
          <SelectTrigger className="w-28"><SelectValue placeholder="المستوى" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المستويات</SelectItem>
            {["1AM","2AM","3AM","4AM"].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={classe} onValueChange={setClasse}>
          <SelectTrigger className="w-28"><SelectValue placeholder="القسم" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأقسام</SelectItem>
            {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-red-500/10 border-b border-red-500/20">
            <tr>
              {["#","اسم التلميذ","المستوى","القسم","الحالة","ت1","ت2","ت3","المعدل السنوي"].map(h => (
                <th key={h} className="px-3 py-3 text-start text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-16 text-muted-foreground">جارٍ التحميل…</td></tr>
            ) : failed.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-16 text-muted-foreground">لا يوجد تلاميذ راسبون</td></tr>
            ) : failed.map((r, i) => (
              <motion.tr key={r.student.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.01, 0.3) }}
                className={`border-t ${i % 2 === 0 ? "" : "bg-muted/10"} hover:bg-red-500/5 transition-colors`}
              >
                <td className="px-3 py-2.5 text-xs text-muted-foreground font-bold">{i + 1}</td>
                <td className="px-3 py-2.5 font-medium">{r.student.nomPrenom}</td>
                <td className="px-3 py-2.5">
                  <Badge style={{ background: LEVEL_COLORS[r.student.niveau] + "33", color: LEVEL_COLORS[r.student.niveau] }}>
                    {LEVEL_LABELS[r.student.niveau] ?? r.student.niveau}
                  </Badge>
                </td>
                <td className="px-3 py-2.5"><Badge variant="outline">{r.student.classe}</Badge></td>
                <td className="px-3 py-2.5">
                  <Badge variant={r.student.statut === "redoublant" ? "destructive" : "secondary"} className="text-xs">
                    {r.student.statut === "redoublant" ? "معيد" : "جديد"}
                  </Badge>
                </td>
                {[r.t1Avg, r.t2Avg, r.t3Avg].map((a, ti) => (
                  <td key={ti} className={`px-3 py-2.5 font-mono text-xs ${a === null ? "text-muted-foreground" : a >= 10 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                    {a !== null ? a.toFixed(2) : "—"}
                  </td>
                ))}
                <td className="px-3 py-2.5">
                  <span className="font-bold font-mono text-red-500 text-base">{r.annualAvg?.toFixed(2)}</span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      {failed.length > 0 && <p className="text-xs text-muted-foreground mt-3 text-end">إجمالي: {failed.length} تلميذ راسب</p>}
    </motion.div>
  );
}
