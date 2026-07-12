import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, GraduationCap, Trophy } from "lucide-react";

const BASE = import.meta.env.BASE_URL;
const CURRENT_YEAR = "2025-2026";

interface ResultRow {
  student: { id: string; firstName: string; lastName: string; niveau: string; classe: string; };
  annualAvg: number | null;
  passed: boolean;
  rank: number | null;
}

function avgColor(v: number) {
  if (v >= 16) return "text-emerald-600 dark:text-emerald-400";
  if (v >= 14) return "text-blue-600 dark:text-blue-400";
  if (v >= 12) return "text-violet-600 dark:text-violet-400";
  return "text-orange-600 dark:text-orange-400";
}
function orientTrack(avg: number) {
  if (avg >= 14) return { label: "جذع مشترك علوم", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" };
  return { label: "جذع مشترك آداب وفلسفة", color: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" };
}

export default function OrientationResultsPage() {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/results?annee=${CURRENT_YEAR}&niveau=4AM`, { credentials: "include" });
      if (res.ok) setResults(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const eligible = results.filter(r => r.passed && r.annualAvg !== null)
    .sort((a, b) => (b.annualAvg ?? 0) - (a.annualAvg ?? 0));

  const trackCounts = eligible.reduce((acc, r) => {
    const track = orientTrack(r.annualAvg!).label;
    acc[track] = (acc[track] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="p-6 space-y-6 max-w-5xl mx-auto"
    >
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Compass className="w-6 h-6 text-amber-500" />
          نتائج الذين سيوجَّهون
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          تلاميذ 4AM الناجحون — التوجيه المتوقع نحو ثانوية التعليم العام
        </p>
      </motion.div>

      {/* Track distribution */}
      {!loading && eligible.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(trackCounts).map(([track, count], i) => (
            <motion.div key={track}
              initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.07 }} whileHover={{ y: -3 }}
              className="rounded-xl bg-muted/50 border p-4 text-center">
              <p className="text-2xl font-extrabold text-foreground">{count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{track}</p>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <motion.div key={i} className="h-16 rounded-xl bg-muted"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.1 }} />
            ))}
          </motion.div>
        ) : eligible.length === 0 ? (
          <motion.div key="empty"
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-dashed p-16 text-center text-muted-foreground">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}>
              <Compass className="w-14 h-14 mx-auto mb-4 opacity-20" />
            </motion.div>
            <p className="font-semibold">لا توجد نتائج 4AM</p>
            <p className="text-sm mt-1">أضف نتائج تلاميذ السنة الرابعة أولاً</p>
          </motion.div>
        ) : (
          <motion.div key="list" className="space-y-2">
            {/* Top 3 spotlight */}
            {eligible.length >= 3 && (
              <motion.div className="grid grid-cols-3 gap-3 mb-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                {eligible.slice(0, 3).map((r, i) => (
                  <motion.div key={r.student.id}
                    initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: i * 0.1, type: "spring", stiffness: 260 }}
                    whileHover={{ y: -4 }}
                    className={`rounded-2xl border p-4 text-center ${
                      i === 0 ? "bg-gradient-to-b from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800" :
                      i === 1 ? "bg-gradient-to-b from-slate-50 to-zinc-50 dark:from-slate-900/40 dark:to-zinc-900/30" : "bg-muted/30"
                    }`}
                  >
                    <motion.div className="text-3xl mb-2"
                      animate={i === 0 ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 2.5, repeat: Infinity }}>
                      {["🥇", "🥈", "🥉"][i]}
                    </motion.div>
                    <p className="font-bold text-sm">{r.student.firstName} {r.student.lastName}</p>
                    <p className={`text-2xl font-extrabold mt-1 ${avgColor(r.annualAvg!)}`}>
                      {r.annualAvg!.toFixed(2)}
                    </p>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full mt-2 inline-block font-semibold ${orientTrack(r.annualAvg!).color}`}>
                      {orientTrack(r.annualAvg!).label}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Full list */}
            {eligible.map((r, i) => {
              const track = orientTrack(r.annualAvg!);
              return (
                <motion.div key={r.student.id}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-4 bg-card border rounded-xl p-3.5 hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
                >
                  <span className="w-8 text-center font-black text-muted-foreground text-sm tabular-nums">
                    {i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}
                  </span>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <GraduationCap className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{r.student.firstName} {r.student.lastName}</p>
                    <p className="text-xs text-muted-foreground">قسم {r.student.classe}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${track.color}`}>
                    {track.label}
                  </span>
                  <span className={`text-xl font-extrabold tabular-nums w-14 text-end shrink-0 ${avgColor(r.annualAvg!)}`}>
                    {r.annualAvg!.toFixed(2)}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
