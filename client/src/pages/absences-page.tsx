import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarOff, AlertTriangle, CheckCircle } from "lucide-react";

const BASE = import.meta.env.BASE_URL;
const CURRENT_YEAR = "2024-2025";

interface AbsenceRow {
  id: string;
  studentId: string;
  annee: string;
  trimestre: number;
  justifiedHours: number;
  unjustifiedHours: number;
}
interface StudentRow { id: string; firstName: string; lastName: string; niveau: string; classe: string; }

const RISK_THRESHOLD = 10;

export default function AbsencesPage() {
  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [trimestre, setTrimestre] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, sRes] = await Promise.all([
        fetch(`${BASE}api/absences?annee=${CURRENT_YEAR}`, { credentials: "include" }),
        fetch(`${BASE}api/students?annee=${CURRENT_YEAR}`, { credentials: "include" }),
      ]);
      if (aRes.ok) setAbsences(await aRes.json());
      if (sRes.ok) setStudents(await sRes.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Build per-student totals
  const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
  const filtered = trimestre ? absences.filter(a => a.trimestre === parseInt(trimestre)) : absences;

  const totals: Record<string, { justified: number; unjustified: number; total: number }> = {};
  for (const a of filtered) {
    totals[a.studentId] ??= { justified: 0, unjustified: 0, total: 0 };
    totals[a.studentId]!.justified += a.justifiedHours;
    totals[a.studentId]!.unjustified += a.unjustifiedHours;
    totals[a.studentId]!.total += a.justifiedHours + a.unjustifiedHours;
  }

  const rows = Object.entries(totals)
    .map(([id, t]) => ({ id, ...t, student: studentMap[id] }))
    .filter(r => r.student)
    .sort((a, b) => b.total - a.total);

  const maxTotal = rows.reduce((m, r) => Math.max(m, r.total), 1);
  const atRisk = rows.filter(r => r.unjustified >= RISK_THRESHOLD).length;
  const totalJ = rows.reduce((s, r) => s + r.justified, 0);
  const totalU = rows.reduce((s, r) => s + r.unjustified, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="p-6 space-y-6 max-w-5xl mx-auto"
    >
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarOff className="w-6 h-6 text-orange-500" />
          إجازات التلاميذ
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">سجل الغيابات المبررة وغير المبررة بالساعات</p>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "إجمالي التلاميذ", value: rows.length, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" },
          { label: "ساعات مبررة", value: totalJ, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
          { label: "ساعات غير مبررة", value: totalU, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30" },
          { label: "تلاميذ في خطر", value: atRisk, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30" },
        ].map((c, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.07 }} whileHover={{ y: -3 }}
            className={`rounded-xl ${c.bg} p-4 text-center`}
          >
            <p className={`text-2xl font-extrabold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Filter */}
      <motion.div className="flex gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <Select value={trimestre || "__all__"} onValueChange={v => setTrimestre(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="كل الفصول" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">كل الفصول</SelectItem>
            <SelectItem value="1">الفصل 1</SelectItem>
            <SelectItem value="2">الفصل 2</SelectItem>
            <SelectItem value="3">الفصل 3</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Table */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <motion.div key={i} className="h-14 rounded-xl bg-muted"
                animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.1 }} />
            ))}
          </motion.div>
        ) : rows.length === 0 ? (
          <motion.div key="empty"
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-dashed p-16 text-center text-muted-foreground">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}>
              <CalendarOff className="w-14 h-14 mx-auto mb-4 opacity-20" />
            </motion.div>
            <p className="font-semibold">لا توجد غيابات مسجلة</p>
            <p className="text-sm mt-1">سجّل الغيابات من صفحة نتائج التلاميذ</p>
          </motion.div>
        ) : (
          <motion.div key="list" className="space-y-2">
            {rows.map((row, i) => {
              const risk = row.unjustified >= RISK_THRESHOLD;
              const jPct = (row.justified / maxTotal) * 100;
              const uPct = (row.unjustified / maxTotal) * 100;
              return (
                <motion.div key={row.id}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`rounded-xl border p-4 ${risk ? "border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/10" : "bg-card"}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${risk ? "bg-red-100 dark:bg-red-950" : "bg-muted"}`}>
                      {risk
                        ? <AlertTriangle className="w-4 h-4 text-red-500" />
                        : <CheckCircle className="w-4 h-4 text-emerald-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {row.student!.firstName} {row.student!.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.student!.niveau} — {row.student!.classe}
                      </p>
                    </div>
                    <div className="text-end shrink-0">
                      <p className={`text-lg font-black ${risk ? "text-red-600" : "text-foreground"}`}>
                        {row.total}h
                      </p>
                      <p className="text-[10px] text-muted-foreground">إجمالي</p>
                    </div>
                  </div>

                  {/* Horizontal bars */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-emerald-600 w-20 shrink-0">مبررة: {row.justified}h</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div className="h-full bg-emerald-500 rounded-full"
                          initial={{ width: 0 }} animate={{ width: `${jPct}%` }}
                          transition={{ delay: i * 0.04 + 0.3, duration: 0.6, ease: "easeOut" }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-red-500 w-20 shrink-0">غير مبررة: {row.unjustified}h</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div className="h-full bg-red-500 rounded-full"
                          initial={{ width: 0 }} animate={{ width: `${uPct}%` }}
                          transition={{ delay: i * 0.04 + 0.4, duration: 0.6, ease: "easeOut" }} />
                      </div>
                    </div>
                  </div>

                  {risk && (
                    <motion.p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                      ⚠ تجاوز حد الغيابات غير المبررة ({RISK_THRESHOLD} ساعات)
                    </motion.p>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
