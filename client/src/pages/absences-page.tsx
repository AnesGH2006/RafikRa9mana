import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarOff, AlertTriangle, CheckCircle } from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";

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

function MiniTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 border rounded-lg shadow-lg p-2 text-xs">
      {label && <p className="font-bold mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-semibold">{p.name}: {p.value}h</p>
      ))}
    </div>
  );
}

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
      if (sRes.ok) { const d = await sRes.json(); setStudents(d.students ?? d); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
  const atRisk   = rows.filter(r => r.unjustified >= RISK_THRESHOLD).length;
  const totalJ   = rows.reduce((s, r) => s + r.justified, 0);
  const totalU   = rows.reduce((s, r) => s + r.unjustified, 0);

  // Analytics data
  const pieData = [
    { name: "مبررة",       value: totalJ, fill: "#10b981" },
    { name: "غير مبررة",   value: totalU, fill: "#f43f5e" },
  ].filter(d => d.value > 0);

  const top5 = rows.slice(0, 5).map(r => ({
    name: (r.student?.firstName ?? "") + " " + (r.student?.lastName ?? ""),
    justified: r.justified,
    unjustified: r.unjustified,
  }));

  const levelStats: Record<string, { justified: number; unjustified: number }> = {};
  for (const row of rows) {
    const lvl = row.student?.niveau ?? "?";
    levelStats[lvl] ??= { justified: 0, unjustified: 0 };
    levelStats[lvl]!.justified   += row.justified;
    levelStats[lvl]!.unjustified += row.unjustified;
  }
  const levelData = Object.entries(levelStats)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lvl, d]) => ({ name: lvl, مبررة: d.justified, "غير مبررة": d.unjustified }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="p-6 space-y-6 max-w-5xl mx-auto"
    >
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="inline-flex w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 items-center justify-center shadow-lg shadow-orange-500/30">
            <CalendarOff className="w-5 h-5 text-white" />
          </span>
          إجازات التلاميذ
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 ms-11">سجل الغيابات المبررة وغير المبررة بالساعات</p>
      </motion.div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "إجمالي التلاميذ",    value: rows.length, bg: "from-blue-500 to-indigo-600",    shadow: "shadow-blue-500/25" },
          { label: "ساعات مبررة",         value: totalJ,      bg: "from-emerald-500 to-green-600",  shadow: "shadow-emerald-500/25", suffix: "h" },
          { label: "ساعات غير مبررة",     value: totalU,      bg: "from-red-500 to-rose-600",       shadow: "shadow-red-500/25", suffix: "h" },
          { label: "تلاميذ في خطر",       value: atRisk,      bg: "from-orange-500 to-amber-600",   shadow: "shadow-orange-500/25" },
        ].map((c, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.07 }} whileHover={{ y: -3, scale: 1.02 }}
          >
            <Card className={`border-0 shadow-lg ${c.shadow} overflow-hidden`}>
              <div className={`bg-gradient-to-br ${c.bg} p-4 relative overflow-hidden`}>
                <div className="absolute -top-4 -right-4 w-14 h-14 rounded-full bg-white/10 blur-xl" />
                <p className="text-white/70 text-xs font-semibold mb-1">{c.label}</p>
                <p className="text-3xl font-extrabold text-white">{c.value}{c.suffix ?? ""}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Analytics charts */}
      {!loading && rows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {/* Justified vs Unjustified pie */}
          <Card className="border-0 shadow-md bg-gradient-to-br from-card to-muted/20">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground">نسبة الغيابات</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-3">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={62}
                    paddingAngle={4} dataKey="value" animationDuration={800}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip content={<MiniTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* By level bar */}
          {levelData.length > 0 && (
            <Card className="border-0 shadow-md bg-gradient-to-br from-card to-muted/20">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-bold text-muted-foreground">الغيابات حسب المستوى</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-3 px-2">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={levelData} barSize={14} margin={{ left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<MiniTooltip />} />
                    <Bar dataKey="مبررة"     fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="غير مبررة" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Top 5 absent students */}
          {top5.length > 0 && (
            <Card className="border-0 shadow-md bg-gradient-to-br from-card to-muted/20">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-bold text-muted-foreground">الأكثر غياباً (أول 5)</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-3 px-2">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={top5} layout="vertical" barSize={10} margin={{ left: 0, right: 10 }}>
                    <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={60}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v: string) => v.split(" ").slice(0, 2).join(" ")} />
                    <Tooltip content={<MiniTooltip />} />
                    <Bar dataKey="justified"   name="مبررة"     fill="#10b981" radius={[0, 3, 3, 0]} stackId="a" />
                    <Bar dataKey="unjustified" name="غير مبررة" fill="#f43f5e" radius={[0, 3, 3, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* Filter */}
      <motion.div className="flex gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
        <Select value={trimestre || "__all__"} onValueChange={v => setTrimestre(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-40 bg-gradient-to-r from-slate-600 to-slate-800 text-white border-0 font-semibold text-xs h-9">
            <SelectValue placeholder="كل الفصول" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">كل الفصول</SelectItem>
            <SelectItem value="1">الفصل 1</SelectItem>
            <SelectItem value="2">الفصل 2</SelectItem>
            <SelectItem value="3">الفصل 3</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Student list */}
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
              const risk  = row.unjustified >= RISK_THRESHOLD;
              const jPct  = (row.justified  / maxTotal) * 100;
              const uPct  = (row.unjustified / maxTotal) * 100;
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
                      <p className={`text-lg font-black ${risk ? "text-red-600" : "text-foreground"}`}>{row.total}h</p>
                      <p className="text-[10px] text-muted-foreground">إجمالي</p>
                    </div>
                  </div>
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
