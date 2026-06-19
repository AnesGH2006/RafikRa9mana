import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/language-provider";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, RadialBarChart, RadialBar,
} from "recharts";
import { TrendingUp, Users, UserCheck, UserX, Award, BarChart3 } from "lucide-react";
import { CountUp } from "@/components/count-up";
import type { DashboardStats } from "@shared/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BASE = import.meta.env.BASE_URL;

function getAcademicYears(): string[] {
  const years: string[] = [];
  for (let start = 2018; start <= 2025; start++) {
    years.push(`${start}-${start + 1}`);
  }
  return years.reverse();
}

const LEVEL_LABELS: Record<string, string> = {
  "1AM": "1 AM", "2AM": "2 AM", "3AM": "3 AM", "4AM": "4 AM",
};

const GENDER_COLORS = ["#3b82f6", "#ec4899"];
const LEVEL_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef"];
const SUCCESS_COLORS = { pass: "#10b981", fail: "#f43f5e" };

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

const cardVariants = {
  initial: { opacity: 0, y: 24, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: "easeOut" as const } },
};

function SkeletonCard() {
  return (
    <motion.div
      className="h-64 rounded-2xl bg-muted"
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 backdrop-blur border rounded-xl shadow-xl p-3 text-xs">
      {label && <p className="font-bold mb-1 text-foreground">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { t } = useLanguage();
  const [year, setYear] = useState(() => {
    const stored = localStorage.getItem("cem-selected-year");
    return stored || "2025-2026";
  });
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const years = getAcademicYears();

  const fetchStats = useCallback(async (y: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/stats?annee=${y}`, { credentials: "include" });
      if (res.ok) setStats(await res.json());
      else setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(year);
    localStorage.setItem("cem-selected-year", year);
  }, [year, fetchStats]);

  const genderData = stats ? [
    { name: t("analytics.boys"), value: stats.boys, color: "#3b82f6" },
    { name: t("analytics.girls"), value: stats.girls, color: "#ec4899" },
  ] : [];

  const levelData = stats?.byLevel.map((l, i) => ({
    name: LEVEL_LABELS[l.niveau] || l.niveau,
    total: l.total,
    boys: l.boys,
    girls: l.girls,
    color: LEVEL_COLORS[i % LEVEL_COLORS.length],
  })) || [];

  const successData = stats?.byLevel.filter(l => l.admis > 0 || l.nonAdmis > 0).map((l, i) => ({
    name: LEVEL_LABELS[l.niveau] || l.niveau,
    [t("analytics.passed")]: l.admis,
    [t("analytics.failed")]: l.nonAdmis,
    color: LEVEL_COLORS[i % LEVEL_COLORS.length],
  })) || [];

  const successRate = stats && stats.total > 0 && (stats.admis + stats.nonAdmis > 0)
    ? Math.round((stats.admis / (stats.admis + stats.nonAdmis)) * 100)
    : null;

  const radialData = successRate !== null ? [
    { name: t("analytics.passed"), value: successRate, fill: "#10b981" },
  ] : [];

  return (
    <motion.div
      variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 space-y-6 max-w-6xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span className="inline-flex w-9 h-9 rounded-xl bg-violet-500 items-center justify-center shadow-lg shadow-violet-500/30">
              <BarChart3 className="w-5 h-5 text-white" />
            </span>
            {t("analytics.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("analytics.overview")}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-44 bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 shadow-lg shadow-violet-500/25 font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : !stats || stats.total === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
          className="text-center py-20"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-20 h-20 rounded-2xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center mx-auto mb-4"
          >
            <BarChart3 className="w-10 h-10 text-violet-400 opacity-60" />
          </motion.div>
          <p className="text-muted-foreground text-lg font-medium">{t("analytics.noData")}</p>
        </motion.div>
      ) : (
        <>
          {/* KPI Cards */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            initial="initial" animate="animate"
            variants={{ animate: { transition: { staggerChildren: 0.07 } } }}
          >
            {[
              { label: t("stats.total"), value: stats.total, icon: Users, bg: "from-blue-500 to-blue-600", shadow: "shadow-blue-500/30" },
              { label: t("analytics.boys"), value: stats.boys, icon: Users, bg: "from-sky-500 to-cyan-600", shadow: "shadow-sky-500/30" },
              { label: t("analytics.girls"), value: stats.girls, icon: Users, bg: "from-pink-500 to-rose-600", shadow: "shadow-pink-500/30" },
              ...(successRate !== null ? [
                { label: t("analytics.successRate"), value: successRate, icon: Award, bg: "from-emerald-500 to-green-600", shadow: "shadow-emerald-500/30", suffix: "%" },
              ] : []),
            ].map((item, i) => (
              <motion.div key={i} variants={cardVariants} whileHover={{ y: -4, scale: 1.03 }} transition={{ type: "spring", stiffness: 300 }}>
                <Card className={`border-0 shadow-lg ${item.shadow} overflow-hidden`}>
                  <div className={`h-full bg-gradient-to-br ${item.bg} p-4`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-white/80 text-xs font-semibold">{item.label}</p>
                      <item.icon className="w-4 h-4 text-white/60" />
                    </div>
                    <p className="text-3xl font-extrabold text-white tracking-tight">
                      <CountUp to={item.value} />{(item as any).suffix ?? ""}
                    </p>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {/* Gender Pie */}
            <motion.div variants={cardVariants} initial="initial" animate="animate" whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 200 }}>
              <Card className="shadow-md border-0 bg-gradient-to-br from-card to-muted/30 h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    {t("analytics.genderPie")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={genderData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                        paddingAngle={4} dataKey="value" animationDuration={800}
                      >
                        {genderData.map((entry, i) => (
                          <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Success Rate Radial */}
            {successRate !== null && (
              <motion.div variants={cardVariants} initial="initial" animate="animate" whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 200 }}>
                <Card className="shadow-md border-0 bg-gradient-to-br from-card to-muted/30 h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {t("analytics.successRate")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center">
                    <div className="relative">
                      <ResponsiveContainer width={180} height={180}>
                        <RadialBarChart
                          cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                          barSize={14} data={radialData} startAngle={90} endAngle={-270}
                        >
                          <RadialBar background={{ fill: "#e5e7eb" }} dataKey="value" cornerRadius={8} />
                        </RadialBarChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-extrabold text-emerald-500">{successRate}%</span>
                        <span className="text-xs text-muted-foreground">{t("analytics.passed")}</span>
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs mt-1">
                      <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                        <UserCheck className="w-3.5 h-3.5" />{stats.admis} {t("analytics.passed")}
                      </span>
                      <span className="flex items-center gap-1.5 text-red-500 font-semibold">
                        <UserX className="w-3.5 h-3.5" />{stats.nonAdmis} {t("analytics.failed")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Level bar */}
            <motion.div variants={cardVariants} initial="initial" animate="animate" whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 200 }}
              className={successRate !== null ? "" : "md:col-span-2 xl:col-span-1"}>
              <Card className="shadow-md border-0 bg-gradient-to-br from-card to-muted/30 h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-violet-500" />
                    {t("analytics.levelBar")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={levelData} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="boys" name={t("analytics.boys")} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="girls" name={t("analytics.girls")} fill="#ec4899" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* Success by level */}
            {successData.length > 0 && (
              <motion.div variants={cardVariants} initial="initial" animate="animate" whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 200 }}
                className="md:col-span-2 xl:col-span-3">
                <Card className="shadow-md border-0 bg-gradient-to-br from-card to-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {t("analytics.successBar")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={successData} barSize={32}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend iconType="circle" iconSize={8} />
                        <Bar dataKey={t("analytics.passed")} fill={SUCCESS_COLORS.pass} radius={[6, 6, 0, 0]} />
                        <Bar dataKey={t("analytics.failed")} fill={SUCCESS_COLORS.fail} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Level summary table */}
            <motion.div variants={cardVariants} initial="initial" animate="animate"
              className="md:col-span-2 xl:col-span-3">
              <Card className="shadow-md border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-violet-500" />
                    {t("stats.byLevel")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs uppercase">
                          <th className="pb-2 text-start font-semibold">{t("stats.level")}</th>
                          <th className="pb-2 text-center font-semibold">{t("stats.total_col")}</th>
                          <th className="pb-2 text-center font-semibold text-blue-500">{t("analytics.boys")}</th>
                          <th className="pb-2 text-center font-semibold text-pink-500">{t("analytics.girls")}</th>
                          <th className="pb-2 text-center font-semibold text-emerald-500">{t("analytics.passed")}</th>
                          <th className="pb-2 text-center font-semibold text-red-500">{t("analytics.failed")}</th>
                          <th className="pb-2 text-center font-semibold">{t("analytics.rate")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.byLevel.map((l, i) => {
                          const total = l.admis + l.nonAdmis;
                          const rate = total > 0 ? Math.round((l.admis / total) * 100) : null;
                          return (
                            <motion.tr
                              key={l.niveau}
                              custom={i}
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.06 }}
                              className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/15"}`}
                            >
                              <td className="py-3 font-bold text-foreground">
                                <span className="inline-flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLORS[i % LEVEL_COLORS.length] }} />
                                  {LEVEL_LABELS[l.niveau] || l.niveau}
                                </span>
                              </td>
                              <td className="py-3 text-center font-bold"><CountUp to={l.total} /></td>
                              <td className="py-3 text-center text-blue-600 dark:text-blue-400 font-semibold"><CountUp to={l.boys} /></td>
                              <td className="py-3 text-center text-pink-600 dark:text-pink-400 font-semibold"><CountUp to={l.girls} /></td>
                              <td className="py-3 text-center text-emerald-600 font-semibold">{l.admis ? <CountUp to={l.admis} /> : "—"}</td>
                              <td className="py-3 text-center text-red-500 font-semibold">{l.nonAdmis ? <CountUp to={l.nonAdmis} /> : "—"}</td>
                              <td className="py-3 text-center">
                                {rate !== null ? (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                    rate >= 75 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                                    : rate >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                                  }`}>
                                    {rate}%
                                  </span>
                                ) : "—"}
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </motion.div>
  );
}
