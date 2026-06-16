import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, RotateCcw, Printer, BarChart3, TrendingUp, Award, Users, Target, Zap } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, ComposedChart, Line, ScatterChart, Scatter, ZAxis,
} from "recharts";

const BASE = import.meta.env.BASE_URL;

// ── Types ─────────────────────────────────────────────────────────────────────
interface BEMSubjectDef { key: string; arLabel: string; coef: number }
interface BEMStudent {
  name: string; gender: "male" | "female" | "unknown";
  scores: Record<string, number | null>;
  average: number | null; passed: boolean | null; rank: number;
}
interface BEMSummary {
  total: number; withAvg: number; passCount: number; failCount: number;
  passRate: number; classAvg: number | null;
  first: BEMStudent | null; last: BEMStudent | null;
}
interface GenderStats {
  males: number; females: number; unknown: number;
  malePass: number; maleFail: number; femalePass: number; femaleFail: number;
  malePassRate: number; femalePassRate: number;
}
interface SubjectStat {
  key: string; arLabel: string; coef: number;
  avg: number | null; passCount: number; total: number; passRate: number;
}
interface BEMResult {
  students: BEMStudent[]; summary: BEMSummary; genderStats: GenderStats;
  subjectStats: SubjectStat[]; scoreDistribution: { range: string; count: number }[];
  detectedSubjects: BEMSubjectDef[]; fileName: string;
}

// ── Animations ────────────────────────────────────────────────────────────────
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -12 },
};
const stagger = { animate: { transition: { staggerChildren: 0.07 } } };
const cardAnim = {
  initial: { opacity: 0, y: 20, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 260, damping: 22 } },
};

// ── Tooltip (NO black cursor) ─────────────────────────────────────────────────
const TT = {
  contentStyle: {
    background: "var(--background,#fff)",
    border: "1px solid var(--border,#e2e8f0)",
    borderRadius: "10px",
    fontSize: "12px",
    direction: "rtl" as const,
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    padding: "8px 12px",
  },
  cursor: { fill: "transparent" },   // ← fixes black bar
  wrapperStyle: { outline: "none" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function medalColor(r: number) {
  return r === 1 ? "text-amber-500" : r === 2 ? "text-slate-400" : r === 3 ? "text-orange-400" : "text-muted-foreground";
}
function medalEmoji(r: number) {
  return r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : null;
}
function gradeLabel(avg: number) {
  if (avg >= 18) return { label: "ممتاز رفيع", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" };
  if (avg >= 16) return { label: "ممتاز",       cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" };
  if (avg >= 14) return { label: "جيد جداً",    cls: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" };
  if (avg >= 12) return { label: "جيد",         cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" };
  if (avg >= 10) return { label: "مقبول",       cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
  return              { label: "راسب",          cls: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300" };
}

// ── Chart card ────────────────────────────────────────────────────────────────
function CC({ title, icon, sub, children, delay = 0 }: {
  title: string; icon: React.ReactNode; sub?: string;
  children: React.ReactNode; delay?: number;
}) {
  return (
    <motion.div
      variants={cardAnim} initial="initial" animate="animate"
      transition={{ delay }}
      whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(0,0,0,0.10)" }}
      className="rounded-2xl border bg-card shadow-sm overflow-hidden transition-shadow duration-300"
    >
      <div className="px-5 py-3.5 border-b bg-gradient-to-r from-muted/40 to-transparent flex items-center gap-2.5">
        <span className="text-blue-500">{icon}</span>
        <div>
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {sub && <span className="text-xs text-muted-foreground ms-2">{sub}</span>}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </motion.div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, icon, colorBg, colorText, colorLight, delay = 0 }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; colorBg: string; colorText: string; colorLight: string; delay?: number;
}) {
  return (
    <motion.div
      variants={cardAnim} initial="initial" animate="animate"
      transition={{ delay }}
      whileHover={{ y: -4, scale: 1.02 }}
      className={`rounded-2xl ${colorLight} border-0 p-4 relative overflow-hidden`}
    >
      <div className={`absolute -top-3 -end-3 w-16 h-16 rounded-full opacity-10 ${colorBg}`} />
      <div className="flex items-start gap-3 relative">
        <div className={`w-9 h-9 rounded-xl ${colorBg} flex items-center justify-center shrink-0`}>
          <span className={`text-sm ${colorText}`}>{icon}</span>
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-0.5">{label}</p>
          <p className={`text-2xl font-extrabold leading-none ${colorText}`}>{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
        </div>
      </div>
    </motion.div>
  );
}

// ── Charts section ────────────────────────────────────────────────────────────
function ChartsSection({ result }: { result: BEMResult }) {
  const { summary, genderStats, subjectStats, scoreDistribution } = result;

  // Pass/Fail donut
  const passPie = [
    { name: "ناجح", value: summary.passCount, color: "#16a34a" },
    { name: "راسب", value: summary.failCount,  color: "#ef4444" },
  ];

  // Grade distribution
  const gradeDist = [
    { label: "18–20", count: result.students.filter(s => (s.average ?? 0) >= 18).length, color: "#7c3aed" },
    { label: "16–18", count: result.students.filter(s => (s.average ?? 0) >= 16 && (s.average ?? 0) < 18).length, color: "#2563eb" },
    { label: "14–16", count: result.students.filter(s => (s.average ?? 0) >= 14 && (s.average ?? 0) < 16).length, color: "#0891b2" },
    { label: "12–14", count: result.students.filter(s => (s.average ?? 0) >= 12 && (s.average ?? 0) < 14).length, color: "#059669" },
    { label: "10–12", count: result.students.filter(s => (s.average ?? 0) >= 10 && (s.average ?? 0) < 12).length, color: "#d97706" },
    { label: "< 10",  count: result.students.filter(s => (s.average ?? 0) < 10).length, color: "#ef4444" },
  ];

  // Gender grouped
  const genderBar = [
    { g: "ذكور",  ناجح: genderStats.malePass,   راسب: genderStats.maleFail },
    { g: "إناث", ناجح: genderStats.femalePass,  راسب: genderStats.femaleFail },
  ];

  // Gender pass rate
  const genderRate = [
    { name: "ذكور",  rate: genderStats.malePassRate,   fill: "#3b82f6" },
    { name: "إناث", rate: genderStats.femalePassRate,  fill: "#ec4899" },
  ];

  // Subject averages
  const subAvg = [...subjectStats].sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0)).map(s => ({
    name: s.arLabel.replace("اللغة ","").replace("التربية ","ت.").replace("العلوم ","علوم ").replace("والجغرافيا","").trim(),
    full: s.arLabel, avg: s.avg ?? 0,
    fill: (s.avg ?? 0) >= 14 ? "#16a34a" : (s.avg ?? 0) >= 10 ? "#3b82f6" : "#ef4444",
  }));

  // Subject pass rate
  const subRate = [...subjectStats].sort((a, b) => b.passRate - a.passRate).map(s => ({
    name: s.arLabel.replace("اللغة ","").replace("التربية ","ت.").replace("العلوم ","علوم ").replace("والجغرافيا","").trim(),
    full: s.arLabel, rate: s.passRate,
    fill: s.passRate >= 70 ? "#16a34a" : s.passRate >= 50 ? "#d97706" : "#ef4444",
  }));

  // Area histogram
  const hist = scoreDistribution.map(d => ({ avg: parseInt(d.range), count: d.count }));

  // Radar
  const top1 = result.students.find(s => s.rank === 1);
  const radarData = subjectStats.slice(0, 8).map(s => ({
    sub: s.arLabel.split(" ").slice(-1)[0] ?? s.arLabel,
    class: s.avg ?? 0,
    top: top1 ? (top1.scores[s.key] ?? 0) : 0,
  }));

  // Coef weighted bar (shows which subjects contribute most to avg)
  const coefData = subjectStats.map(s => ({
    name: s.arLabel.replace("اللغة ","").replace("التربية ","ت.").trim().split(" ")[0],
    full: s.arLabel, coef: s.coef,
    weighted: parseFloat(((s.avg ?? 0) * s.coef / 25 * 20).toFixed(2)),
    fill: "#6366f1",
  })).sort((a, b) => b.weighted - a.weighted);

  // Gender pie
  const genderPie = [
    { name: "ذكور",  value: genderStats.males,   color: "#3b82f6" },
    { name: "إناث", value: genderStats.females,  color: "#ec4899" },
    ...(genderStats.unknown > 0 ? [{ name: "غير محدد", value: genderStats.unknown, color: "#94a3b8" }] : []),
  ];

  const REND_LABEL = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    if (percent < 0.06) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
        {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  return (
    <div className="space-y-4">

      {/* Row 1: Pie pair */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CC title="نسبة النجاح والرسوب" icon={<Target className="w-4 h-4" />} delay={0}>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={passPie} cx="50%" cy="48%" innerRadius={62} outerRadius={95}
                paddingAngle={4} dataKey="value" animationBegin={0} animationDuration={900}
                labelLine={false} label={REND_LABEL}>
                {passPie.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
              </Pie>
              <Tooltip {...TT} formatter={(v: number, n: string) => [v + " تلميذ", n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-5 mt-1">
            {passPie.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                <span className="text-xs text-muted-foreground">{d.name}
                  <strong className="text-foreground ms-1">{d.value}</strong>
                </span>
              </div>
            ))}
          </div>
        </CC>

        <CC title="توزيع الجنس" icon={<Users className="w-4 h-4" />} delay={0.05}>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={genderPie} cx="50%" cy="48%" innerRadius={62} outerRadius={95}
                paddingAngle={4} dataKey="value" animationBegin={0} animationDuration={900}
                labelLine={false} label={REND_LABEL}>
                {genderPie.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
              </Pie>
              <Tooltip {...TT} formatter={(v: number, n: string) => [v + " تلميذ", n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-5 mt-1">
            {genderPie.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                <span className="text-xs text-muted-foreground">{d.name}
                  <strong className="text-foreground ms-1">{d.value}</strong>
                </span>
              </div>
            ))}
          </div>
        </CC>
      </div>

      {/* Row 2: Grade distribution */}
      <CC title="توزيع التقديرات" icon={<BarChart3 className="w-4 h-4" />} delay={0.08}>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={gradeDist} barCategoryGap="22%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#e2e8f0)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip {...TT} formatter={(v: number) => [v + " تلميذ", "العدد"]} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} animationBegin={0} animationDuration={1000} animationEasing="ease-out">
              {gradeDist.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CC>

      {/* Row 3: Gender pass/fail + rate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CC title="النجاح والرسوب حسب الجنس" icon={<Users className="w-4 h-4" />} delay={0.1}>
          <ResponsiveContainer width="100%" height={195}>
            <BarChart data={genderBar} barCategoryGap="35%" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#e2e8f0)" vertical={false} />
              <XAxis dataKey="g" tick={{ fontSize: 13, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...TT} formatter={(v: number, n: string) => [v + " تلميذ", n]} />
              <Legend iconType="circle" iconSize={8}
                formatter={v => <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{v}</span>} />
              <Bar dataKey="ناجح" fill="#16a34a" radius={[5, 5, 0, 0]} animationBegin={0} animationDuration={900} />
              <Bar dataKey="راسب"  fill="#ef4444" radius={[5, 5, 0, 0]} animationBegin={100} animationDuration={900} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between rounded-xl bg-blue-50 dark:bg-blue-950/30 px-3 py-2">
              <span className="text-xs text-blue-600 dark:text-blue-400">نجاح الذكور</span>
              <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{genderStats.malePassRate}%</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-pink-50 dark:bg-pink-950/30 px-3 py-2">
              <span className="text-xs text-pink-600 dark:text-pink-400">نجاح الإناث</span>
              <span className="text-sm font-bold text-pink-700 dark:text-pink-300">{genderStats.femalePassRate}%</span>
            </div>
          </div>
        </CC>

        <CC title="مقارنة نسبة النجاح بين الجنسين" icon={<TrendingUp className="w-4 h-4" />} delay={0.13}>
          <ResponsiveContainer width="100%" height={195}>
            <BarChart data={genderRate} barCategoryGap="45%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#e2e8f0)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 14, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v}%`} />
              <Tooltip {...TT} formatter={(v: number) => [`${v}%`, "نسبة النجاح"]} />
              <Bar dataKey="rate" radius={[8, 8, 0, 0]} animationBegin={0} animationDuration={1000} animationEasing="ease-out">
                {genderRate.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-8 mt-2 text-xs">
            <div className="text-center">
              <p className="text-blue-600 font-bold text-lg">{genderStats.malePass}<span className="text-muted-foreground font-normal text-xs">/{genderStats.males}</span></p>
              <p className="text-muted-foreground">ناجحون ذكور</p>
            </div>
            <div className="w-px bg-border" />
            <div className="text-center">
              <p className="text-pink-600 font-bold text-lg">{genderStats.femalePass}<span className="text-muted-foreground font-normal text-xs">/{genderStats.females}</span></p>
              <p className="text-muted-foreground">ناجحات إناث</p>
            </div>
          </div>
        </CC>
      </div>

      {/* Row 4: Subject averages horizontal */}
      <CC title="متوسط نقاط كل مادة" icon={<Award className="w-4 h-4" />} delay={0.15}>
        <ResponsiveContainer width="100%" height={Math.max(220, subAvg.length * 34)}>
          <BarChart data={subAvg} layout="vertical" barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#e2e8f0)" horizontal={false} />
            <XAxis type="number" domain={[0, 20]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={v => `${v}`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={85} />
            <Tooltip {...TT}
              formatter={(v: number) => [`${v.toFixed(2)}/20`, "المتوسط"]}
              labelFormatter={l => subAvg.find(s => s.name === l)?.full ?? l} />
            <Bar dataKey="avg" radius={[0, 6, 6, 0]} animationBegin={0} animationDuration={1100} animationEasing="ease-out">
              {subAvg.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.9} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 mt-2 text-xs">
          {[{ l: "≥14 ممتاز", c: "#16a34a" }, { l: "10–14 مقبول", c: "#3b82f6" }, { l: "<10 ضعيف", c: "#ef4444" }].map(d => (
            <div key={d.l} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.c }} />
              <span className="text-muted-foreground">{d.l}</span>
            </div>
          ))}
        </div>
      </CC>

      {/* Row 5: Subject pass rates */}
      <CC title="نسبة النجاح في كل مادة" icon={<Zap className="w-4 h-4" />} delay={0.18}>
        <ResponsiveContainer width="100%" height={Math.max(220, subRate.length * 34)}>
          <BarChart data={subRate} layout="vertical" barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#e2e8f0)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={85} />
            <Tooltip {...TT}
              formatter={(v: number) => [`${v.toFixed(1)}%`, "نسبة النجاح"]}
              labelFormatter={l => subRate.find(s => s.name === l)?.full ?? l} />
            <Bar dataKey="rate" radius={[0, 6, 6, 0]} animationBegin={0} animationDuration={1100} animationEasing="ease-out">
              {subRate.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.9} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 mt-2 text-xs">
          {[{ l: "≥70% ممتاز", c: "#16a34a" }, { l: "50–70% وسط", c: "#d97706" }, { l: "<50% ضعيف", c: "#ef4444" }].map(d => (
            <div key={d.l} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.c }} />
              <span className="text-muted-foreground">{d.l}</span>
            </div>
          ))}
        </div>
      </CC>

      {/* Row 6: Radar + Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CC title={`الأول مقابل متوسط القسم`} icon={<Award className="w-4 h-4" />}
          sub={top1 ? `— ${top1.name} (${top1.average?.toFixed(2)})` : ""} delay={0.2}>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={88}>
              <PolarGrid stroke="var(--border,#e2e8f0)" />
              <PolarAngleAxis dataKey="sub" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <PolarRadiusAxis domain={[0, 20]} tick={{ fontSize: 8 }} tickCount={5} />
              <Radar name="متوسط القسم" dataKey="class"
                stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.12} strokeWidth={2}
                animationBegin={0} animationDuration={1000} />
              <Radar name="الأول" dataKey="top"
                stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.18} strokeWidth={2}
                animationBegin={200} animationDuration={1000} />
              <Legend iconSize={8}
                formatter={v => <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{v}</span>} />
              <Tooltip {...TT} formatter={(v: number) => [`${v}/20`]} />
            </RadarChart>
          </ResponsiveContainer>
        </CC>

        <CC title="منحنى توزيع المعدلات" icon={<TrendingUp className="w-4 h-4" />} delay={0.22}>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={hist}>
              <defs>
                <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#e2e8f0)" vertical={false} />
              <XAxis dataKey="avg" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v % 2 === 0 ? `${v}` : ""} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...TT}
                formatter={(v: number) => [v, "تلميذ"]}
                labelFormatter={l => `المعدل ${l}–${Number(l)+1}`} />
              {/* Reference line at 10 */}
              <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2.5}
                fill="url(#grad1)" animationBegin={0} animationDuration={1200} animationEasing="ease-out"
                dot={{ r: 3, fill: "#3b82f6", stroke: "white", strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: "#3b82f6", stroke: "white", strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground text-center mt-1">النجاح ≥ 10/20</p>
        </CC>
      </div>

      {/* Row 7: Weighted contribution */}
      <CC title="مساهمة كل مادة في المعدل النهائي (معدل × معامل)" icon={<BarChart3 className="w-4 h-4" />} delay={0.24}>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={coefData} barCategoryGap="22%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#e2e8f0)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip {...TT}
              formatter={(v: number, _n: string, p: any) => [
                `${v.toFixed(2)} نقطة مرجّحة (معامل ×${p.payload?.coef})`, p.payload?.full
              ]} />
            <Bar dataKey="weighted" fill="#6366f1" radius={[5, 5, 0, 0]}
              animationBegin={0} animationDuration={1000} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground text-center mt-1">
          كلما ارتفع العمود، كلما أثّرت المادة أكثر في المعدل النهائي
        </p>
      </CC>

    </div>
  );
}

// ── Spotlight card ────────────────────────────────────────────────────────────
function SpotlightCard({ student, subjects, variant, delay }: {
  student: BEMStudent; subjects: BEMSubjectDef[]; variant: "first" | "last"; delay: number;
}) {
  const isFirst = variant === "first";
  const g = isFirst
    ? "from-amber-50 via-yellow-50/60 to-orange-50/30 dark:from-amber-950/40 dark:via-yellow-950/20 dark:to-orange-950/10 border-amber-200 dark:border-amber-800"
    : "from-slate-50 to-zinc-50/50 dark:from-slate-900/50 dark:to-zinc-900/30 border-slate-200 dark:border-slate-700";
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 220, damping: 20 }}
      whileHover={{ y: -5, boxShadow: "0 12px 40px rgba(0,0,0,0.12)" }}
      className={`rounded-2xl border p-5 relative overflow-hidden shadow-md bg-gradient-to-br ${g}`}>
      <div className={`absolute -top-8 -end-8 w-28 h-28 rounded-full opacity-10 ${isFirst ? "bg-amber-400" : "bg-slate-400"}`} />
      <div className={`absolute -bottom-6 -start-6 w-20 h-20 rounded-full opacity-5 ${isFirst ? "bg-orange-400" : "bg-slate-300"}`} />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            className={`w-13 h-13 rounded-2xl flex items-center justify-center text-2xl shadow-lg ${
              isFirst ? "bg-gradient-to-br from-amber-400 to-orange-400" : "bg-gradient-to-br from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700"
            }`}
            animate={isFirst ? { scale: [1, 1.07, 1], rotate: [0, 3, -3, 0] } : {}}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
            {isFirst ? "🥇" : "🔻"}
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${isFirst ? "text-amber-600 dark:text-amber-400" : "text-slate-500"}`}>
              {isFirst ? "المتفوق الأول" : "الأخير في الترتيب"}
            </p>
            <p className="font-bold text-foreground truncate">{student.name}</p>
            <p className="text-xs text-muted-foreground">
              {student.gender === "male" ? "🔵 ذكر" : student.gender === "female" ? "🔴 أنثى" : ""}
              {student.average && ` · ${gradeLabel(student.average).label}`}
            </p>
          </div>
          <div className="text-end shrink-0">
            <p className={`text-3xl font-extrabold tabular-nums ${isFirst ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>
              {student.average?.toFixed(2) ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">/20</p>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {subjects.map((s, i) => {
            const sc = student.scores[s.key];
            return (
              <motion.div key={s.key}
                initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: delay + i * 0.03, type: "spring", stiffness: 300 }}
                className={`rounded-xl p-1.5 text-center border ${
                  sc === null ? "bg-muted/30 border-transparent" :
                  sc >= 16 ? "bg-emerald-100 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800" :
                  sc >= 10 ? "bg-blue-50 border-blue-100 dark:bg-blue-950/30 dark:border-blue-800" :
                  "bg-red-50 border-red-100 dark:bg-red-950/30 dark:border-red-800"
                }`}>
                <p className={`text-xs font-bold ${
                  sc === null ? "text-muted-foreground" :
                  sc >= 16 ? "text-emerald-700 dark:text-emerald-300" :
                  sc >= 10 ? "text-blue-700 dark:text-blue-300" : "text-red-600 dark:text-red-400"
                }`}>{sc !== null ? sc.toFixed(1) : "—"}</p>
                <p className="text-[8px] text-muted-foreground leading-tight mt-0.5 truncate">
                  {s.arLabel.replace("اللغة ","").replace("التربية ","").split(" ")[0]}
                </p>
              </motion.div>
            );
          })}
        </div>
        {student.average && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">المستوى</span>
              <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${gradeLabel(student.average).cls}`}>
                {gradeLabel(student.average).label}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${isFirst ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-slate-400"}`}
                initial={{ width: 0 }} animate={{ width: `${(student.average / 20) * 100}%` }}
                transition={{ delay: delay + 0.4, duration: 0.8, ease: "easeOut" }} />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Upload zone ───────────────────────────────────────────────────────────────
function UploadZone({ onResult }: { onResult: (r: BEMResult) => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);

  const doUpload = async (file: File) => {
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res  = await fetch(`${BASE}api/bem/analyze`, { method: "POST", body: form, credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      onResult(data);
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ في التحليل", description: e.message });
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
      className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all duration-300
        ${drag ? "border-violet-500 bg-violet-50/80 dark:bg-violet-950/20 scale-[1.015]"
               : "border-muted-foreground/20 hover:border-violet-400 hover:bg-muted/20"}`}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => {
        e.preventDefault(); setDrag(false);
        const f = e.dataTransfer.files[0];
        if (f && /\.(xlsx|xls)$/i.test(f.name)) doUpload(f);
        else toast({ variant: "destructive", title: "يجب أن يكون الملف بصيغة .xlsx أو .xls" });
      }}
      onClick={() => fileRef.current?.click()}>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) doUpload(f); }} />
      <motion.div
        animate={loading ? { rotate: 360 } : drag ? { scale: 1.15, rotate: -5 } : { y: [0, -8, 0] }}
        transition={loading
          ? { duration: 0.8, repeat: Infinity, ease: "linear" }
          : drag ? { type: "spring", stiffness: 300 }
          : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}>
        {loading ? (
          <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full mx-auto mb-4" />
        ) : (
          <div className={`w-16 h-16 rounded-2xl ${drag ? "bg-violet-500" : "bg-violet-500/10"} flex items-center justify-center mx-auto mb-4 transition-colors duration-200`}>
            <FileSpreadsheet className={`w-8 h-8 ${drag ? "text-white" : "text-violet-500"}`} />
          </div>
        )}
      </motion.div>
      <p className="text-lg font-semibold text-foreground mb-1">
        {loading ? "جارٍ تحليل ملف BEM..." : "أسقط ملف نتائج BEM هنا"}
      </p>
      <p className="text-sm text-muted-foreground">
        {loading ? "يرجى الانتظار" : "أو انقر للاختيار — .xlsx / .xls"}
      </p>
    </motion.div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
type TabId = "overview" | "charts" | "table";
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "overview", label: "نظرة عامة",       icon: "📋" },
  { id: "charts",   label: "الرسوم البيانية", icon: "📊" },
  { id: "table",    label: "كشف النتائج",     icon: "📄" },
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BEMPage() {
  const [result,    setResult]    = useState<BEMResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const reset = () => { setResult(null); setActiveTab("overview"); };

  return (
    <motion.div variants={fadeUp} initial="initial" animate="animate" exit="exit"
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="p-6 space-y-5 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <span className="text-2xl">🎓</span> تحليل نتائج امتحان BEM
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            بريفيه التعليم المتوسط — يحلل ملف Excel ويصنف التلاميذ حسب المعدل
          </p>
        </motion.div>
        {result && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }} className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => window.print()}>
              <Printer className="w-4 h-4" /> طباعة
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={reset}>
              <RotateCcw className="w-4 h-4" /> ملف جديد
            </Button>
          </motion.div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div key="upload" exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.25 }} className="max-w-2xl mx-auto space-y-5 print:hidden">
            <UploadZone onResult={setResult} />
            <motion.div className="rounded-2xl bg-muted/40 border p-5 space-y-3"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <p className="font-semibold text-sm">المواد المعتمدة في BEM وأوزانها:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { ar: "اللغة العربية",      coef: 5, c: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
                  { ar: "الرياضيات",           coef: 4, c: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" },
                  { ar: "اللغة الفرنسية",      coef: 3, c: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
                  { ar: "التاريخ والجغرافيا",  coef: 3, c: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300" },
                  { ar: "التربية الإسلامية",   coef: 2, c: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
                  { ar: "اللغة الإنجليزية",   coef: 2, c: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" },
                  { ar: "علوم الطبيعة",        coef: 2, c: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" },
                  { ar: "العلوم الفيزيائية",   coef: 2, c: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300" },
                  { ar: "التربية المدنية",     coef: 1, c: "bg-slate-100 text-slate-600 dark:bg-slate-950/40 dark:text-slate-300" },
                  { ar: "التربية البدنية",     coef: 1, c: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
                ].map((s, i) => (
                  <motion.div key={i} className={`flex items-center justify-between rounded-xl px-3 py-2 ${s.c}`}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 + 0.2, type: "spring", stiffness: 300, damping: 25 }}>
                    <span className="text-xs font-medium">{s.ar}</span>
                    <span className="text-xs font-black ms-2 opacity-80">×{s.coef}</span>
                  </motion.div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">المجموع الكلي: <strong>25</strong> — العتبة: <strong>10/20</strong></p>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }} className="space-y-5">

            {/* File badge */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }} className="print:hidden">
              <Badge variant="secondary" className="text-xs gap-1.5 rounded-lg px-3 py-1">
                <FileSpreadsheet className="w-3 h-3" /> {result.fileName}
                <span className="text-muted-foreground ms-1">— {result.detectedSubjects.length} مادة</span>
              </Badge>
            </motion.div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:hidden">
              {[
                { label: "التلاميذ",   value: result.summary.total,                              icon: <Users className="w-4 h-4" />,    colorBg: "bg-blue-500",    colorText: "text-blue-600 dark:text-blue-400",    colorLight: "bg-blue-50 dark:bg-blue-950/30" },
                { label: "الناجحون",   value: result.summary.passCount,                           icon: "✅",                              colorBg: "bg-emerald-500", colorText: "text-emerald-600 dark:text-emerald-400", colorLight: "bg-emerald-50 dark:bg-emerald-950/30", sub: `${result.summary.passRate}% نجاح` },
                { label: "الراسبون",   value: result.summary.failCount,                           icon: "❌",                              colorBg: "bg-red-500",     colorText: "text-red-600 dark:text-red-400",      colorLight: "bg-red-50 dark:bg-red-950/30" },
                { label: "نسبة النجاح", value: `${result.summary.passRate}%`,                    icon: <Target className="w-4 h-4" />,   colorBg: "bg-violet-500",  colorText: "text-violet-600 dark:text-violet-400", colorLight: "bg-violet-50 dark:bg-violet-950/30" },
                { label: "معدل القسم", value: result.summary.classAvg?.toFixed(2) ?? "—",        icon: <TrendingUp className="w-4 h-4" />, colorBg: "bg-amber-500", colorText: "text-amber-600 dark:text-amber-400",  colorLight: "bg-amber-50 dark:bg-amber-950/30" },
                { label: "ذ / أ",      value: `${result.genderStats.males}/${result.genderStats.females}`, icon: <Users className="w-4 h-4" />, colorBg: "bg-sky-500", colorText: "text-sky-600 dark:text-sky-400", colorLight: "bg-sky-50 dark:bg-sky-950/30" },
              ].map((s, i) => (
                <KPI key={i} {...s} delay={i * 0.06} />
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-0.5 border-b overflow-x-auto print:hidden">
              {TABS.map(tab => {
                const active = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap -mb-px
                      ${active ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"}`}>
                    <span>{tab.icon}</span> {tab.label}
                    {active && (
                      <motion.div layoutId="tab-indicator"
                        className="absolute inset-0 bg-blue-50 dark:bg-blue-950/20 rounded-t-lg -z-10"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
              <motion.div key={activeTab}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}>

                {/* ── OVERVIEW ── */}
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    {(result.summary.first || result.summary.last) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {result.summary.first && (
                          <SpotlightCard student={result.summary.first} subjects={result.detectedSubjects} variant="first" delay={0.05} />
                        )}
                        {result.summary.last && result.summary.last.name !== result.summary.first?.name && (
                          <SpotlightCard student={result.summary.last} subjects={result.detectedSubjects} variant="last" delay={0.1} />
                        )}
                      </div>
                    )}

                    {/* Subject summary table */}
                    <motion.div variants={cardAnim} initial="initial" animate="animate" transition={{ delay: 0.15 }}
                      className="rounded-2xl border overflow-hidden shadow-sm">
                      <div className="px-5 py-3 border-b bg-gradient-to-r from-muted/40 to-transparent flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-semibold">ملخص المواد</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/30">
                            <tr>{["المادة","المعامل","المتوسط","ناجح","نسبة النجاح"].map(h => (
                              <th key={h} className="px-3 py-2.5 text-right font-semibold text-muted-foreground">{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody>
                            {result.subjectStats.map((s, i) => (
                              <motion.tr key={s.key}
                                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.18 + i * 0.03 }}
                                className={`border-t hover:bg-muted/20 transition-colors ${i % 2 === 1 ? "bg-muted/10" : ""}`}>
                                <td className="px-3 py-2.5 font-medium">{s.arLabel}</td>
                                <td className="px-3 py-2.5 text-center text-muted-foreground">×{s.coef}</td>
                                <td className={`px-3 py-2.5 text-center font-bold font-mono ${(s.avg ?? 0) >= 14 ? "text-emerald-600" : (s.avg ?? 0) >= 10 ? "text-blue-600" : "text-red-500"}`}>
                                  {s.avg?.toFixed(2) ?? "—"}
                                </td>
                                <td className="px-3 py-2.5 text-center text-emerald-600 font-semibold">{s.passCount}/{s.total}</td>
                                <td className="px-3 py-2.5 min-w-[120px]">
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                                      <motion.div
                                        className={`h-full rounded-full ${s.passRate >= 70 ? "bg-emerald-500" : s.passRate >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                                        initial={{ width: 0 }} animate={{ width: `${s.passRate}%` }}
                                        transition={{ delay: 0.3 + i * 0.04, duration: 0.7, ease: "easeOut" }} />
                                    </div>
                                    <span className="text-muted-foreground w-9 text-right tabular-nums">{s.passRate.toFixed(0)}%</span>
                                  </div>
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  </div>
                )}

                {/* ── CHARTS ── */}
                {activeTab === "charts" && <ChartsSection result={result} />}

                {/* ── TABLE ── */}
                {activeTab === "table" && (
                  <motion.div variants={cardAnim} initial="initial" animate="animate"
                    className="rounded-2xl border overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            {["الرتبة","الاسم واللقب","الجنس",
                              ...result.detectedSubjects.map(s => s.arLabel.split(" ")[0] ?? ""),
                              "المعدل","النتيجة"].map((h, i) => (
                              <th key={i} className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap first:text-start">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.students.map((s, i) => (
                            <motion.tr key={s.name + i}
                              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: Math.min(i * 0.01, 0.4) }}
                              className={`border-t transition-colors hover:bg-muted/25 ${
                                i === 0 ? "bg-amber-50/60 dark:bg-amber-950/10" : i % 2 === 0 ? "" : "bg-muted/8"}`}>
                              <td className="px-3 py-2.5">
                                {s.rank > 0
                                  ? <span className={`font-bold ${medalColor(s.rank)}`}>{medalEmoji(s.rank) ?? s.rank}</span>
                                  : <span className="text-muted-foreground text-xs">—</span>}
                              </td>
                              <td className="px-3 py-2.5 font-medium min-w-[140px]">{s.name}</td>
                              <td className="px-3 py-2.5 text-center">
                                {s.gender === "male" ? "🔵" : s.gender === "female" ? "🔴" : "⚪"}
                              </td>
                              {result.detectedSubjects.map(subj => {
                                const sc = s.scores[subj.key];
                                return (
                                  <td key={subj.key} className={`px-2 py-2.5 text-center font-mono text-sm ${
                                    sc === null ? "text-muted-foreground" :
                                    sc >= 16 ? "text-emerald-600 font-bold" :
                                    sc >= 10 ? "text-foreground" : "text-red-500"}`}>
                                    {sc !== null ? sc.toFixed(1) : "—"}
                                  </td>
                                );
                              })}
                              <td className={`px-3 py-2.5 text-center font-bold font-mono ${
                                s.average === null ? "text-muted-foreground" :
                                s.average >= 16 ? "text-emerald-600" :
                                s.average >= 10 ? "text-blue-600 dark:text-blue-400" : "text-red-500"}`}>
                                {s.average?.toFixed(2) ?? "—"}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {s.passed === null ? <span className="text-muted-foreground text-xs">—</span>
                                  : s.passed
                                    ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">ناجح ✓</span>
                                    : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">راسب ✗</span>}
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

              </motion.div>
            </AnimatePresence>

            {/* Print table */}
            <div className="hidden print:block" dir="rtl">
              <div style={{ textAlign: "center", marginBottom: "12px" }}>
                <h2 style={{ fontSize: "16pt", fontWeight: "bold", margin: "0 0 4px" }}>نتائج امتحان شهادة التعليم المتوسط</h2>
                <p style={{ fontSize: "10pt", color: "#555", margin: 0 }}>
                  إجمالي: {result.summary.total} | ناجح: {result.summary.passCount} | راسب: {result.summary.failCount} |
                  نسبة النجاح: {result.summary.passRate}% | معدل القسم: {result.summary.classAvg?.toFixed(2) ?? "—"} |
                  ذكور: {result.genderStats.males} / إناث: {result.genderStats.females}
                </p>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10pt" }}>
                <thead>
                  <tr style={{ background: "#f0f0f0" }}>
                    {["الرتبة","الاسم","الجنس","المعدل","النتيجة"].map(h => (
                      <th key={h} style={{ border: "1px solid #999", padding: "5px 8px", textAlign: "center" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.students.map((s, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f9f9f9" }}>
                      <td style={{ border: "1px solid #ccc", padding: "3px 8px", textAlign: "center" }}>{s.rank > 0 ? s.rank : "—"}</td>
                      <td style={{ border: "1px solid #ccc", padding: "3px 8px" }}>{s.name}</td>
                      <td style={{ border: "1px solid #ccc", padding: "3px 8px", textAlign: "center" }}>{s.gender === "male" ? "ذكر" : s.gender === "female" ? "أنثى" : "—"}</td>
                      <td style={{ border: "1px solid #ccc", padding: "3px 8px", textAlign: "center", fontWeight: "bold", color: (s.average ?? 0) >= 10 ? "#16a34a" : "#dc2626" }}>
                        {s.average?.toFixed(2) ?? "—"}
                      </td>
                      <td style={{ border: "1px solid #ccc", padding: "3px 8px", textAlign: "center", fontWeight: "bold", color: s.passed ? "#16a34a" : "#dc2626" }}>
                        {s.passed === true ? "ناجح ✓" : s.passed === false ? "راسب ✗" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}