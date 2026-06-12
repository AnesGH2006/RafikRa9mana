import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Trophy, TrendingDown, Upload, RotateCcw, Printer } from "lucide-react";

const BASE = import.meta.env.BASE_URL;

interface BEMSubjectDef { key: string; arLabel: string; coef: number; }
interface BEMStudent {
  name: string;
  scores: Record<string, number | null>;
  average: number | null;
  passed: boolean | null;
  rank: number;
}
interface BEMSummary {
  total: number;
  withAvg: number;
  passCount: number;
  failCount: number;
  passRate: number;
  classAvg: number | null;
  first: BEMStudent | null;
  last: BEMStudent | null;
}
interface BEMResult {
  students: BEMStudent[];
  summary: BEMSummary;
  detectedSubjects: BEMSubjectDef[];
  fileName: string;
}

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  exit:    { opacity: 0, y: -8,  transition: { duration: 0.2 } },
};

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

// ── Spotlight card (first / last) ─────────────────────────────────────────────
function SpotlightCard({
  student, subjects, variant, delay,
}: {
  student: BEMStudent; subjects: BEMSubjectDef[]; variant: "first" | "last"; delay: number;
}) {
  const isFirst = variant === "first";
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.45, ease: "easeOut" as const }}
      whileHover={{ y: -4 }}
      className={`rounded-2xl border p-5 relative overflow-hidden shadow-md ${
        isFirst
          ? "bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800"
          : "bg-gradient-to-br from-slate-50 to-zinc-50 dark:from-slate-900/40 dark:to-zinc-900/30 border-slate-200 dark:border-slate-700"
      }`}
    >
      {/* Background accent */}
      <div className={`absolute -top-6 -end-6 w-24 h-24 rounded-full opacity-10 ${isFirst ? "bg-amber-400" : "bg-slate-400"}`} />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-md ${
              isFirst ? "bg-amber-400 shadow-amber-200" : "bg-slate-300 dark:bg-slate-700 shadow-slate-200 dark:shadow-slate-800"
            }`}
            animate={isFirst ? { scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          >
            {isFirst ? "🥇" : "🔻"}
          </motion.div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${isFirst ? "text-amber-600 dark:text-amber-400" : "text-slate-500"}`}>
              {isFirst ? "المتفوق الأول" : "الأخير"}
            </p>
            <p className="font-bold text-foreground leading-tight">{student.name}</p>
          </div>
          <div className="ms-auto text-end">
            <p className={`text-3xl font-extrabold ${isFirst ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>
              {student.average?.toFixed(2) ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">/20</p>
          </div>
        </div>

        {/* Subject scores mini grid */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
          {subjects.map((s, i) => {
            const score = student.scores[s.key];
            return (
              <motion.div
                key={s.key}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: delay + i * 0.04 }}
                className={`rounded-lg p-1.5 text-center ${
                  score === null ? "bg-muted/40" :
                  score >= 15 ? "bg-emerald-100 dark:bg-emerald-950/40" :
                  score >= 10 ? "bg-blue-50 dark:bg-blue-950/30" :
                  "bg-red-50 dark:bg-red-950/30"
                }`}
              >
                <p className={`text-xs font-bold ${
                  score === null ? "text-muted-foreground" :
                  score >= 15 ? "text-emerald-700 dark:text-emerald-300" :
                  score >= 10 ? "text-blue-700 dark:text-blue-300" :
                  "text-red-600 dark:text-red-400"
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

        {/* Pass badge */}
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
      const res = await fetch(`${BASE}api/bem/analyze`, { method: "POST", body: form, credentials: "include" });
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
      onClick={() => fileRef.current?.click()}
    >
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
      <p className="text-sm text-muted-foreground">{loading ? "يرجى الانتظار" : "أو انقر للاختيار — يقبل .xlsx و .xls"}</p>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BEMPage() {
  const [result, setResult] = useState<BEMResult | null>(null);

  const reset = () => setResult(null);

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
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
          <div className="flex gap-2">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
                <Printer className="w-4 h-4" /> طباعة
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={reset}>
                <RotateCcw className="w-4 h-4" /> ملف جديد
              </Button>
            </motion.div>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div key="upload" exit={{ opacity: 0, y: -8 }} className="max-w-2xl mx-auto space-y-5">
            <UploadZone onResult={setResult} />

            {/* Info box */}
            <motion.div className="rounded-xl bg-muted/50 border p-5 space-y-3"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <p className="font-semibold text-sm">المواد المعتمدة في BEM وأوزانها:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { ar: "اللغة العربية",     coef: 5, color: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300" },
                  { ar: "الرياضيات",         coef: 4, color: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300" },
                  { ar: "اللغة الفرنسية",    coef: 3, color: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" },
                  { ar: "علوم الطبيعة",      coef: 2, color: "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300" },
                  { ar: "العلوم الفيزيائية", coef: 2, color: "bg-cyan-100 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300" },
                  { ar: "التاريخ والجغرافيا",coef: 2, color: "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300" },
                  { ar: "التربية الإسلامية", coef: 2, color: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300" },
                  { ar: "اللغة الإنجليزية", coef: 2, color: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300" },
                  { ar: "التربية المدنية",   coef: 1, color: "bg-slate-100 dark:bg-slate-950/40 text-slate-600 dark:text-slate-300" },
                  { ar: "التربية البدنية",   coef: 1, color: "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300" },
                ].map((s, i) => (
                  <motion.div key={i} className={`flex items-center justify-between rounded-lg px-3 py-2 ${s.color}`}
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 + 0.25 }}>
                    <span className="text-xs font-medium">{s.ar}</span>
                    <span className="text-xs font-black ms-2">×{s.coef}</span>
                  </motion.div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                المجموع الكلي للمعاملات: <strong>24</strong> — العتبة: <strong>10/20</strong>
              </p>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

            {/* File name badge */}
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
              <Badge variant="secondary" className="text-xs gap-1.5">
                <FileSpreadsheet className="w-3 h-3" /> {result.fileName}
                <span className="text-muted-foreground ms-1">— {result.detectedSubjects.length} مادة مكتشفة</span>
              </Badge>
            </motion.div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { label: "عدد التلاميذ",  value: result.summary.total,    color: "bg-blue-500",    light: "bg-blue-50 dark:bg-blue-950/30" },
                { label: "الناجحون",       value: result.summary.passCount, color: "bg-emerald-500", light: "bg-emerald-50 dark:bg-emerald-950/30" },
                { label: "الراسبون",       value: result.summary.failCount, color: "bg-red-500",     light: "bg-red-50 dark:bg-red-950/30" },
                { label: "نسبة النجاح",   value: `${result.summary.passRate}%`, color: "bg-violet-500", light: "bg-violet-50 dark:bg-violet-950/30" },
                { label: "معدل القسم",    value: result.summary.classAvg?.toFixed(2) ?? "—", color: "bg-amber-500", light: "bg-amber-50 dark:bg-amber-950/30" },
              ].map((s, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 20, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: i * 0.07 }} whileHover={{ y: -3 }}
                  className={`rounded-xl ${s.light} border-0 p-4 text-center`}
                >
                  <p className="text-2xl font-extrabold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Spotlight: first & last */}
            {(result.summary.first || result.summary.last) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.summary.first && (
                  <SpotlightCard student={result.summary.first} subjects={result.detectedSubjects} variant="first" delay={0.3} />
                )}
                {result.summary.last && result.summary.last !== result.summary.first && (
                  <SpotlightCard student={result.summary.last} subjects={result.detectedSubjects} variant="last" delay={0.4} />
                )}
              </div>
            )}

            {/* Full ranked table */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
              className="rounded-xl border overflow-hidden shadow-sm print:border-0 print:shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 sticky top-0">
                    <tr>
                      <th className="px-3 py-3 text-start text-xs font-semibold text-muted-foreground whitespace-nowrap">الرتبة</th>
                      <th className="px-3 py-3 text-start text-xs font-semibold text-muted-foreground whitespace-nowrap">الاسم واللقب</th>
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
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.015, 0.5) }}
                        className={`border-t transition-colors hover:bg-muted/30 ${
                          i === 0 ? "bg-amber-50/50 dark:bg-amber-950/10" :
                          i % 2 === 0 ? "" : "bg-muted/10"
                        }`}
                      >
                        {/* Rank */}
                        <td className="px-3 py-2.5">
                          {s.rank > 0 ? (
                            <span className={`font-bold text-sm ${medalColor(s.rank)}`}>
                              {medalEmoji(s.rank) ?? s.rank}
                            </span>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        {/* Name */}
                        <td className="px-3 py-2.5 font-medium min-w-[140px]">{s.name}</td>
                        {/* Subject scores */}
                        {result.detectedSubjects.map(subj => {
                          const score = s.scores[subj.key];
                          return (
                            <td key={subj.key} className={`px-2 py-2.5 text-center font-mono text-sm ${
                              score === null ? "text-muted-foreground" :
                              score >= 15 ? "text-emerald-600 font-bold" :
                              score >= 10 ? "text-foreground" :
                              "text-red-500"
                            }`}>
                              {score !== null ? score.toFixed(1) : "—"}
                            </td>
                          );
                        })}
                        {/* Average */}
                        <td className={`px-3 py-2.5 text-center font-bold font-mono ${
                          s.average === null ? "text-muted-foreground" :
                          s.average >= 15 ? "text-emerald-600" :
                          s.average >= 10 ? "text-blue-600 dark:text-blue-400" :
                          "text-red-500"
                        }`}>
                          {s.average !== null ? s.average.toFixed(2) : "—"}
                        </td>
                        {/* Result badge */}
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
