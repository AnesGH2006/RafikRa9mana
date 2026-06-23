import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck, AlertCircle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from "recharts";

const BASE = import.meta.env.BASE_URL;
const ACADEMIC_YEARS = ["2026-2027", "2025-2026", "2024-2025", "2023-2024", "2022-2023"];
const DEFAULT_YEAR  = "2025-2026";
const LEVEL_COLORS: Record<string, string> = {
  "1AM": "#6366f1", "2AM": "#8b5cf6", "3AM": "#a855f7", "4AM": "#d946ef",
};

interface ResultRow {
  student: { id: string; nomPrenom: string; niveau: string; classe: string };
  annualAvg: number | null;
  passed: boolean | null;
  rank: number | null;
}

function MiniTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 border rounded-lg shadow-lg p-2 text-xs">
      {label && <p className="font-bold mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-semibold">{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

export default function RepeatersPage() {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [annee, setAnnee] = useState(DEFAULT_YEAR);
  const [niveau, setNiveau] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ annee });
      if (niveau) p.set("niveau", niveau);
      const res = await fetch(`${BASE}api/results?${p}`, { credentials: "include" });
      if (res.ok) setResults(await res.json());
    } finally { setLoading(false); }
  }, [niveau, annee]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const repeaters = results.filter(r => r.passed === false || (r.annualAvg !== null && r.annualAvg < 10));

  // Analytics
  const LEVELS = ["1AM", "2AM", "3AM", "4AM"];
  const byLevel = LEVELS.map(lvl => ({
    name: lvl,
    معيدون: repeaters.filter(r => r.student.niveau === lvl).length,
    fill: LEVEL_COLORS[lvl] ?? "#6366f1",
  })).filter(d => d.معيدون > 0);

  const totalWithAvg = results.filter(r => r.annualAvg !== null).length;
  const repeatRate = totalWithAvg > 0 ? Math.round((repeaters.length / totalWithAvg) * 100) : 0;

  // Grade histogram buckets: <5, 5-7, 7-8, 8-9, 9-10
  const buckets = [
    { label: "< 5",   min: 0,   max: 5   },
    { label: "5-7",   min: 5,   max: 7   },
    { label: "7-8",   min: 7,   max: 8   },
    { label: "8-9",   min: 8,   max: 9   },
    { label: "9-10",  min: 9,   max: 10  },
  ];
  const histData = buckets.map(b => ({
    name: b.label,
    count: repeaters.filter(r => r.annualAvg !== null && r.annualAvg >= b.min && r.annualAvg < b.max).length,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="p-6 space-y-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="inline-flex w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 items-center justify-center shadow-lg shadow-orange-500/30">
            <UserCheck className="w-5 h-5 text-white" />
          </span>
          التلاميذ المعيدون
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 ms-11">
          التلاميذ المحتمل إعادتهم — المعدل السنوي أقل من 10
        </p>
      </motion.div>

      {/* Analytics */}
      {!loading && repeaters.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {/* KPI card */}
          <Card className="border-0 shadow-lg shadow-orange-500/20 overflow-hidden">
            <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-5 relative overflow-hidden">
              <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10 blur-xl" />
              <p className="text-white/70 text-xs font-semibold mb-1">إجمالي المعيدون</p>
              <p className="text-4xl font-extrabold text-white">{repeaters.length}</p>
              <div className="mt-3 h-1.5 rounded-full bg-white/20 overflow-hidden">
                <motion.div
                  className="h-full bg-white/70 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${repeatRate}%` }}
                  transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
                />
              </div>
              <p className="text-white/70 text-xs mt-1.5">
                {repeatRate}% من إجمالي التلاميذ
              </p>
            </div>
          </Card>

          {/* By level bar */}
          {byLevel.length > 0 && (
            <Card className="border-0 shadow-md bg-gradient-to-br from-card to-muted/20">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-bold text-muted-foreground">المعيدون حسب المستوى</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-3 px-2">
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={byLevel} barSize={24} margin={{ left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<MiniTooltip />} />
                    <Bar dataKey="معيدون" radius={[5, 5, 0, 0]}>
                      {byLevel.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Grade histogram */}
          <Card className="border-0 shadow-md bg-gradient-to-br from-card to-muted/20">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-bold text-muted-foreground">توزيع المعدلات</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-3 px-2">
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={histData} barSize={20} margin={{ left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<MiniTooltip />} />
                  <Bar dataKey="count" name="تلاميذ" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Filters + count */}
      <div className="flex gap-3 flex-wrap items-center">
        <Select value={annee} onValueChange={v => { setAnnee(v); setNiveau(""); }}>
          <SelectTrigger className="w-36 font-semibold border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 bg-orange-50/50 dark:bg-orange-950/30 text-xs h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACADEMIC_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={niveau || "__all__"} onValueChange={v => setNiveau(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-40 bg-gradient-to-r from-orange-500 to-amber-600 text-white border-0 font-semibold text-xs h-9">
            <SelectValue placeholder="كل المستويات" />
          </SelectTrigger>
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
