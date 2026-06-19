import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/language-provider";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, TrendingDown, Award } from "lucide-react";
import type { SubjectAverage } from "@shared/types";
import type { Niveau } from "@shared/types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

const BASE = import.meta.env.BASE_URL;
const LEVELS: Niveau[] = ["1AM", "2AM", "3AM", "4AM"];
const LEVEL_LABELS: Record<Niveau, string> = { "1AM": "1ère AM", "2AM": "2ème AM", "3AM": "3ème AM", "4AM": "4ème AM" };

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as any } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

function scoreColor(avg: number) {
  if (avg >= 15) return "#10b981";
  if (avg >= 12) return "#22c55e";
  if (avg >= 10) return "#f59e0b";
  return "#f43f5e";
}

function barFill(avg: number) {
  if (avg >= 15) return "from-emerald-400 to-emerald-600";
  if (avg >= 12) return "from-green-400 to-green-600";
  if (avg >= 10) return "from-amber-400 to-amber-600";
  return "from-red-400 to-red-600";
}

function MiniTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 border rounded-lg shadow-lg p-2 text-xs">
      {label && <p className="font-bold mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-semibold">
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
}

export default function SubjectsPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<SubjectAverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ niveau: "", classe: "", trimestre: "" });
  const [chartType, setChartType] = useState<"bar" | "radar">("bar");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.niveau)   p.set("niveau", filters.niveau);
      if (filters.classe)   p.set("classe", filters.classe);
      if (filters.trimestre) p.set("trimestre", filters.trimestre);
      const res = await fetch(`${BASE}api/results/subjects?${p}`, { credentials: "include" });
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sorted = [...data].sort((a, b) => b.avg - a.avg);
  const best   = sorted[0];
  const worst  = sorted[sorted.length - 1];
  const overallAvg = data.length > 0
    ? Math.round((data.reduce((s, d) => s + d.avg, 0) / data.length) * 100) / 100
    : null;

  const passRate = data.length > 0
    ? Math.round((data.reduce((s, d) => s + (d.total > 0 ? d.passCount / d.total : 0), 0) / data.length) * 100)
    : null;

  // Chart data
  const barData = sorted.map(s => ({
    name: s.arLabel,
    معدل: Math.round(s.avg * 100) / 100,
    fill: scoreColor(s.avg),
  }));

  const radarData = sorted.slice(0, 8).map(s => ({
    subject: s.arLabel.slice(0, 6),
    value: Math.round(s.avg * 10) / 10,
    fullMark: 20,
  }));

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 space-y-6 max-w-5xl mx-auto">

      <div className="flex flex-wrap items-start justify-between gap-3">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="inline-flex w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 items-center justify-center shadow-lg shadow-violet-500/30">
              <BarChart3 className="w-5 h-5 text-white" />
            </span>
            {t("subjects.title")}
          </h1>
        </motion.div>

        <div className="flex gap-2">
          {(["bar", "radar"] as const).map(type => (
            <motion.button key={type} onClick={() => setChartType(type)} whileTap={{ scale: 0.95 }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                chartType === type
                  ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/30"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}>
              {type === "bar" ? "أعمدة" : "رادار"}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filters.niveau || "__all__"} onValueChange={v => setFilters(p => ({ ...p, niveau: v === "__all__" ? "" : v }))}>
          <SelectTrigger className="w-36 font-semibold text-xs h-9"><SelectValue placeholder={t("students.filterLevel")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("students.allLevels")}</SelectItem>
            {LEVELS.map(l => <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.trimestre || "__all__"} onValueChange={v => setFilters(p => ({ ...p, trimestre: v === "__all__" ? "" : v }))}>
          <SelectTrigger className="w-36 font-semibold text-xs h-9"><SelectValue placeholder="كل الفصول" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">كل الفصول</SelectItem>
            <SelectItem value="1">الفصل 1</SelectItem>
            <SelectItem value="2">الفصل 2</SelectItem>
            <SelectItem value="3">الفصل 3</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary KPI cards */}
      <AnimatePresence mode="wait">
        {!loading && data.length > 0 && (
          <motion.div key="cards" className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {[
              { label: t("subjects.avg"), value: overallAvg?.toFixed(2) ?? "—", icon: BarChart3, bg: "from-blue-500 to-indigo-600", shadow: "shadow-blue-500/25" },
              { label: t("subjects.best"), value: best?.arLabel ?? "—", icon: TrendingUp, bg: "from-emerald-500 to-green-600", shadow: "shadow-emerald-500/25" },
              { label: t("subjects.worst"), value: worst?.arLabel ?? "—", icon: TrendingDown, bg: "from-red-500 to-rose-600", shadow: "shadow-red-500/25" },
              { label: "نسبة النجاح", value: passRate !== null ? `${passRate}%` : "—", icon: Award, bg: "from-amber-500 to-orange-600", shadow: "shadow-amber-500/25" },
            ].map((card, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.07 }} whileHover={{ y: -3 }}>
                <Card className={`border-0 shadow-lg ${card.shadow} overflow-hidden`}>
                  <div className={`bg-gradient-to-br ${card.bg} p-4 relative overflow-hidden`}>
                    <div className="absolute -top-4 -right-4 w-14 h-14 rounded-full bg-white/10 blur-xl" />
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-white/75 text-[10px] font-semibold leading-tight">{card.label}</p>
                      <card.icon className="w-4 h-4 text-white/60 shrink-0" />
                    </div>
                    <p className="font-bold text-white text-sm leading-tight">{card.value}</p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recharts chart */}
      <AnimatePresence mode="wait">
        {!loading && data.length > 0 && (
          <motion.div key={`chart-${chartType}`}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}>
            <Card className="border-0 shadow-md bg-gradient-to-br from-card to-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-500" />
                  {chartType === "bar" ? "معدل كل مادة" : "رادار المواد"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                {chartType === "bar" ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={barData} barSize={28} margin={{ top: 5, bottom: 40, left: -10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 20]} />
                      <Tooltip content={<MiniTooltip />} />
                      <Bar dataKey="معدل" radius={[5, 5, 0, 0]}>
                        {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 20]} tick={{ fontSize: 9 }} />
                      <Radar name="المعدل" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.35} />
                      <Tooltip content={<MiniTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subject list with animated bars */}
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
          <motion.div key="bars" className="space-y-2">
            {sorted.map((s, i) => (
              <motion.div key={s.subject}
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35 }}
                whileHover={{ x: 3 }}
                className="flex items-center gap-4 bg-card rounded-xl border p-3.5 hover:shadow-md transition-shadow"
              >
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                  {i + 1}
                </div>
                <div className="w-32 shrink-0">
                  <p className="font-semibold text-sm">{s.arLabel}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {s.passCount}/{s.total} ناجح
                  </p>
                </div>
                <div className="flex-1 relative h-5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full bg-gradient-to-r ${barFill(s.avg)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(s.avg / 20) * 100}%` }}
                    transition={{ delay: i * 0.05 + 0.2, duration: 0.9, ease: "easeOut" as any }}
                  />
                </div>
                <div className="w-14 text-end shrink-0">
                  <span className={`font-bold text-base ${s.avg >= 10 ? "text-emerald-600" : "text-red-500"}`}>
                    {s.avg.toFixed(2)}
                  </span>
                  <p className="text-[10px] text-muted-foreground">/20</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
