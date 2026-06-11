import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/language-provider";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Printer, GraduationCap } from "lucide-react";
import type { StudentResult } from "@shared/types";
import type { Niveau } from "@shared/types";

const BASE = import.meta.env.BASE_URL;
const LEVELS: Niveau[] = ["1AM", "2AM", "3AM", "4AM"];
const LEVEL_LABELS: Record<Niveau, string> = { "1AM": "1ère AM", "2AM": "2ème AM", "3AM": "3ème AM", "4AM": "4ème AM" };

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export default function YearEnd() {
  const { t } = useLanguage();
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"passed" | "failed" | "all">("all");
  const [filters, setFilters] = useState({ niveau: "", classe: "" });

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filters.niveau) p.set("niveau", filters.niveau);
    if (filters.classe) p.set("classe", filters.classe);
    fetch(`${BASE}api/results?${p}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((d: StudentResult[]) => { setResults(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filters]);

  const withAvg = results.filter(r => r.annualAvg !== null);
  const passed  = withAvg.filter(r => r.passed === true).sort((a, b) => (b.annualAvg ?? 0) - (a.annualAvg ?? 0));
  const failed  = withAvg.filter(r => r.passed === false).sort((a, b) => (b.annualAvg ?? 0) - (a.annualAvg ?? 0));
  const all     = withAvg.sort((a, b) => (b.annualAvg ?? 0) - (a.annualAvg ?? 0));

  const displayed = tab === "passed" ? passed : tab === "failed" ? failed : all;
  const classes = [...new Set(results.map(r => r.student.classe))].sort();

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 space-y-5 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <motion.h1 className="text-2xl font-bold" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          {t("yearend.title")}
        </motion.h1>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            {t("yearend.print")}
          </Button>
        </motion.div>
      </div>

      {/* Summary pills */}
      <motion.div className="flex flex-wrap gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex gap-2">
          {(["all", "passed", "failed"] as const).map(tb => (
            <motion.button key={tb} onClick={() => setTab(tb)} whileTap={{ scale: 0.95 }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === tb ? "bg-blue-600 text-white shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}>
              {tb === "all" ? t("yearend.all") : tb === "passed" ? t("yearend.passed") : t("yearend.failed")}
              <span className={`ms-2 text-xs px-1.5 py-0.5 rounded-full ${tab === tb ? "bg-white/20" : "bg-muted-foreground/10"}`}>
                {tb === "all" ? all.length : tb === "passed" ? passed.length : failed.length}
              </span>
            </motion.button>
          ))}
        </div>
        <Select value={filters.niveau || "__all__"} onValueChange={v => setFilters(p => ({ ...p, niveau: v === "__all__" ? "" : v, classe: "" }))}>
          <SelectTrigger className="w-36"><SelectValue placeholder={t("students.filterLevel")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("students.allLevels")}</SelectItem>
            {LEVELS.map(l => <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.classe || "__all__"} onValueChange={v => setFilters(p => ({ ...p, classe: v === "__all__" ? "" : v }))}>
          <SelectTrigger className="w-32"><SelectValue placeholder={t("students.filterClass")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("students.allClasses")}</SelectItem>
            {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Stats row */}
      {!loading && all.length > 0 && (
        <motion.div className="flex flex-wrap gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          {[
            { label: "مجموع التلاميذ", value: all.length, color: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300" },
            { label: t("yearend.passed"), value: passed.length, color: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" },
            { label: t("yearend.failed"), value: failed.length, color: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300" },
            { label: "نسبة النجاح", value: all.length ? `${Math.round((passed.length / all.length) * 100)}%` : "—", color: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300" },
          ].map((s, i) => (
            <motion.div key={i} className={`flex items-center gap-2 px-4 py-2 rounded-xl ${s.color}`}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }}>
              <span className="text-xl font-extrabold">{s.value}</span>
              <span className="text-xs opacity-70">{s.label}</span>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Print-ready table */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <motion.div key={i} className="h-11 rounded-lg bg-muted"
                animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }} />
            ))}
          </motion.div>
        ) : displayed.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 text-muted-foreground">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}>
              <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-20" />
            </motion.div>
            <p>{t("yearend.noData")}</p>
          </motion.div>
        ) : (
          <motion.div key={`table-${tab}-${filters.niveau}-${filters.classe}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-xl border overflow-hidden shadow-sm print:border-0 print:shadow-none">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 print:bg-gray-100">
                <tr>
                  {["الرتبة", t("col.name"), t("col.level"), t("col.class"), t("col.t1"), t("col.t2"), t("col.t3"), t("col.avg"), t("col.result")].map(h => (
                    <th key={h} className="px-3 py-3 text-start text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((r, i) => (
                  <motion.tr key={r.student.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.015, 0.35) }}
                    className={`border-t ${i % 2 === 0 ? "" : "bg-muted/15"}`}
                  >
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-bold ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-500" : i === 2 ? "text-orange-500" : "text-muted-foreground"}`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium">{r.student.nomPrenom}</td>
                    <td className="px-3 py-2.5"><Badge variant="secondary" className="text-xs">{LEVEL_LABELS[r.student.niveau as Niveau]}</Badge></td>
                    <td className="px-3 py-2.5"><Badge variant="outline">{r.student.classe}</Badge></td>
                    {[r.t1Avg, r.t2Avg, r.t3Avg].map((a, ti) => (
                      <td key={ti} className={`px-3 py-2.5 font-mono text-xs ${a === null ? "text-muted-foreground" : a >= 10 ? "text-emerald-600" : "text-red-500"}`}>
                        {a !== null ? a.toFixed(2) : "—"}
                      </td>
                    ))}
                    <td className={`px-3 py-2.5 font-bold font-mono ${(r.annualAvg ?? 0) >= 10 ? "text-emerald-600" : "text-red-500"}`}>
                      {r.annualAvg?.toFixed(2) ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.passed
                        ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{t("val.admis")}</span>
                        : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">{t("val.non_admis")}</span>}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
