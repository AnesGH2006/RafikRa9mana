import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, TrendingUp, Users, UserCheck, UserX, BarChart3,
  Search, ChevronDown, ChevronUp, Award, Star,
  GraduationCap, BookOpen, Atom, Globe, Music2,
  Calculator, Dumbbell, Landmark, Leaf, Scroll,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CountUp } from "@/components/count-up";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BEMStudent {
  num: number;
  reg: number;
  name: string;
  dob: string;
  avg_annual: number;
  avg_bem: number;
  avg_trans: number;
  math: number;
  arabic: number;
  french: number;
  english: number;
  islamic: number;
  civic: number;
  history: number;
  science: number;
  physics: number;
  music: number;
  sport: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SUBJECTS = [
  { key: "arabic",  label: "اللغة العربية",          icon: Scroll,     coef: 5 },
  { key: "math",    label: "الرياضيات",               icon: Calculator, coef: 4 },
  { key: "french",  label: "اللغة الفرنسية",          icon: Globe,      coef: 3 },
  { key: "history", label: "التاريخ والجغرافيا",       icon: Landmark,   coef: 3 },
  { key: "islamic", label: "التربية الإسلامية",        icon: BookOpen,   coef: 2 },
  { key: "science", label: "العلوم الطبيعية",          icon: Leaf,       coef: 2 },
  { key: "physics", label: "الفيزياء والتكنولوجيا",    icon: Atom,       coef: 2 },
  { key: "english", label: "اللغة الإنجليزية",         icon: Globe,      coef: 2 },
  { key: "civic",   label: "التربية المدنية",          icon: Users,      coef: 1 },
  { key: "music",   label: "التربية الموسيقية",        icon: Music2,     coef: 1 },
  { key: "sport",   label: "التربية البدنية",          icon: Dumbbell,   coef: 1 },
] as const;

type SubjectKey = typeof SUBJECTS[number]["key"];

const TABS = [
  { id: "stats",    label: "الإحصاءات",  icon: BarChart3  },
  { id: "toppers",  label: "النجباء",    icon: Trophy     },
  { id: "passed",   label: "الناجحون",   icon: UserCheck  },
  { id: "failed",   label: "الراسبون",   icon: UserX      },
  { id: "subjects", label: "المواد",     icon: BookOpen   },
  { id: "all",      label: "الكل",       icon: Users      },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMention(avg: number) {
  if (avg >= 18) return { label: "ممتاز رفيع",  cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" };
  if (avg >= 16) return { label: "ممتاز",       cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" };
  if (avg >= 14) return { label: "جيد جداً",    cls: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" };
  if (avg >= 12) return { label: "جيد",         cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" };
  if (avg >= 9)  return { label: "مقبول",       cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
  return              { label: "راسب",          cls: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300" };
}

function gradeColor(v: number) {
  if (v >= 16) return "text-emerald-600 dark:text-emerald-400";
  if (v >= 14) return "text-sky-600 dark:text-sky-400";
  if (v >= 12) return "text-blue-600 dark:text-blue-400";
  if (v >= 9)  return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

const MEDALS = ["🥇", "🥈", "🥉"];

// ── Animation variants ────────────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

const cardVariants = {
  initial: { opacity: 0, y: 20, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: "easeOut" as const } },
};

const rowVariants = {
  initial: { opacity: 0, x: -12 },
  animate: (i: number) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.03, duration: 0.3, ease: "easeOut" },
  }),
};

// ── Sub-components ────────────────────────────────────────────────────────────

/** Single stat card */
function StatCard({
  label, value, sub, colorBg, colorText, colorLight, icon: Icon,
}: {
  label: string; value: number | string; sub?: string;
  colorBg: string; colorText: string; colorLight: string; icon: React.ElementType;
}) {
  return (
    <motion.div variants={cardVariants} whileHover={{ y: -3, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}>
      <Card className={`border-0 shadow-sm ${colorLight} overflow-hidden relative`}>
        <div className={`absolute inset-0 opacity-5 ${colorBg}`} />
        <CardContent className="pt-4 pb-3 relative">
          <div className="flex items-start gap-3">
            <motion.div
              className={`w-10 h-10 rounded-xl ${colorBg} flex items-center justify-center shrink-0`}
              initial={{ scale: 0.5, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}>
              <Icon className={`w-5 h-5 ${colorText}`} />
            </motion.div>
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-0.5">{label}</p>
              <p className={`text-2xl font-extrabold leading-none tracking-tight ${colorText}`}>
                {typeof value === "number" ? <CountUp to={value} /> : value}
              </p>
              {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** Animated progress bar row */
function ProgressRow({
  leftLabel, leftVal, rightLabel, rightVal, total, leftColor, rightColor,
}: {
  leftLabel: string; leftVal: number;
  rightLabel: string; rightVal: number;
  total: number; leftColor: string; rightColor: string;
}) {
  const leftPct  = total > 0 ? (leftVal  / total) * 100 : 0;
  const rightPct = total > 0 ? (rightVal / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className={`font-semibold ${leftColor}`}>{leftLabel} — <CountUp to={leftVal} /> ({leftPct.toFixed(1)}%)</span>
        <span className={`font-semibold ${rightColor}`}>{rightLabel} — <CountUp to={rightVal} /> ({rightPct.toFixed(1)}%)</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden flex gap-0.5">
        <motion.div className={`h-full rounded-full ${leftColor.replace("text-", "bg-")}`}
          initial={{ width: 0 }} animate={{ width: `${leftPct}%` }}
          transition={{ duration: 1.1, ease: "easeOut", delay: 0.2 }} />
        <motion.div className={`h-full rounded-full ${rightColor.replace("text-", "bg-")}`}
          initial={{ width: 0 }} animate={{ width: `${rightPct}%` }}
          transition={{ duration: 1.1, ease: "easeOut", delay: 0.3 }} />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props { students: BEMStudent[] }

export default function BEMAnalyzer({ students }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("stats");
  const [search, setSearch] = useState("");
  const [showDistrib, setShowDistrib] = useState(false);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total   = students.length;
    const passed  = students.filter(s => s.avg_bem >= 9);
    const failed  = students.filter(s => s.avg_bem < 9);
    const top14   = students.filter(s => s.avg_bem >= 14);
    const top16   = students.filter(s => s.avg_bem >= 16);
    const avgs    = students.map(s => s.avg_bem);
    const avgSum  = avgs.reduce((a, b) => a + b, 0);
    const mean    = total > 0 ? avgSum / total : 0;
    const max     = total > 0 ? Math.max(...avgs) : 0;
    const min     = total > 0 ? Math.min(...avgs) : 0;
    const maxStudent = students.find(s => s.avg_bem === max);
    const passRate   = total > 0 ? (passed.length / total) * 100 : 0;

    const distribRanges = [
      { label: "18–20 ممتاز رفيع", min: 18, max: 21, color: "bg-violet-500" },
      { label: "16–18 ممتاز",      min: 16, max: 18, color: "bg-blue-500"   },
      { label: "14–16 جيد جداً",   min: 14, max: 16, color: "bg-cyan-500"   },
      { label: "12–14 جيد",        min: 12, max: 14, color: "bg-teal-500"   },
      { label: "9–12 مقبول",       min: 9,  max: 12, color: "bg-amber-500"  },
      { label: "أقل من 9 راسب",    min: 0,  max: 9,  color: "bg-red-500"    },
    ].map(r => ({
      ...r,
      count: students.filter(s => s.avg_bem >= r.min && s.avg_bem < r.max).length,
    }));

    const subjectStats = SUBJECTS.map(sub => {
      const vals = students.map(s => s[sub.key as SubjectKey] as number).filter(v => v > 0);
      const avg  = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      const pass = vals.filter(v => v >= 9).length;
      return { ...sub, avg, pass, total: vals.length };
    }).sort((a, b) => b.avg - a.avg);

    return { total, passed, failed, top14, top16, mean, max, min, maxStudent, passRate, distribRanges, subjectStats };
  }, [students]);

  // ── Filtered students ──────────────────────────────────────────────────────
  const filteredAll = useMemo(() => {
    const q = search.toLowerCase();
    return [...students]
      .sort((a, b) => b.avg_bem - a.avg_bem)
      .filter(s => !q || s.name.toLowerCase().includes(q));
  }, [students, search]);

  const filteredPassed = useMemo(() =>
    filteredAll.filter(s => s.avg_bem >= 9), [filteredAll]);

  const filteredFailed = useMemo(() =>
    filteredAll.filter(s => s.avg_bem < 9), [filteredAll]);

  // ── Render tabs ────────────────────────────────────────────────────────────
  const renderStats = () => (
    <div className="space-y-5">
      {/* KPI grid */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3"
        variants={{ animate: { transition: { staggerChildren: 0.07 } } }}
        initial="initial" animate="animate">
        <StatCard label="إجمالي المترشحين" value={stats.total}
          icon={Users} colorBg="bg-blue-500" colorText="text-blue-600 dark:text-blue-400"
          colorLight="bg-blue-50 dark:bg-blue-950/30" />
        <StatCard label="الناجحون" value={stats.passed.length}
          sub={`${stats.passRate.toFixed(1)}% نسبة النجاح`}
          icon={UserCheck} colorBg="bg-emerald-500" colorText="text-emerald-600 dark:text-emerald-400"
          colorLight="bg-emerald-50 dark:bg-emerald-950/30" />
        <StatCard label="الراسبون" value={stats.failed.length}
          icon={UserX} colorBg="bg-red-500" colorText="text-red-600 dark:text-red-400"
          colorLight="bg-red-50 dark:bg-red-950/30" />
        <StatCard label="المتفوقون ≥14" value={stats.top14.length}
          icon={Star} colorBg="bg-amber-500" colorText="text-amber-600 dark:text-amber-400"
          colorLight="bg-amber-50 dark:bg-amber-950/30" />
        <StatCard label="المتوسط العام" value={stats.mean.toFixed(2)}
          icon={TrendingUp} colorBg="bg-violet-500" colorText="text-violet-600 dark:text-violet-400"
          colorLight="bg-violet-50 dark:bg-violet-950/30" />
        <StatCard label="أعلى معدل" value={stats.max.toFixed(2)}
          sub={stats.maxStudent?.name}
          icon={Trophy} colorBg="bg-sky-500" colorText="text-sky-600 dark:text-sky-400"
          colorLight="bg-sky-50 dark:bg-sky-950/30" />
      </motion.div>

      {/* Pass/fail bar */}
      <motion.div variants={cardVariants} initial="initial" animate="animate">
        <Card className="shadow-sm">
          <CardContent className="pt-5 pb-4 space-y-3">
            <ProgressRow
              leftLabel="ناجح" leftVal={stats.passed.length}
              rightLabel="راسب" rightVal={stats.failed.length}
              total={stats.total}
              leftColor="text-emerald-600" rightColor="text-red-500" />
          </CardContent>
        </Card>
      </motion.div>

      {/* Distribution */}
      <motion.div variants={cardVariants} initial="initial" animate="animate">
        <Card className="shadow-sm">
          <CardHeader className="pb-0">
            <button
              className="w-full flex items-center gap-2 text-base font-semibold text-foreground"
              onClick={() => setShowDistrib(v => !v)}>
              <Award className="w-5 h-5 text-amber-500" />
              توزيع التقديرات
              <motion.div className="ms-auto" animate={{ rotate: showDistrib ? 0 : -90 }}
                transition={{ duration: 0.2 }}>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </button>
          </CardHeader>
          <AnimatePresence initial={false}>
            {showDistrib && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden">
                <CardContent className="pt-3">
                  <div className="space-y-2.5">
                    {stats.distribRanges.map(r => {
                      const pct = stats.total > 0 ? (r.count / stats.total) * 100 : 0;
                      return (
                        <div key={r.label} className="flex items-center gap-3 text-sm">
                          <span className="w-36 text-right text-muted-foreground shrink-0 text-xs">{r.label}</span>
                          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                            <motion.div className={`h-full rounded-full ${r.color}`}
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }} />
                          </div>
                          <span className="w-16 text-right font-semibold text-xs">
                            {r.count} ({pct.toFixed(1)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* Subject averages */}
      <motion.div variants={cardVariants} initial="initial" animate="animate">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" /> متوسط كل مادة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.subjectStats.map((s, i) => {
                const pct = (s.avg / 20) * 100;
                const barColor = s.avg >= 14 ? "bg-emerald-500" : s.avg >= 9 ? "bg-blue-500" : "bg-red-400";
                return (
                  <motion.div key={s.key} className="flex items-center gap-3 text-sm"
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}>
                    <span className="w-40 text-right text-muted-foreground text-xs shrink-0">{s.label}</span>
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <motion.div className={`h-full rounded-full ${barColor}`}
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.04 }} />
                    </div>
                    <span className={`w-12 text-right font-bold text-xs font-mono ${gradeColor(s.avg)}`}>
                      {s.avg.toFixed(2)}
                    </span>
                    <span className="w-16 text-right text-muted-foreground text-xs">
                      {Math.round(s.pass / s.total * 100)}% ناجح
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );

  const renderToppers = () => {
    const list = [...students].filter(s => s.avg_bem >= 14).sort((a, b) => b.avg_bem - a.avg_bem);
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            النجباء — {list.length} تلميذ (معدل ≥ 14)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs uppercase">
                  <th className="pb-2 pt-3 px-4 text-center w-10">#</th>
                  <th className="pb-2 pt-3 px-4 text-start">الاسم واللقب</th>
                  <th className="pb-2 pt-3 px-4 text-center">رقم التسجيل</th>
                  <th className="pb-2 pt-3 px-4 text-center">التقدير</th>
                  <th className="pb-2 pt-3 px-4 text-center">معدل البيام</th>
                  <th className="pb-2 pt-3 px-4 text-center">المعدل السنوي</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s, i) => {
                  const m = getMention(s.avg_bem);
                  return (
                    <motion.tr key={s.num} custom={i} variants={rowVariants} initial="initial" animate="animate"
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-center">
                        {i < 3
                          ? <span className="text-lg">{MEDALS[i]}</span>
                          : <span className="text-muted-foreground text-xs font-mono">{i + 1}</span>}
                      </td>
                      <td className="py-3 px-4 font-medium">{s.name}</td>
                      <td className="py-3 px-4 text-center text-muted-foreground font-mono text-xs">{s.reg}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m.cls}`}>{m.label}</span>
                      </td>
                      <td className={`py-3 px-4 text-center font-extrabold text-base font-mono ${gradeColor(s.avg_bem)}`}>
                        {s.avg_bem.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center text-muted-foreground text-xs font-mono">
                        {s.avg_annual.toFixed(2)}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderPassed = () => (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-500" />
            الناجحون — {filteredPassed.length} تلميذ
          </CardTitle>
          <div className="relative">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم..." className="h-8 text-xs pe-8 w-44" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs uppercase">
                <th className="pb-2 pt-3 px-4 text-center w-10">#</th>
                <th className="pb-2 pt-3 px-4 text-start">الاسم واللقب</th>
                <th className="pb-2 pt-3 px-4 text-center">ت. التسجيل</th>
                <th className="pb-2 pt-3 px-4 text-center">التقدير</th>
                <th className="pb-2 pt-3 px-4 text-center">معدل البيام</th>
                <th className="pb-2 pt-3 px-4 text-center">م. السنوي</th>
              </tr>
            </thead>
            <tbody>
              {filteredPassed.map((s, i) => {
                const m = getMention(s.avg_bem);
                return (
                  <motion.tr key={s.num} custom={i} variants={rowVariants} initial="initial" animate="animate"
                    className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 1 ? "bg-muted/10" : ""}`}>
                    <td className="py-2.5 px-4 text-center text-muted-foreground text-xs font-mono">{i + 1}</td>
                    <td className="py-2.5 px-4 font-medium">{s.name}</td>
                    <td className="py-2.5 px-4 text-center text-muted-foreground font-mono text-xs">{s.reg}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m.cls}`}>{m.label}</span>
                    </td>
                    <td className={`py-2.5 px-4 text-center font-bold font-mono ${gradeColor(s.avg_bem)}`}>
                      {s.avg_bem.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-center text-muted-foreground text-xs font-mono">
                      {s.avg_annual.toFixed(2)}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  const renderFailed = () => (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-red-500">
          <UserX className="w-5 h-5" />
          الراسبون — {filteredFailed.length} تلميذ
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {filteredFailed.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, repeat: Infinity }}>
              <UserCheck className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-60" />
            </motion.div>
            <p className="text-sm">🎉 لا يوجد راسبون — جميعهم ناجحون!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs uppercase">
                  <th className="pb-2 pt-3 px-4 text-start">الاسم واللقب</th>
                  <th className="pb-2 pt-3 px-4 text-center">ت. التسجيل</th>
                  <th className="pb-2 pt-3 px-4 text-center">معدل البيام</th>
                  <th className="pb-2 pt-3 px-4 text-center">الحالة</th>
                  <th className="pb-2 pt-3 px-4 text-center">ينقصه</th>
                </tr>
              </thead>
              <tbody>
                {filteredFailed.map((s, i) => (
                  <motion.tr key={s.num} custom={i} variants={rowVariants} initial="initial" animate="animate"
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-4 font-medium">{s.name}</td>
                    <td className="py-2.5 px-4 text-center text-muted-foreground font-mono text-xs">{s.reg}</td>
                    <td className="py-2.5 px-4 text-center font-bold text-red-500 font-mono">
                      {s.avg_bem.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">
                        راسب
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center text-muted-foreground text-xs">
                      {(9 - s.avg_bem).toFixed(2)} نقطة
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderSubjects = () => (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-blue-500" /> تفصيل المواد
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs uppercase">
                <th className="pb-2 pt-3 px-4 text-start">المادة</th>
                <th className="pb-2 pt-3 px-4 text-center">المعامل</th>
                <th className="pb-2 pt-3 px-4 text-center">المتوسط</th>
                <th className="pb-2 pt-3 px-4 text-center">ناجح ≥9</th>
                <th className="pb-2 pt-3 px-4 text-center">نسبة النجاح</th>
              </tr>
            </thead>
            <tbody>
              {stats.subjectStats.map((s, i) => {
                const passRate = s.total > 0 ? (s.pass / s.total) * 100 : 0;
                const SubIcon  = s.icon;
                return (
                  <motion.tr key={s.key} custom={i} variants={rowVariants} initial="initial" animate="animate"
                    className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 1 ? "bg-muted/10" : ""}`}>
                    <td className="py-2.5 px-4">
                      <span className="flex items-center gap-2">
                        <SubIcon className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="font-medium">{s.label}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <Badge variant="outline" className="font-mono text-xs">{s.coef}</Badge>
                    </td>
                    <td className={`py-2.5 px-4 text-center font-bold font-mono ${gradeColor(s.avg)}`}>
                      {s.avg.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-center text-emerald-600 font-semibold">{s.pass}</td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                          <motion.div className={`h-full rounded-full ${passRate >= 50 ? "bg-emerald-500" : "bg-red-400"}`}
                            initial={{ width: 0 }} animate={{ width: `${passRate}%` }}
                            transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.04 }} />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">{passRate.toFixed(1)}%</span>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  const renderAll = () => (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            كشف النتائج الكامل — {filteredAll.length} تلميذ
          </CardTitle>
          <div className="relative">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم..." className="h-8 text-xs pe-8 w-44" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground uppercase">
                <th className="pb-2 pt-3 px-3 text-center w-8">#</th>
                <th className="pb-2 pt-3 px-3 text-start">الاسم</th>
                <th className="pb-2 pt-3 px-3 text-center">رقم ت</th>
                <th className="pb-2 pt-3 px-3 text-center">م. البيام</th>
                <th className="pb-2 pt-3 px-3 text-center">م. السنوي</th>
                <th className="pb-2 pt-3 px-3 text-center">التقدير</th>
                <th className="pb-2 pt-3 px-3 text-center">عرب</th>
                <th className="pb-2 pt-3 px-3 text-center">رياض</th>
                <th className="pb-2 pt-3 px-3 text-center">فرنس</th>
                <th className="pb-2 pt-3 px-3 text-center">إنجل</th>
                <th className="pb-2 pt-3 px-3 text-center">علوم</th>
                <th className="pb-2 pt-3 px-3 text-center">فيزياء</th>
              </tr>
            </thead>
            <tbody>
              {filteredAll.map((s, i) => {
                const m = getMention(s.avg_bem);
                return (
                  <motion.tr key={s.num} custom={i} variants={rowVariants} initial="initial" animate="animate"
                    className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 1 ? "bg-muted/10" : ""}`}>
                    <td className="py-2 px-3 text-center text-muted-foreground font-mono">{i + 1}</td>
                    <td className="py-2 px-3 font-medium whitespace-nowrap max-w-[160px] truncate">{s.name}</td>
                    <td className="py-2 px-3 text-center text-muted-foreground font-mono">{s.reg}</td>
                    <td className={`py-2 px-3 text-center font-bold font-mono ${gradeColor(s.avg_bem)}`}>
                      {s.avg_bem.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-center text-muted-foreground font-mono">
                      {s.avg_annual.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${m.cls}`}>{m.label}</span>
                    </td>
                    {(["arabic","math","french","english","science","physics"] as const).map(k => (
                      <td key={k} className={`py-2 px-3 text-center font-mono ${gradeColor(s[k])}`}>
                        {s[k] > 0 ? s[k] : "—"}
                      </td>
                    ))}
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  const tabContent: Record<TabId, () => React.ReactNode> = {
    stats:    renderStats,
    toppers:  renderToppers,
    passed:   renderPassed,
    failed:   renderFailed,
    subjects: renderSubjects,
    all:      renderAll,
  };

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 space-y-5 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-blue-600" />
            محلل نتائج البيام
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats.total} مترشح &nbsp;·&nbsp; السنة الدراسية 2024–2025
          </p>
        </motion.div>

        {/* Quick summary badges */}
        <motion.div className="flex items-center gap-2 flex-wrap justify-end"
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold">
            ✅ {stats.passed.length} ناجح
          </Badge>
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-bold">
            ⭐ {stats.top14.length} متفوق
          </Badge>
          {stats.failed.length > 0 && (
            <Badge className="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 font-bold">
              ❌ {stats.failed.length} راسب
            </Badge>
          )}
        </motion.div>
      </div>

      {/* Tabs */}
      <motion.div className="flex gap-1 border-b overflow-x-auto pb-0"
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap shrink-0 -mb-px
                ${active
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                }`}>
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </motion.div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}>
          {tabContent[activeTab]()}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}