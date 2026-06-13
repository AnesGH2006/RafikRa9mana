import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, RotateCcw, Printer, BarChart3, Users } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area,
} from "recharts";

const BASE = import.meta.env.BASE_URL;

// ── Types ─────────────────────────────────────────────────────────────────────
interface BEMSubjectDef { key: string; arLabel: string; coef: number }

interface BEMStudent {
  name: string;
  gender: "male" | "female" | "unknown";
  scores: Record<string, number | null>;
  average: number | null;
  passed: boolean | null;
  rank: number;
}

interface BEMSummary {
  total: number; withAvg: number;
  passCount: number; failCount: number;
  passRate: number; classAvg: number | null;
  first: BEMStudent | null; last: BEMStudent | null;
}

interface GenderStats {
  males: number; females: number; unknown: number;
  malePass: number; maleFail: number;
  femalePass: number; femaleFail: number;
  malePassRate: number; femalePassRate: number;
}

interface SubjectStat {
  key: string; arLabel: string; coef: number;
  avg: number | null; passCount: number; total: number; passRate: number;
}

interface BEMResult {
  students: BEMStudent[];
  summary: BEMSummary;
  genderStats: GenderStats;
  subjectStats: SubjectStat[];
  scoreDistribution: { range: string; count: number }[];
  detectedSubjects: BEMSubjectDef[];
  fileName: string;
}

// ── Animation ─────────────────────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function medalColor(rank: number) {
  if (rank === 1) return "text-amber-500";
  if (rank === 2) return "text-slate-400";
  if (rank === 3) return "text-orange-500";
  return "text-muted-foreground";
}
function medalEmoji(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--background,#fff)",
    border: "1px solid var(--border,#e2e8f0)",
    borderRadius: "8px",
    fontSize: "12px",
    direction: "rtl" as const,
  },
  cursor: { fill: "var(--muted,#f1f5f9)" },
};

// ── Chart wrapper card ────────────────────────────────────────────────────────
function ChartCard({ title, icon, children }: {
  title: string; icon: string; children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="rounded-xl border bg-card shadow-sm overflow-hidden"
    >
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </motion.div>
  );
}

// ── Charts section ────────────────────────────────────────────────────────────
function ChartsSection({ result }: { result: BEMResult }) {
  const { summary, genderStats, subjectStats, scoreDistribution } = result;

  // 1. Pass/fail pie
  const passPieData = [
    { name: "ناجح", value: summary.passCount, color: "#16a34a" },
    { name: "راسب", value: summary.failCount,  color: "#dc2626" },
  ];

  // 2. Gender pie
  const genderPieData = [
    { name: "ذكور",  value: genderStats.males,   color: "#2563eb" },
    { name: "إناث", value: genderStats.females,  color: "#db2777" },
    ...(genderStats.unknown > 0 ? [{ name: "غير محدد", value: genderStats.unknown, color: "#94a3b8" }] : []),
  ];

  // 3. Gender pass/fail grouped bar
  const genderBarData = [
    {
      group: "ذكور",
      ناجح:  genderStats.malePass,
      راسب:  genderStats.maleFail,
    },
    {
      group: "إناث",
      ناجح:  genderStats.femalePass,
      راسب:  genderStats.femaleFail,
    },
  ];

  // 4. Gender pass rate comparison
  const genderRateData = [
    { name: "ذكور",  rate: genderStats.malePassRate,   fill: "#2563eb" },
    { name: "إناث", rate: genderStats.femalePassRate,  fill: "#db2777" },
  ];

  // 5. Subject averages (horizontal)
  const subjectAvgData = [...subjectStats]
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
    .map(s => ({
      name:     s.arLabel.replace("اللغة ", "").replace("التربية ", "ت. ").replace("العلوم ", "علوم "),
      fullName: s.arLabel,
      avg:      s.avg ?? 0,
      fill:     (s.avg ?? 0) >= 14 ? "#16a34a" : (s.avg ?? 0) >= 10 ? "#2563eb" : "#dc2626",
    }));

  // 6. Subject pass rates
  const subjectRateData = [...subjectStats]
    .sort((a, b) => b.passRate - a.passRate)
    .map(s => ({
      name:     s.arLabel.replace("اللغة ", "").replace("التربية ", "ت. ").replace("العلوم ", "علوم "),
      fullName: s.arLabel,
      rate:     s.passRate,
      fill:     s.passRate >= 70 ? "#16a34a" : s.passRate >= 50 ? "#d97706" : "#dc2626",
    }));

  // 7. Score histogram (area)
  const histData = scoreDistribution.map(d => ({
    avg:   parseInt(d.range),
    count: d.count,
  }));

  // 8. Radar — subject scores for top student
  const topStudent = result.students.find(s => s.rank === 1);
  const radarData = subjectStats.slice(0, 8).map(s => ({
    subject:    s.arLabel.split(" ")[s.arLabel.startsWith("ال") ? 1 : 0] ?? s.arLabel,
    classAvg:   s.avg ?? 0,
    topStudent: topStudent ? (topStudent.scores[s.key] ?? 0) : 0,
  }));

  return (
    <div className="space-y-4">

      {/* Row 1: Pass/Fail + Gender distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <ChartCard title="نسبة النجاح والرسوب" icon="🥧">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={passPieData} cx="50%" cy="45%" innerRadius={60} outerRadius={90}
                paddingAngle={3} dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                labelLine={false}>
                {passPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [v, "تلميذ"]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6">
            {passPieData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                {d.name}: <strong className="text-foreground ms-0.5">{d.value}</strong>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="توزيع الجنس" icon="👥">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={genderPieData} cx="50%" cy="45%" innerRadius={60} outerRadius={90}
                paddingAngle={3} dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                labelLine={false}>
                {genderPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [v, "تلميذ"]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6">
            {genderPieData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                {d.name}: <strong className="text-foreground ms-0.5">{d.value}</strong>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Row 2: Gender pass/fail grouped + gender pass rate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <ChartCard title="النجاح والرسوب حسب الجنس" icon="📊">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={genderBarData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#e2e8f0)" vertical={false} />
              <XAxis dataKey="group" tick={{ fontSize: 13, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number, name: string) => [v, name]} />
              <Legend formatter={v => <span style={{ fontSize: 12 }}>{v}</span>} />
              <Bar dataKey="ناجح" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="راسب"  fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {/* Mini stats below */}
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {[
              { label: "نسبة نجاح الذكور",  val: `${genderStats.malePassRate}%`,   color: "text-blue-600" },
              { label: "نسبة نجاح الإناث", val: `${genderStats.femalePassRate}%`, color: "text-pink-600" },
            ].map(d => (
              <div key={d.label} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5">
                <span className="text-muted-foreground">{d.label}</span>
                <span className={`font-bold ${d.color}`}>{d.val}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="مقارنة نسبة النجاح بين الجنسين" icon="⚖️">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={genderRateData} barCategoryGap="40%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#e2e8f0)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 13, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v}%`} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, "نسبة النجاح"]} />
              <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                {genderRateData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex justify-center gap-6 text-xs text-muted-foreground">
            <span>🔵 ذكور: <strong className="text-blue-600">{genderStats.malePass}/{genderStats.males}</strong></span>
            <span>🔴 إناث: <strong className="text-pink-600">{genderStats.femalePass}/{genderStats.females}</strong></span>
          </div>
        </ChartCard>
      </div>

      {/* Row 3: Subject averages (horizontal bar) */}
      <ChartCard title="متوسط نقاط كل مادة" icon="📏">
        <ResponsiveContainer width="100%" height={Math.max(200, subjectAvgData.length * 32)}>
          <BarChart data={subjectAvgData} layout="vertical" barCategoryGap="18%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#e2e8f0)" horizontal={false} />
            <XAxis type="number" domain={[0, 20]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
            <Tooltip {...TOOLTIP_STYLE}
              formatter={(v: number) => [`${v.toFixed(2)}/20`, "المتوسط"]}
              labelFormatter={label => subjectAvgData.find(s => s.name === label)?.fullName ?? label} />
            <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
              {subjectAvgData.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 mt-2 text-xs">
          {[
            { label: "≥14 ممتاز",    color: "#16a34a" },
            { label: "10–14 مقبول", color: "#2563eb" },
            { label: "<10 ضعيف",    color: "#dc2626" },
          ].map(d => (
            <div key={d.label} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
              <span className="text-muted-foreground">{d.label}</span>
            </div>
          ))}
        </div>
      </ChartCard>

      {/* Row 4: Subject pass rates */}
      <ChartCard title="نسبة النجاح في كل مادة" icon="✅">
        <ResponsiveContainer width="100%" height={Math.max(200, subjectRateData.length * 32)}>
          <BarChart data={subjectRateData} layout="vertical" barCategoryGap="18%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#e2e8f0)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
            <Tooltip {...TOOLTIP_STYLE}
              formatter={(v: number) => [`${v.toFixed(1)}%`, "نسبة النجاح"]}
              labelFormatter={label => subjectRateData.find(s => s.name === label)?.fullName ?? label} />
            <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
              {subjectRateData.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 mt-2 text-xs">
          {[
            { label: "≥70% ممتاز",  color: "#16a34a" },
            { label: "50–70% وسط", color: "#d97706" },
            { label: "<50% ضعيف",  color: "#dc2626" },
          ].map(d => (
            <div key={d.label} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
              <span className="text-muted-foreground">{d.label}</span>
            </div>
          ))}
        </div>
      </ChartCard>

      {/* Row 5: Radar + Score histogram */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <ChartCard title={`مقارنة الأول بمتوسط القسم${topStudent ? ` — ${topStudent.name}` : ""}`} icon="🕸️">
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={90}>
              <PolarGrid stroke="var(--border,#e2e8f0)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis domain={[0, 20]} tick={{ fontSize: 9 }} tickCount={5} />
              <Radar name="متوسط القسم" dataKey="classAvg"
                stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} strokeWidth={2} />
              <Radar name="الأول" dataKey="topStudent"
                stroke="#d97706" fill="#d97706" fillOpacity={0.2} strokeWidth={2} />
              <Legend formatter={v => <span style={{ fontSize: 11 }}>{v}</span>} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}/20`]} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="منحنى توزيع المعدلات" icon="📈">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={histData}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border,#e2e8f0)" vertical={false} />
              <XAxis dataKey="avg" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v % 2 === 0 ? String(v) : ""} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_STYLE}
                formatter={(v: number) => [v, "عدد التلاميذ"]}
                labelFormatter={l => `المعدل: ${l}–${Number(l) + 1}`} />
              <Area type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2}
                fill="url(#areaGrad)" dot={{ r: 3, fill: "#2563eb" }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground text-center mt-1">
            الخط الفاصل عند 10/20 — النجاح ≥ 10
          </p>
        </ChartCard>
      </div>

    </div>
  );
}

// ── Spotlight card ────────────────────────────────────────────────────────────
function SpotlightCard({ student, subjects, variant, delay }: {
  student: BEMStudent; subjects: BEMSubjectDef[]; variant: "first" | "last"; delay: number;
}) {
  const isFirst = variant === "first";
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.45, ease: "easeOut" as const }}
      whileHover={{ y: -4 }}
      className={`rounded-2xl border p-5 relative overflow-hidden shadow-md print:hidden ${
        isFirst
          ? "bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800"
          : "bg-gradient-to-br from-slate-50 to-zinc-50 dark:from-slate-900/40 dark:to-zinc-900/30 border-slate-200 dark:border-slate-700"
      }`}>
      <div className={`absolute -top-6 -end-6 w-24 h-24 rounded-full opacity-10 ${isFirst ? "bg-amber-400" : "bg-slate-400"}`} />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-md ${
              isFirst ? "bg-amber-400 shadow-amber-200" : "bg-slate-300 dark:bg-slate-700"
            }`}
            animate={isFirst ? { scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}>
            {isFirst ? "🥇" : "🔻"}
          </motion.div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${isFirst ? "text-amber-600 dark:text-amber-400" : "text-slate-500"}`}>
              {isFirst ? "المتفوق الأول" : "الأخير"}
            </p>
            <p className="font-bold text-foreground leading-tight">{student.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {student.gender === "male" ? "🔵 ذكر" : student.gender === "female" ? "🔴 أنثى" : ""}
            </p>
          </div>
          <div className="ms-auto text-end">
            <p className={`text-3xl font-extrabold ${isFirst ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>
              {student.average?.toFixed(2) ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">/20</p>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
          {subjects.map((s, i) => {
            const score = student.scores[s.key];
            return (
              <motion.div key={s.key}
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: delay + i * 0.04 }}
                className={`rounded-lg p-1.5 text-center ${
                  score === null ? "bg-muted/40" :
                  score >= 15 ? "bg-emerald-100 dark:bg-emerald-950/40" :
                  score >= 10 ? "bg-blue-50 dark:bg-blue-950/30" : "bg-red-50 dark:bg-red-950/30"
                }`}>
                <p className={`text-xs font-bold ${
                  score === null ? "text-muted-foreground" :
                  score >= 15 ? "text-emerald-700 dark:text-emerald-300" :
                  score >= 10 ? "text-blue-700 dark:text-blue-300" : "text-red-600 dark:text-red-400"
                }`}>
                  {score !== null ? score.toFixed(1) : "—"}
                </p>
                <p className="text-[9px] text-muted-foreground leading-tight mt-0.5 truncate px-0.5">
                  {s.arLabel.split(" ")[0]}
                </p>
              </motion.div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">المعامل الإجمالي: {subjects.reduce((s, sub) => s + sub.coef, 0)}</span>
          {student.passed !== null && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              student.passed
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
            }`}>
              {student.passed ? "✓ ناجح" : "✗ راسب"}
            </span>
          )}
        </div>
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
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
      className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all duration-200
        ${drag ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20 scale-[1.01]" : "border-muted-foreground/25 hover:border-violet-400 hover:bg-muted/30"}`}
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
      <motion.div animate={loading ? {} : drag ? { scale: 1.1 } : { y: [0, -6, 0] }}
        transition={{ duration: 2.5, repeat: loading ? 0 : Infinity, ease: "easeInOut" }}>
        {loading ? (
          <motion.div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full mx-auto mb-4"
            animate={{ rotate: 360 }} transition={{ duration: 0.85, repeat: Infinity, ease: "linear" }} />
        ) : (
          <div className={`w-16 h-16 rounded-2xl ${drag ? "bg-violet-500" : "bg-violet-500/10"} flex items-center justify-center mx-auto mb-4`}>
            <FileSpreadsheet className={`w-8 h-8 ${drag ? "text-white" : "text-violet-500"}`} />
          </div>
        )}
      </motion.div>
      <p className="text-lg font-semibold text-foreground mb-1">
        {loading ? "جارٍ تحليل ملف BEM..." : "أسقط ملف نتائج BEM هنا"}
      </p>
      <p className="text-sm text-muted-foreground">
        {loading ? "يرجى الانتظار" : "أو انقر للاختيار — يقبل .xlsx و .xls"}
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BEMPage() {
  const [result,    setResult]    = useState<BEMResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const reset = () => { setResult(null); setActiveTab("overview"); };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 space-y-5 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-2xl">🎓</span>
            تحليل نتائج امتحان BEM
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            بريفيه التعليم المتوسط — يحلل ملف Excel ويصنف التلاميذ حسب المعدل
          </p>
        </motion.div>
        {result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="w-4 h-4" /> طباعة
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={reset}>
              <RotateCcw className="w-4 h-4" /> ملف جديد
            </Button>
          </motion.div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!result ? (
          /* ── Upload screen ── */
          <motion.div key="upload" exit={{ opacity: 0, y: -8 }}
            className="max-w-2xl mx-auto space-y-5 print:hidden">
            <UploadZone onResult={setResult} />
            <motion.div className="rounded-xl bg-muted/50 border p-5 space-y-3"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <p className="font-semibold text-sm">المواد المعتمدة في BEM وأوزانها:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { ar: "اللغة العربية",      coef: 5, color: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300" },
                  { ar: "الرياضيات",          coef: 4, color: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300" },
                  { ar: "اللغة الفرنسية",     coef: 3, color: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" },
                  { ar: "التاريخ والجغرافيا", coef: 3, color: "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300" },
                  { ar: "التربية الإسلامية",  coef: 2, color: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300" },
                  { ar: "اللغة الإنجليزية",  coef: 2, color: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300" },
                  { ar: "علوم الطبيعة",       coef: 2, color: "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300" },
                  { ar: "العلوم الفيزيائية",  coef: 2, color: "bg-cyan-100 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300" },
                  { ar: "التربية المدنية",    coef: 1, color: "bg-slate-100 dark:bg-slate-950/40 text-slate-600 dark:text-slate-300" },
                  { ar: "التربية البدنية",    coef: 1, color: "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300" },
                ].map((s, i) => (
                  <motion.div key={i} className={`flex items-center justify-between rounded-lg px-3 py-2 ${s.color}`}
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 + 0.25 }}>
                    <span className="text-xs font-medium">{s.ar}</span>
                    <span className="text-xs font-black ms-2">×{s.coef}</span>
                  </motion.div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                المجموع الكلي للمعاملات: <strong>25</strong> — العتبة: <strong>10/20</strong>
              </p>
            </motion.div>
          </motion.div>
        ) : (
          /* ── Results screen ── */
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

            {/* File badge */}
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="print:hidden">
              <Badge variant="secondary" className="text-xs gap-1.5">
                <FileSpreadsheet className="w-3 h-3" /> {result.fileName}
                <span className="text-muted-foreground ms-1">— {result.detectedSubjects.length} مادة مكتشفة</span>
              </Badge>
            </motion.div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:hidden">
              {[
                { label: "عدد التلاميذ",  value: result.summary.total,                        bg: "bg-blue-50 dark:bg-blue-950/30",    text: "text-blue-700 dark:text-blue-300" },
                { label: "الناجحون",       value: result.summary.passCount,                     bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300" },
                { label: "الراسبون",       value: result.summary.failCount,                     bg: "bg-red-50 dark:bg-red-950/30",      text: "text-red-700 dark:text-red-300" },
                { label: "نسبة النجاح",   value: `${result.summary.passRate}%`,                bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-300" },
                { label: "معدل القسم",    value: result.summary.classAvg?.toFixed(2) ?? "—",  bg: "bg-amber-50 dark:bg-amber-950/30",  text: "text-amber-700 dark:text-amber-300" },
                { label: "ذكور / إناث",  value: `${result.genderStats.males}/${result.genderStats.females}`, bg: "bg-sky-50 dark:bg-sky-950/30", text: "text-sky-700 dark:text-sky-300" },
              ].map((s, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 20, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: i * 0.06 }} whileHover={{ y: -3 }}
                  className={`rounded-xl ${s.bg} border-0 p-4 text-center`}>
                  <p className={`text-2xl font-extrabold ${s.text}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b overflow-x-auto print:hidden">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap -mb-px
                    ${activeTab === tab.id
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  <span>{tab.icon}</span> {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
              <motion.div key={activeTab}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}>

                {activeTab === "overview" && (
                  <div className="space-y-4">
                    {/* Spotlight cards */}
                    {(result.summary.first || result.summary.last) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {result.summary.first && (
                          <SpotlightCard student={result.summary.first} subjects={result.detectedSubjects} variant="first" delay={0.1} />
                        )}
                        {result.summary.last && result.summary.last.name !== result.summary.first?.name && (
                          <SpotlightCard student={result.summary.last} subjects={result.detectedSubjects} variant="last" delay={0.2} />
                        )}
                      </div>
                    )}
                    {/* Mini subject table */}
                    <div className="rounded-xl border overflow-hidden shadow-sm">
                      <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2 text-sm font-semibold">
                        <BarChart3 className="w-4 h-4 text-blue-500" /> ملخص المواد
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40">
                            <tr>
                              {["المادة", "المعامل", "المتوسط", "ناجح", "نسبة النجاح"].map(h => (
                                <th key={h} className="px-3 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {result.subjectStats.map((s, i) => (
                              <tr key={s.key} className={`border-t hover:bg-muted/20 transition-colors ${i % 2 === 1 ? "bg-muted/10" : ""}`}>
                                <td className="px-3 py-2 font-medium">{s.arLabel}</td>
                                <td className="px-3 py-2 text-center"><span className="text-muted-foreground">×{s.coef}</span></td>
                                <td className={`px-3 py-2 text-center font-bold font-mono ${
                                  (s.avg ?? 0) >= 14 ? "text-emerald-600" : (s.avg ?? 0) >= 10 ? "text-blue-600" : "text-red-500"}`}>
                                  {s.avg?.toFixed(2) ?? "—"}
                                </td>
                                <td className="px-3 py-2 text-center text-emerald-600 font-semibold">{s.passCount}/{s.total}</td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${s.passRate >= 70 ? "bg-emerald-500" : s.passRate >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                                        style={{ width: `${s.passRate}%` }} />
                                    </div>
                                    <span className="text-muted-foreground w-10 text-right">{s.passRate.toFixed(0)}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "charts" && <ChartsSection result={result} />}

                {activeTab === "table" && (
                  <div className="rounded-xl border overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/60 sticky top-0">
                          <tr>
                            <th className="px-3 py-3 text-start text-xs font-semibold text-muted-foreground">الرتبة</th>
                            <th className="px-3 py-3 text-start text-xs font-semibold text-muted-foreground">الاسم واللقب</th>
                            <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground">الجنس</th>
                            {result.detectedSubjects.map(s => (
                              <th key={s.key} className="px-2 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">
                                <span className="block">{s.arLabel.split(" ")[0]}</span>
                                <span className="text-[10px] font-normal opacity-60">×{s.coef}</span>
                              </th>
                            ))}
                            <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground">المعدل</th>
                            <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground">النتيجة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.students.map((s, i) => (
                            <motion.tr key={s.name + i}
                              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: Math.min(i * 0.012, 0.5) }}
                              className={`border-t transition-colors hover:bg-muted/30 ${
                                i === 0 ? "bg-amber-50/50 dark:bg-amber-950/10" : i % 2 === 0 ? "" : "bg-muted/10"}`}>
                              <td className="px-3 py-2.5">
                                {s.rank > 0
                                  ? <span className={`font-bold text-sm ${medalColor(s.rank)}`}>{medalEmoji(s.rank) ?? s.rank}</span>
                                  : <span className="text-muted-foreground text-xs">—</span>}
                              </td>
                              <td className="px-3 py-2.5 font-medium min-w-[140px]">{s.name}</td>
                              <td className="px-3 py-2.5 text-center text-base">
                                {s.gender === "male" ? "🔵" : s.gender === "female" ? "🔴" : "⚪"}
                              </td>
                              {result.detectedSubjects.map(subj => {
                                const score = s.scores[subj.key];
                                return (
                                  <td key={subj.key} className={`px-2 py-2.5 text-center font-mono text-sm ${
                                    score === null ? "text-muted-foreground" :
                                    score >= 15 ? "text-emerald-600 font-bold" :
                                    score >= 10 ? "text-foreground" : "text-red-500"}`}>
                                    {score !== null ? score.toFixed(1) : "—"}
                                  </td>
                                );
                              })}
                              <td className={`px-3 py-2.5 text-center font-bold font-mono ${
                                s.average === null ? "text-muted-foreground" :
                                s.average >= 15 ? "text-emerald-600" :
                                s.average >= 10 ? "text-blue-600 dark:text-blue-400" : "text-red-500"}`}>
                                {s.average !== null ? s.average.toFixed(2) : "—"}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {s.passed === null
                                  ? <span className="text-muted-foreground text-xs">—</span>
                                  : s.passed
                                    ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">ناجح ✓</span>
                                    : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">راسب ✗</span>}
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>

            {/* Print-only table */}
            <div className="hidden print:block" dir="rtl">
              <div style={{ textAlign: "center", marginBottom: "12px" }}>
                <h2 style={{ fontSize: "16pt", fontWeight: "bold", margin: "0 0 4px" }}>
                  نتائج امتحان شهادة التعليم المتوسط
                </h2>
                <p style={{ fontSize: "10pt", color: "#555", margin: 0 }}>
                  عدد التلاميذ: {result.summary.total} &nbsp;|&nbsp;
                  الناجحون: {result.summary.passCount} &nbsp;|&nbsp;
                  الراسبون: {result.summary.failCount} &nbsp;|&nbsp;
                  نسبة النجاح: {result.summary.passRate}% &nbsp;|&nbsp;
                  معدل القسم: {result.summary.classAvg?.toFixed(2) ?? "—"} &nbsp;|&nbsp;
                  ذكور: {result.genderStats.males} / إناث: {result.genderStats.females}
                </p>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11pt" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f0f0f0" }}>
                    <th style={{ border: "1px solid #999", padding: "6px 10px", textAlign: "center", width: "50px" }}>الرتبة</th>
                    <th style={{ border: "1px solid #999", padding: "6px 10px", textAlign: "right" }}>الاسم واللقب</th>
                    <th style={{ border: "1px solid #999", padding: "6px 10px", textAlign: "center", width: "50px" }}>الجنس</th>
                    <th style={{ border: "1px solid #999", padding: "6px 10px", textAlign: "center", width: "80px" }}>المعدل</th>
                    <th style={{ border: "1px solid #999", padding: "6px 10px", textAlign: "center", width: "80px" }}>النتيجة</th>
                  </tr>
                </thead>
                <tbody>
                  {result.students.map((s, i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f9f9f9" }}>
                      <td style={{ border: "1px solid #ccc", padding: "4px 10px", textAlign: "center" }}>
                        {s.rank > 0 ? s.rank : "—"}
                      </td>
                      <td style={{ border: "1px solid #ccc", padding: "4px 10px" }}>{s.name}</td>
                      <td style={{ border: "1px solid #ccc", padding: "4px 10px", textAlign: "center" }}>
                        {s.gender === "male" ? "ذكر" : s.gender === "female" ? "أنثى" : "—"}
                      </td>
                      <td style={{ border: "1px solid #ccc", padding: "4px 10px", textAlign: "center", fontWeight: "bold",
                        color: s.average === null ? "#999" : s.average >= 10 ? "#16a34a" : "#dc2626" }}>
                        {s.average !== null ? s.average.toFixed(2) : "—"}
                      </td>
                      <td style={{ border: "1px solid #ccc", padding: "4px 10px", textAlign: "center", fontWeight: "bold",
                        color: s.passed === true ? "#16a34a" : s.passed === false ? "#dc2626" : "#999" }}>
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