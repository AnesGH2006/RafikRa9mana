import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck, AlertCircle } from "lucide-react";

const BASE = import.meta.env.BASE_URL;
const CURRENT_YEAR = "2025-2026";

interface ResultRow {
  student: { id: string; nomPrenom: string; niveau: string; classe: string; };
  annualAvg: number | null;
  passed: boolean | null;
  rank: number | null;
}

export default function RepeatersPage() {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [niveau, setNiveau] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ annee: CURRENT_YEAR });
      if (niveau) p.set("niveau", niveau);
      const res = await fetch(`${BASE}api/results?${p}`, { credentials: "include" });
      if (res.ok) setResults(await res.json());
    } finally { setLoading(false); }
  }, [niveau]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const repeaters = results.filter(r => r.passed === false || (r.annualAvg !== null && r.annualAvg < 10));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="p-6 space-y-6 max-w-4xl mx-auto"
    >
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCheck className="w-6 h-6 text-orange-500" />
          التلاميذ المعيدون
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          التلاميذ المحتمل إعادتهم — المعدل السنوي أقل من 10
        </p>
      </motion.div>

      <div className="flex gap-3 flex-wrap items-center">
        <Select value={niveau || "__all__"} onValueChange={v => setNiveau(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="كل المستويات" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">كل المستويات</SelectItem>
            {["1AM", "2AM", "3AM", "4AM"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>

        {!loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="ms-auto px-3 py-1.5 rounded-lg bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 text-sm font-bold">
            {repeaters.length} تلميذ معيد محتمل
          </motion.div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <motion.div key={i} className="h-16 rounded-xl bg-muted"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.1 }} />
            ))}
          </motion.div>
        ) : repeaters.length === 0 ? (
          <motion.div key="empty"
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-dashed p-16 text-center text-muted-foreground">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}>
              <UserCheck className="w-14 h-14 mx-auto mb-4 opacity-20" />
            </motion.div>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">لا يوجد تلاميذ راسبون!</p>
            <p className="text-sm mt-1">جميع التلاميذ نجحوا أو لا توجد نتائج بعد</p>
          </motion.div>
        ) : (
          <motion.div key="list" className="space-y-2">
            {repeaters.map((r, i) => (
              <motion.div key={r.student.id}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ x: 4 }}
                className="flex items-center gap-4 bg-card border rounded-xl p-4 hover:border-orange-300 dark:hover:border-orange-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{r.student.nomPrenom}</p>
                  <p className="text-xs text-muted-foreground">{r.student.niveau} — قسم {r.student.classe}</p>
                </div>

                {/* Mini bar */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-red-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${((r.annualAvg ?? 0) / 20) * 100}%` }}
                      transition={{ delay: i * 0.05 + 0.3, duration: 0.6 }}
                    />
                  </div>
                  <span className="text-lg font-black text-red-600 dark:text-red-400 tabular-nums w-12 text-end">
                    {r.annualAvg !== null ? r.annualAvg.toFixed(2) : "—"}
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}