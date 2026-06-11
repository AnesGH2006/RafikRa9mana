import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/language-provider";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import type { SubjectAverage } from "@shared/types";
import type { Niveau } from "@shared/types";

const BASE = import.meta.env.BASE_URL;
const LEVELS: Niveau[] = ["1AM", "2AM", "3AM", "4AM"];
const LEVEL_LABELS: Record<Niveau, string> = { "1AM": "1ère AM", "2AM": "2ème AM", "3AM": "3ème AM", "4AM": "4ème AM" };

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as any } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

function scoreColor(avg: number) {
  if (avg >= 15) return "bg-emerald-500";
  if (avg >= 12) return "bg-green-400";
  if (avg >= 10) return "bg-amber-400";
  return "bg-red-400";
}

export default function SubjectsPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<SubjectAverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ niveau: "", classe: "", trimestre: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.niveau) p.set("niveau", filters.niveau);
      if (filters.classe) p.set("classe", filters.classe);
      if (filters.trimestre) p.set("trimestre", filters.trimestre);
      const res = await fetch(`${BASE}api/results/subjects?${p}`, { credentials: "include" });
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sorted = [...data].sort((a, b) => b.avg - a.avg);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const overallAvg = data.length > 0
    ? Math.round((data.reduce((s, d) => s + d.avg, 0) / data.length) * 100) / 100
    : null;

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 space-y-6 max-w-5xl mx-auto">

      <motion.h1 className="text-2xl font-bold" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        {t("subjects.title")}
      </motion.h1>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filters.niveau || "__all__"} onValueChange={v => setFilters(p => ({ ...p, niveau: v === "__all__" ? "" : v }))}>
          <SelectTrigger className="w-36"><SelectValue placeholder={t("students.filterLevel")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("students.allLevels")}</SelectItem>
            {LEVELS.map(l => <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.trimestre || "__all__"} onValueChange={v => setFilters(p => ({ ...p, trimestre: v === "__all__" ? "" : v }))}>
          <SelectTrigger className="w-36"><SelectValue placeholder="كل الفصول" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">كل الفصول</SelectItem>
            <SelectItem value="1">الفصل 1</SelectItem>
            <SelectItem value="2">الفصل 2</SelectItem>
            <SelectItem value="3">الفصل 3</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <AnimatePresence mode="wait">
        {!loading && data.length > 0 && (
          <motion.div key="cards" className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {[
              { label: t("subjects.avg"), value: overallAvg?.toFixed(2) ?? "—", icon: BarChart3, color: "bg-blue-500" },
              { label: t("subjects.best"), value: best?.arLabel ?? "—", icon: TrendingUp, color: "bg-emerald-500" },
              { label: t("subjects.worst"), value: worst?.arLabel ?? "—", icon: TrendingDown, color: "bg-red-400" },
            ].map((card, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.08 }} whileHover={{ y: -2 }}>
                <Card className="shadow-sm border-0 overflow-hidden">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center`}>
                        <card.icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{card.label}</p>
                        <p className="font-bold text-foreground">{card.value}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subject bars */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <motion.div key={i} className="h-14 rounded-xl bg-muted"
                animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }} />
            ))}
          </motion.div>
        ) : data.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-16 text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>{t("subjects.noData")}</p>
          </motion.div>
        ) : (
          <motion.div key="bars" className="space-y-3">
            {sorted.map((s, i) => (
              <motion.div key={s.subject}
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
                className="flex items-center gap-4 bg-card rounded-xl border p-4"
              >
                <div className="w-36 shrink-0">
                  <p className="font-semibold text-sm">{s.arLabel}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.passCount}/{s.total} ناجح
                  </p>
                </div>
                <div className="flex-1 relative h-6 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${scoreColor(s.avg)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(s.avg / 20) * 100}%` }}
                    transition={{ delay: i * 0.06 + 0.2, duration: 1, ease: "easeOut" as any }}
                  />
                </div>
                <div className="w-16 text-end shrink-0">
                  <span className={`font-bold text-lg ${s.avg >= 10 ? "text-emerald-600" : "text-red-500"}`}>
                    {s.avg.toFixed(2)}
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
