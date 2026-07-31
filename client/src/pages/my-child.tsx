/**
 * My Child Page — Parent role only
 * Shows the linked student's full academic profile including grades, averages, and absences.
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/language-provider";
import { useAuth } from "@/hooks/use-auth";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap, BookOpen, Calendar, TrendingUp,
  User, Award, AlertCircle, LogOut,
} from "lucide-react";
import { getSubjectsForLevel, calcWeightedAvg } from "@shared/subjects";
import type { Niveau } from "@shared/types";

const BASE = import.meta.env.BASE_URL;

interface StudentData {
  student: {
    id: string;
    nomPrenom: string;
    niveau: string;
    classe: string;
    annee: string;
    sexe: string;
  };
  grades: { id: string; studentId: string; annee: string; trimestre: number; subject: string; score: number }[];
  absences: { id: string; studentId: string; annee: string; trimestre: number; justifiedHours: number; unjustifiedHours: number }[];
}

const TRIMESTRE_LABELS: Record<number, string> = {
  1: "الفصل الأول",
  2: "الفصل الثاني",
  3: "الفصل الثالث",
};

function calcTrimAvg(grades: StudentData["grades"], trimestre: number, niveau: string) {
  const subs = getSubjectsForLevel(niveau as Niveau);
  const scores: Record<string, number> = {};
  for (const g of grades) {
    if (g.trimestre === trimestre) scores[g.subject] = g.score;
  }
  return calcWeightedAvg(scores, subs);
}

function getGradeColor(score: number): string {
  if (score >= 16) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 10) return "text-blue-600 dark:text-blue-400";
  if (score >= 7)  return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function MyChildPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [data, setData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [annee, setAnnee] = useState("2025-2026");

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}api/my-child?annee=${encodeURIComponent(annee)}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [annee]);

  const memberCtx = user?.memberContext;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 text-muted-foreground gap-3">
        <GraduationCap className="w-10 h-10 animate-pulse opacity-40" />
        <span className="text-sm">جارٍ تحميل البيانات…</span>
      </div>
    );
  }

  if (error || !data?.student) {
    return (
      <motion.div variants={pageVariants} initial="initial" animate="animate"
        className="flex flex-col items-center justify-center min-h-64 gap-4 text-muted-foreground"
      >
        <AlertCircle className="w-12 h-12 text-amber-500 opacity-70" />
        <p className="text-sm text-center">
          {memberCtx?.linkedStudentId ? "حدث خطأ أثناء تحميل البيانات" : "لا يوجد تلميذ مرتبط بحسابك. تواصل مع مدير المدرسة."}
        </p>
      </motion.div>
    );
  }

  const { student, grades, absences } = data;
  const subs = getSubjectsForLevel(student.niveau as Niveau);

  const t1Avg = calcTrimAvg(grades, 1, student.niveau);
  const t2Avg = calcTrimAvg(grades, 2, student.niveau);
  const t3Avg = calcTrimAvg(grades, 3, student.niveau);
  const annualAvg = [t1Avg, t2Avg, t3Avg].filter(v => v !== null).length > 0
    ? ([t1Avg, t2Avg, t3Avg].filter(v => v !== null) as number[]).reduce((a, b) => a + b, 0)
      / [t1Avg, t2Avg, t3Avg].filter(v => v !== null).length
    : null;

  const totalJustified   = absences.reduce((s, a) => s + (a.justifiedHours ?? 0), 0);
  const totalUnjustified = absences.reduce((s, a) => s + (a.unjustifiedHours ?? 0), 0);

  const isPassed = annualAvg !== null ? annualAvg >= 10 : null;

  const [leaving, setLeaving] = useState(false);

  async function leaveParentMode() {
    setLeaving(true);
    try {
      await fetch(`${BASE}api/members/self`, { method: "DELETE", credentials: "include" });
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate"
      className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto"
    >
      {/* Dev escape — removes this account from parent membership */}
      <div className="flex justify-end">
        <button
          onClick={leaveParentMode}
          disabled={leaving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-dashed border-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-50"
        >
          <LogOut className="w-3.5 h-3.5" />
          {leaving ? "جارٍ الخروج…" : "خروج من وضع الوالدين ← الموقع الكامل"}
        </button>
      </div>

      {/* Student identity card */}
      <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20 border-violet-200 dark:border-violet-800/40 shadow-md">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
              <User className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{student.nomPrenom}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="secondary" className="text-xs">{student.niveau}</Badge>
                <Badge variant="outline" className="text-xs">قسم {student.classe}</Badge>
                <Badge variant="outline" className="text-xs">{student.annee}</Badge>
              </div>
            </div>
          </div>

          {/* Annual avg chip */}
          {annualAvg !== null && (
            <div className={`mt-4 flex items-center gap-2 text-sm font-semibold ${isPassed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              <Award className="w-4 h-4" />
              المعدل السنوي: {annualAvg.toFixed(2)} / 20
              {isPassed !== null && (
                <Badge className={`text-xs mr-1 ${isPassed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"}`}>
                  {isPassed ? "ناجح" : "راسب"}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trimester averages */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { tr: 1, avg: t1Avg, label: "ف1" },
          { tr: 2, avg: t2Avg, label: "ف2" },
          { tr: 3, avg: t3Avg, label: "ف3" },
        ].map(({ tr, avg, label }) => (
          <Card key={tr} className="text-center shadow-sm">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`text-2xl font-bold ${avg !== null ? getGradeColor(avg) : "text-muted-foreground"}`}>
                {avg !== null ? avg.toFixed(2) : "—"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grades by trimester */}
      {[1, 2, 3].map(tr => {
        const trimGrades = grades.filter(g => g.trimestre === tr);
        if (trimGrades.length === 0) return null;
        const avg = calcTrimAvg(grades, tr, student.niveau);
        return (
          <Card key={tr} className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-violet-500" />
                  {TRIMESTRE_LABELS[tr]}
                </span>
                {avg !== null && (
                  <span className={`font-bold text-base ${getGradeColor(avg)}`}>
                    {avg.toFixed(2)}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {subs.map(sub => {
                  const g = trimGrades.find(gr => gr.subject === sub.key);
                  const score = g?.score;
                  return (
                    <div key={sub.key} className="flex items-center justify-between text-sm py-0.5 border-b last:border-0 border-border/50">
                      <span className="text-muted-foreground truncate ml-2">
                        {sub.arLabel}
                        <span className="text-xs opacity-60 mr-1">(×{sub.coef})</span>
                      </span>
                      <span className={`font-semibold tabular-nums ${score !== undefined ? getGradeColor(score) : "text-muted-foreground"}`}>
                        {score !== undefined ? score.toFixed(2) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Absences */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-500" />
            الغيابات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">مبررة</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totalJustified}</p>
              <p className="text-xs text-muted-foreground">ساعة</p>
            </div>
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">غير مبررة</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{totalUnjustified}</p>
              <p className="text-xs text-muted-foreground">ساعة</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
