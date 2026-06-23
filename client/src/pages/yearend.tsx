import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/language-provider";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, GraduationCap, TrendingUp } from "lucide-react";
import type { StudentResult } from "@shared/types";
import type { Niveau } from "@shared/types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, RadialBarChart, RadialBar, PieChart, Pie,
} from "recharts";

const BASE = import.meta.env.BASE_URL;
const LEVELS: Niveau[] = ["1AM", "2AM", "3AM", "4AM"];
const LEVEL_LABELS: Record<Niveau, string> = { "1AM": "1ère AM", "2AM": "2ème AM", "3AM": "3ème AM", "4AM": "4ème AM" };
const LEVEL_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef"];
const ACADEMIC_YEARS = ["2026-2027", "2025-2026", "2024-2025", "2023-2024", "2022-2023"];
const DEFAULT_YEAR  = "2025-2026";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

function MiniTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 border rounded-lg shadow-lg p-2 text-xs">
      {label && <p className="font-bold mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export default function YearEnd() {
  const { t } = useLanguage();
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"passed" | "failed" | "all">("all");
  const [annee, setAnnee] = useState(DEFAULT_YEAR);
  const [filters, setFilters] = useState({ niveau: "", classe: "" });

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams({ annee });
    if (filters.niveau) p.set("niveau", filters.niveau);
    if (filters.classe) p.set("classe", filters.classe);
    fetch(`${BASE}api/results?${p}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((d: StudentResult[]) => { setResults(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filters, annee]);

  const withAvg = results.filter(r => r.annualAvg !== null);
  const passed  = withAvg.filter(r => r.passed === true).sort((a, b) => (b.annualAvg ?? 0) - (a.annualAvg ?? 0));
  const failed  = withAvg.filter(r => r.passed === false).sort((a, b) => (b.annualAvg ?? 0) - (a.annualAvg ?? 0));
  const all     = withAvg.sort((a, b) => (b.annualAvg ?? 0) - (a.annualAvg ?? 0));

  const displayed = tab === "passed" ? passed : tab === "failed" ? failed : all;
  const classes   = [...new Set(results.map(r => r.student.classe))].sort();

  const successRate = all.length > 0 ? Math.round((passed.length / all.length) * 100) : null;

  // Analytics data
  const radialData = successRate !== null
    ? [{ name: "نجاح", value: successRate, fill: "#10b981" }]
    : [];

  // Grade distribution histogram
  const gradeBuckets = [
    { label: "0-5",   min: 0,  max: 5  },
    { label: "5-10",  min: 5,  max: 10 },
    { label: "10-12", min: 10, max: 12 },
    { label: "12-15", min: 12, max: 15 },
    { label: "15-20", min: 15, max: 20.01 },
  ];
  const histData = gradeBuckets.map(b => ({
    name: b.label,
    ناجح: passed.filter(r => (r.annualAvg ?? 0) >= b.min && (r.annualAvg ?? 0) < b.max).length,
    راسب: failed.filter(r => (r.annualAvg ?? 0) >= b.min && (r.annualAvg ?? 0) < b.max).length,
  }));

  // Pass/fail by level
  const levelData = LEVELS.map((lvl, i) => {
    const lvlAll    = all.filter(r => r.student.niveau === lvl);
    const lvlPassed = passed.filter(r => r.student.niveau === lvl);
    const lvlFailed = failed.filter(r => r.student.niveau === lvl);
    return {
      name: lvl,
      ناجح: lvlPassed.length,
      راسب: lvlFailed.length,
      total: lvlAll.length,
      fill: LEVEL_COLORS[i],
    };
  }).filter(d => d.total > 0);

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 space-y-5 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="inline-flex w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 items-center justify-center shadow-lg shadow-emerald-500/30">
              <GraduationCap className="w-5 h-5 text-white" />
            </span>
            {t("yearend.title")}
          </h1>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            {t("yearend.print")}
          </Button>
        </motion.div>
      </div>

      {/* Analytics section */}
      {!loading && all.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {/* Pass rate radial gauge */}
          <Card className="border-0 shadow-md bg-gradient-to-br from-card to-muted/20">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground">نسبة النجاح الكلية</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center pb-3">
              <div className="relative">
                <ResponsiveContainer width={160} height={140}>
                  <RadialBarChart cx="50%" cy="60%" innerRadius={45} outerRadius={65}
                    barSize={12} data={radialData} startAngle={90} endAngle={-270}>
                    <RadialBar background={{ fill: "#e5e7eb" }} dataKey="value" cornerRadius={8} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pb-2">
                  <span className="text-3xl font-extrabold text-emerald-500">{successRate}%</span>
                  <span className="text-[10px] text-muted-foreground font-medium">ناجح</span>
                </div>
              </div>
              <div className="flex gap-4 text-xs mt-1">
                <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />{passed.length} ناجح
                </span>
                <span className="flex items-center gap-1.5 text-red-500 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-red-400" />{failed.length} راسب
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Grade distribution histogram */}
          <Card className="border-0 shadow-md bg-gradient-to-br from-card to-muted/20">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground">توزيع المعدلات</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-3 px-2">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={histData} barSize={16} margin={{ left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<MiniTooltip />} />
                  <Bar dataKey="ناجح" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="راسب" fill="#f43f5e" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pass/fail by level */}
          {levelData.length > 0 && (
            <Card className="border-0 shadow-md bg-gradient-to-br from-card to-muted/20">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-bold text-muted-foreground">النجاح حسب المستوى</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-3 px-2">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={levelData} barSize={16} margin={{ left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<MiniTooltip />} />
                    <Bar dataKey="ناجح" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="راسب" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* Year selector */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <Select value={annee} onValueChange={v => { setAnnee(v); setFilters({ niveau: "", classe: "" }); }}>
          <SelectTrigger className="w-40 font-semibold border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACADEMIC_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Tabs + filters */}
      <motion.div className="flex flex-wrap gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="flex gap-2">
          {(["all", "passed", "failed"] as const).map(tb => (
            <motion.button key={tb} onClick={() => setTab(tb)} whileTap={{ scale: 0.95 }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === tb
                  ? tb === "passed"
                    ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-500/30"
                    : tb === "failed"
                    ? "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-md shadow-red-500/30"
                    : "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/30"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}>
              {tb === "all" ? t("yearend.all") : tb === "passed" ? t("yearend.passed") : t("yearend.failed")}
              <span className={`ms-2 text-xs px-1.5 py-0.5 rounded-full ${tab === tb ? "bg-white/20" : "bg-muted-foreground/10"}`}>
                {tb === "all" ? all.length : tb === "passed" ? passed.length : failed.length}
              </span>
            </motion.button>
          ))}
        </div>
        <Select value={filters.niveau || "__all__"} onValueChange={v => setFilters(p => ({ ...p, niveau: v === "__all__" ? "" : v, classe: "" }))}>
          <SelectTrigger className="w-36 text-xs h-9"><SelectValue placeholder={t("students.filterLevel")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("students.allLevels")}</SelectItem>
            {LEVELS.map(l => <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.classe || "__all__"} onValueChange={v => setFilters(p => ({ ...p, classe: v === "__all__" ? "" : v }))}>
          <SelectTrigger className="w-32 text-xs h-9"><SelectValue placeholder={t("students.filterClass")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("students.allClasses")}</SelectItem>
            {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Quick stats pills */}
      {!loading && all.length > 0 && (
        <motion.div className="flex flex-wrap gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          {[
            { label: "مجموع", value: all.length, color: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300" },
            { label: t("yearend.passed"), value: passed.length, color: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" },
            { label: t("yearend.failed"), value: failed.length, color: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300" },
            { label: "أعلى معدل", value: (passed[0]?.annualAvg ?? 0).toFixed(2), color: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300" },
          ].map((s, i) => (
            <motion.div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${s.color}`}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
              <span className="font-extrabold">{s.value}</span>
              <span className="text-xs opacity-70">{s.label}</span>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Table */}
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
                    className={`border-t ${i % 2 === 0 ? "" : "bg-muted/15"} hover:bg-muted/30 transition-colors`}
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
