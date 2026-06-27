import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/language-provider";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Printer, Users, UserCheck, UserX, Award, TrendingUp,
  BarChart3, School, Calendar, Download, GraduationCap, Activity,
  CalendarOff, BookOpen, Target, AlertTriangle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar,
} from "recharts";
import { CountUp } from "@/components/count-up";
import type { DashboardStats, SchoolInfo } from "@shared/types";

const BASE = import.meta.env.BASE_URL;

const ACADEMIC_YEARS = ["2026-2027", "2025-2026", "2024-2025", "2023-2024", "2022-2023"];
const LEVEL_LABELS: Record<string, string> = {
  "1AM": "1ère AM", "2AM": "2ème AM", "3AM": "3ème AM", "4AM": "4ème AM",
};
const LEVEL_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef"];
const GENDER_COLORS = ["#3b82f6", "#ec4899"];

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

function MiniTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 border rounded-lg shadow-xl p-2.5 text-xs">
      {label && <p className="font-bold mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

function StatBadge({ label, value, color, suffix = "" }: { label: string; value: number; color: string; suffix?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center p-3 rounded-xl bg-gradient-to-br ${color} print-section`}>
      <p className="text-2xl font-black text-white"><CountUp to={value} />{suffix}</p>
      <p className="text-[10px] text-white/80 font-semibold mt-0.5 text-center">{label}</p>
    </div>
  );
}

interface AbsenceRow {
  studentId: string;
  trimestre: number;
  justifiedHours: number;
  unjustifiedHours: number;
}

export default function ReportsPage() {
  const { t } = useLanguage();
  const printRef = useRef<HTMLDivElement>(null);

  const [year, setYear] = useState(() => localStorage.getItem("cem-selected-year") || "2025-2026");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async (y: string) => {
    setLoading(true);
    try {
      const [sRes, schRes, aRes] = await Promise.all([
        fetch(`${BASE}api/stats?annee=${y}`, { credentials: "include" }),
        fetch(`${BASE}api/school`, { credentials: "include" }),
        fetch(`${BASE}api/absences?annee=${y}`, { credentials: "include" }),
      ]);
      if (sRes.ok) setStats(await sRes.json());
      else setStats(null);
      if (schRes.ok) setSchool(await schRes.json());
      if (aRes.ok) setAbsences(await aRes.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll(year);
    localStorage.setItem("cem-selected-year", year);
  }, [year, fetchAll]);

  const handlePrint = () => { window.print(); };

  const successRate = stats && (stats.admis + stats.nonAdmis) > 0
    ? Math.round((stats.admis / (stats.admis + stats.nonAdmis)) * 100)
    : null;

  const genderData = stats ? [
    { name: "ذكور", value: stats.boys, fill: GENDER_COLORS[0] },
    { name: "إناث", value: stats.girls, fill: GENDER_COLORS[1] },
  ] : [];

  const levelData = stats?.byLevel.map((l, i) => ({
    name: LEVEL_LABELS[l.niveau] || l.niveau,
    total: l.total,
    ذكور: l.boys,
    إناث: l.girls,
    fill: LEVEL_COLORS[i % LEVEL_COLORS.length],
  })) || [];

  const successByLevel = stats?.byLevel
    .filter(l => l.admis + l.nonAdmis > 0)
    .map((l, i) => ({
      name: LEVEL_LABELS[l.niveau] || l.niveau,
      "نسبة النجاح": l.admis + l.nonAdmis > 0
        ? Math.round((l.admis / (l.admis + l.nonAdmis)) * 100)
        : 0,
      fill: LEVEL_COLORS[i % LEVEL_COLORS.length],
    })) || [];

  const totalAbsJustified = absences.reduce((s, a) => s + a.justifiedHours, 0);
  const totalAbsUnjustified = absences.reduce((s, a) => s + a.unjustifiedHours, 0);
  const studentsAtRisk = new Set(
    absences.filter(a => a.unjustifiedHours >= 10).map(a => a.studentId)
  ).size;

  const absenceByTrimestre = [1, 2, 3].map(t => {
    const rows = absences.filter(a => a.trimestre === t);
    return {
      name: `ف${t}`,
      مبررة: rows.reduce((s, a) => s + a.justifiedHours, 0),
      غير_مبررة: rows.reduce((s, a) => s + a.unjustifiedHours, 0),
    };
  });

  const today = new Date().toLocaleDateString("ar-DZ", { year: "numeric", month: "long", day: "numeric" });

  return (
    <motion.div
      variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 space-y-6 max-w-6xl mx-auto"
      ref={printRef}
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <span className="inline-flex w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 items-center justify-center shadow-lg shadow-blue-500/30">
              <FileText className="w-5 h-5 text-white" />
            </span>
            التقارير الشاملة
          </h1>
          <p className="text-xs text-muted-foreground mt-1 ms-11">تقرير إحصائي شامل قابل للطباعة</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-40 bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-lg font-semibold text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACADEMIC_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            onClick={handlePrint}
            className="gap-2 h-9 font-semibold text-xs bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 shadow-md shadow-emerald-500/25 hover:from-emerald-600 hover:to-green-700"
            data-testid="button-print-report"
          >
            <Printer className="w-4 h-4" />
            طباعة PDF
          </Button>
        </div>
      </div>

      {/* ── Print header (only shows in print) ── */}
      <div className="hidden print-only print-section border-b pb-4 mb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">التقرير السنوي الشامل</h1>
            <p className="text-sm text-gray-600">السنة الدراسية: {year}</p>
            {school && <p className="text-sm text-gray-600">{school.nom} — {school.wilaya}</p>}
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>تاريخ الطباعة: {today}</p>
          </div>
        </div>
      </div>

      {/* ── School banner ── */}
      {school && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="print-section"
        >
          <Card className="border-blue-200/60 dark:border-blue-800/60 bg-gradient-to-br from-blue-50 to-indigo-50/60 dark:from-blue-950/50 dark:to-indigo-950/30 shadow-md border-0">
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-wrap gap-5">
                {[
                  { label: "المؤسسة", value: school.nom, icon: School, color: "from-blue-500 to-blue-700" },
                  { label: "الولاية / البلدية", value: `${school.wilaya} — ${school.commune}`, icon: Target, color: "from-indigo-500 to-violet-600" },
                  { label: "السنة الدراسية", value: school.annee, icon: Calendar, color: "from-violet-500 to-purple-700" },
                  ...(school.directeur ? [{ label: "المدير", value: school.directeur, icon: GraduationCap, color: "from-cyan-500 to-blue-600" }] : []),
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shrink-0 shadow-md`}>
                      <item.icon className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium">{item.label}</p>
                      <p className="font-bold text-sm text-foreground">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <motion.div key={i} className="h-20 rounded-xl bg-muted"
              animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.1 }} />
          ))}
        </div>
      ) : !stats || stats.total === 0 ? (
        <div className="text-center py-20">
          <motion.div className="w-20 h-20 rounded-2xl bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center mx-auto mb-4"
            animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}>
            <FileText className="w-10 h-10 text-blue-400 opacity-60" />
          </motion.div>
          <p className="text-muted-foreground text-lg font-medium">لا توجد بيانات لهذه السنة الدراسية</p>
          <p className="text-sm text-muted-foreground mt-1">استورد بيانات التلاميذ وأدخل النقاط لرؤية التقرير</p>
        </div>
      ) : (
        <>
          {/* ── Section 1: Global KPIs ── */}
          <div className="print-section">
            <h2 className="text-base font-bold mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              إحصائيات التلاميذ — السنة الدراسية {year}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              <StatBadge label="مجموع التلاميذ" value={stats.total} color="from-blue-500 to-blue-700" />
              <StatBadge label="ذكور" value={stats.boys} color="from-sky-500 to-cyan-600" />
              <StatBadge label="إناث" value={stats.girls} color="from-pink-500 to-rose-600" />
              {successRate !== null && (
                <StatBadge label="نسبة النجاح" value={successRate} suffix="%" color="from-emerald-500 to-green-600" />
              )}
              <StatBadge label="الناجحون" value={stats.admis} color="from-emerald-500 to-teal-600" />
              <StatBadge label="الراسبون" value={stats.nonAdmis} color="from-red-500 to-rose-600" />
            </div>
          </div>

          {/* Pass/fail progress bar */}
          {(stats.admis > 0 || stats.nonAdmis > 0) && (
            <div className="print-section">
              <div className="flex items-center justify-between mb-1.5 text-sm">
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" /> ناجح: {stats.admis}
                </span>
                <span className="font-bold text-foreground">
                  نسبة النجاح: {successRate}%
                </span>
                <span className="font-bold text-red-500 flex items-center gap-1">
                  <UserX className="w-3.5 h-3.5" /> راسب: {stats.nonAdmis}
                </span>
              </div>
              <div className="h-5 rounded-full bg-muted overflow-hidden flex">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-400 to-green-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${(stats.admis / stats.total) * 100}%` }}
                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                />
                <motion.div
                  className="h-full bg-gradient-to-r from-red-400 to-rose-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${(stats.nonAdmis / stats.total) * 100}%` }}
                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
                />
              </div>
            </div>
          )}

          {/* ── Charts row ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {/* Gender pie */}
            {(stats.boys > 0 || stats.girls > 0) && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="print-section">
                <Card className="shadow-md border-0 bg-gradient-to-br from-card to-muted/20 h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />توزيع الجنس
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={genderData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                          paddingAngle={4} dataKey="value" animationDuration={700}>
                          {genderData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip content={<MiniTooltip />} />
                        <Legend iconType="circle" iconSize={8} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Level bar */}
            {levelData.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="print-section">
                <Card className="shadow-md border-0 bg-gradient-to-br from-card to-muted/20 h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-violet-500" />التلاميذ حسب المستوى
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={levelData} barSize={18}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip content={<MiniTooltip />} />
                        <Bar dataKey="ذكور" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="إناث" fill="#ec4899" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Success rate radial */}
            {successRate !== null && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="print-section">
                <Card className="shadow-md border-0 bg-gradient-to-br from-card to-muted/20 h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Award className="w-3.5 h-3.5 text-emerald-500" />نسبة النجاح الكلية
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center">
                    <ResponsiveContainer width="100%" height={140}>
                      <RadialBarChart cx="50%" cy="80%" innerRadius="60%" outerRadius="90%"
                        startAngle={180} endAngle={0}
                        data={[{ value: successRate, fill: "#10b981" }]}>
                        <RadialBar dataKey="value" cornerRadius={6} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <p className="text-3xl font-black text-emerald-600 -mt-6">{successRate}%</p>
                    <p className="text-xs text-muted-foreground mt-1">من إجمالي {stats.admis + stats.nonAdmis} تلميذ لديهم نتيجة</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* ── Section 2: Per-level breakdown table ── */}
          {stats.byLevel.length > 0 && (
            <div className="print-section">
              <h2 className="text-base font-bold mb-3 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-violet-500" />
                تفصيل حسب المستوى
              </h2>
              <Card className="shadow-sm border-0">
                <CardContent className="pt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs uppercase">
                        <th className="pb-2 text-start font-semibold">المستوى</th>
                        <th className="pb-2 text-center font-semibold">المجموع</th>
                        <th className="pb-2 text-center font-semibold text-blue-500">ذكور</th>
                        <th className="pb-2 text-center font-semibold text-pink-500">إناث</th>
                        <th className="pb-2 text-center font-semibold text-emerald-600">ناجح</th>
                        <th className="pb-2 text-center font-semibold text-red-500">راسب</th>
                        <th className="pb-2 text-center font-semibold">نسبة النجاح</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byLevel.map((l, i) => {
                        const withResult = l.admis + l.nonAdmis;
                        const rate = withResult > 0 ? Math.round((l.admis / withResult) * 100) : null;
                        return (
                          <tr key={l.niveau} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/15"}`}>
                            <td className="py-2.5 font-semibold">
                              <span className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLORS[i % LEVEL_COLORS.length] }} />
                                {LEVEL_LABELS[l.niveau] || l.niveau}
                              </span>
                            </td>
                            <td className="py-2.5 text-center font-bold">{l.total}</td>
                            <td className="py-2.5 text-center text-blue-600 font-semibold">{l.boys}</td>
                            <td className="py-2.5 text-center text-pink-600 font-semibold">{l.girls}</td>
                            <td className="py-2.5 text-center text-emerald-600 font-semibold">{l.admis || "—"}</td>
                            <td className="py-2.5 text-center text-red-500 font-semibold">{l.nonAdmis || "—"}</td>
                            <td className="py-2.5 text-center">
                              {rate !== null ? (
                                <Badge variant="outline" className={`font-bold text-xs ${rate >= 50 ? "border-emerald-400 text-emerald-600" : "border-red-400 text-red-500"}`}>
                                  {rate}%
                                </Badge>
                              ) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-bold text-sm">
                        <td className="pt-2.5">الإجمالي</td>
                        <td className="pt-2.5 text-center">{stats.total}</td>
                        <td className="pt-2.5 text-center text-blue-600">{stats.boys}</td>
                        <td className="pt-2.5 text-center text-pink-600">{stats.girls}</td>
                        <td className="pt-2.5 text-center text-emerald-600">{stats.admis}</td>
                        <td className="pt-2.5 text-center text-red-500">{stats.nonAdmis}</td>
                        <td className="pt-2.5 text-center">
                          {successRate !== null ? (
                            <Badge className={`font-bold ${successRate >= 50 ? "bg-emerald-500" : "bg-red-500"}`}>
                              {successRate}%
                            </Badge>
                          ) : "—"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Success rate by level bar chart */}
          {successByLevel.length > 0 && (
            <div className="print-section">
              <h2 className="text-base font-bold mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                نسبة النجاح حسب المستوى
              </h2>
              <Card className="shadow-md border-0">
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={successByLevel} barSize={40}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} />
                      <Tooltip content={<MiniTooltip />} />
                      <Bar dataKey="نسبة النجاح" radius={[6, 6, 0, 0]}>
                        {successByLevel.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Section 3: Absences ── */}
          {absences.length > 0 && (
            <div className="print-section">
              <h2 className="text-base font-bold mb-3 flex items-center gap-2">
                <CalendarOff className="w-4 h-4 text-amber-500" />
                ملخص الغيابات
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatBadge label="ساعات مبررة" value={totalAbsJustified} color="from-blue-500 to-indigo-600" />
                <StatBadge label="ساعات غير مبررة" value={totalAbsUnjustified} color="from-amber-500 to-orange-600" />
                <StatBadge label="إجمالي الساعات" value={totalAbsJustified + totalAbsUnjustified} color="from-slate-600 to-slate-800" />
                <StatBadge label="تلاميذ في خطر" value={studentsAtRisk} color="from-red-500 to-rose-700" />
              </div>

              {absenceByTrimestre.some(t => t.مبررة > 0 || t.غير_مبررة > 0) && (
                <Card className="shadow-md border-0">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-amber-500" />الغيابات حسب الفصل
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={absenceByTrimestre} barSize={28} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip content={<MiniTooltip />} />
                        <Legend iconType="circle" iconSize={8} />
                        <Bar dataKey="مبررة" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="غير_مبررة" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── Footer print-only ── */}
          <div className="hidden print-only print-section border-t pt-3 mt-4 flex items-center justify-between text-xs text-gray-500">
            <p>CEM Manager — مدير المتوسطة</p>
            <p>السنة الدراسية: {year} | تاريخ الطباعة: {today}</p>
          </div>
        </>
      )}
    </motion.div>
  );
}
