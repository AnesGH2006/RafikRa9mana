import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, GraduationCap, Users, BarChart3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudentResult } from "@shared/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const BASE = import.meta.env.BASE_URL;
const ACADEMIC_YEARS = ["2026-2027", "2025-2026", "2024-2025", "2023-2024"];
const DEFAULT_YEAR = "2025-2026";

// Split "NOM PRENOM" → { nom (لقب), prenom (اسم) }
function splitName(nomPrenom: string) {
  const parts = nomPrenom.trim().split(/\s+/);
  if (parts.length === 1) return { nom: parts[0] ?? "", prenom: "" };
  return { nom: parts[0] ?? "", prenom: parts.slice(1).join(" ") };
}

function avgColor(v: number) {
  if (v >= 16) return "text-emerald-600 dark:text-emerald-400";
  if (v >= 14) return "text-blue-600 dark:text-blue-400";
  if (v >= 12) return "text-violet-600 dark:text-violet-400";
  return "text-orange-600 dark:text-orange-400";
}

function orientTrack(avg: number) {
  if (avg >= 14) return {
    label: "جذع مشترك علوم",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    key: "science",
  };
  if (avg >= 10) return {
    label: "جذع مشترك آداب وفلسفة",
    color: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    key: "arts",
  };
  if (avg >= 8) return {
    label: "تعليم مهني",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    key: "technical",
  };
  return {
    label: "تكوين مهني",
    color: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    key: "vocational",
  };
}

function MiniTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 border rounded-xl shadow-xl p-2.5 text-xs">
      {label && <p className="font-bold mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-semibold">
          {p.name}: {typeof p.value === "number" ? p.value.toFixed?.(2) ?? p.value : p.value}
        </p>
      ))}
    </div>
  );
}

export default function OrientationResultsPage() {
  const [results, setResults]       = useState<StudentResult[]>([]);
  const [loading, setLoading]       = useState(true);
  const [annee, setAnnee]           = useState(DEFAULT_YEAR);
  const [filterClasse, setFilterClasse] = useState("");
  const [filterSexe, setFilterSexe]     = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ annee, niveau: "4AM" });
      const res = await fetch(`${BASE}api/results?${p}`, { credentials: "include" });
      if (res.ok) setResults(await res.json());
    } finally { setLoading(false); }
  }, [annee]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // All passed students sorted by avg descending
  const eligible = results
    .filter(r => r.passed && r.annualAvg !== null)
    .sort((a, b) => (b.annualAvg ?? 0) - (a.annualAvg ?? 0));

  const classes = [...new Set(eligible.map(r => r.student.classe))].sort();

  const filtered = eligible.filter(r =>
    (!filterClasse || r.student.classe === filterClasse) &&
    (!filterSexe   || r.student.sexe   === filterSexe)
  );

  // Track distribution
  const trackCounts = filtered.reduce((acc, r) => {
    const label = orientTrack(r.annualAvg!).label;
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Average by class (using all eligible, not filtered)
  const avgByClass = classes.map(cls => {
    const inClass = eligible.filter(r => r.student.classe === cls);
    const avg = inClass.reduce((s, r) => s + (r.annualAvg ?? 0), 0) / inClass.length;
    return { name: `قسم ${cls}`, avg: Math.round(avg * 100) / 100, total: inClass.length };
  });

  // Gender × track breakdown
  const genderTrackData = [
    {
      track: "علوم",
      ذكور: filtered.filter(r => orientTrack(r.annualAvg!).key === "science" && r.student.sexe === "M").length,
      إناث: filtered.filter(r => orientTrack(r.annualAvg!).key === "science" && r.student.sexe === "F").length,
    },
    {
      track: "آداب",
      ذكور: filtered.filter(r => orientTrack(r.annualAvg!).key === "arts" && r.student.sexe === "M").length,
      إناث: filtered.filter(r => orientTrack(r.annualAvg!).key === "arts" && r.student.sexe === "F").length,
    },
  ].filter(d => d.ذكور + d.إناث > 0);

  // Grade distribution buckets
  const gradeDistData = [
    { label: "10–12", min: 10, max: 12 },
    { label: "12–14", min: 12, max: 14 },
    { label: "14–16", min: 14, max: 16 },
    { label: "16–18", min: 16, max: 18 },
    { label: "18–20", min: 18, max: 20.1 },
  ].map(b => ({
    label: b.label,
    count: filtered.filter(r => (r.annualAvg ?? 0) >= b.min && (r.annualAvg ?? 0) < b.max).length,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="p-6 space-y-6 max-w-5xl mx-auto"
    >
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="inline-flex w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 items-center justify-center shadow-lg shadow-amber-400/30">
            <Compass className="w-5 h-5 text-white" />
          </span>
          نتائج الذين سيوجَّهون
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          تلاميذ 4AM الناجحون — التوجيه المتوقع نحو ثانوية التعليم العام
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div
        className="flex flex-wrap gap-2"
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      >
        <Select value={annee} onValueChange={setAnnee}>
          <SelectTrigger className="w-36 font-semibold border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACADEMIC_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterClasse || "__all__"} onValueChange={v => setFilterClasse(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-32"><SelectValue placeholder="كل الأقسام" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">كل الأقسام</SelectItem>
            {classes.map(c => <SelectItem key={c} value={c}>قسم {c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterSexe || "__all__"} onValueChange={v => setFilterSexe(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-32"><SelectValue placeholder="كل الجنسين" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">كل الجنسين</SelectItem>
            <SelectItem value="M">ذكور</SelectItem>
            <SelectItem value="F">إناث</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* KPI cards */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            whileHover={{ y: -3 }}
            className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-center text-white shadow-md shadow-amber-500/25"
          >
            <p className="text-3xl font-extrabold">{filtered.length}</p>
            <p className="text-xs text-white/80 mt-0.5">إجمالي الناجحين</p>
          </motion.div>

          {Object.entries(trackCounts).map(([track, count], i) => (
            <motion.div key={track}
              initial={{ opacity: 0, y: 14, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: (i + 1) * 0.07 }} whileHover={{ y: -3 }}
              className="rounded-xl bg-muted/50 border p-4 text-center">
              <p className="text-2xl font-extrabold">{count}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{track}</p>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.28 }} whileHover={{ y: -3 }}
            className="rounded-xl bg-muted/50 border p-4 text-center">
            <p className="text-2xl font-extrabold text-blue-600">
              {filtered.filter(r => r.student.sexe === "M").length}
              <span className="text-pink-500 font-extrabold text-lg">/{filtered.filter(r => r.student.sexe === "F").length}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">ذكور / إناث</p>
          </motion.div>
        </div>
      )}

      {/* Analytics charts */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Average by class */}
          {avgByClass.length > 1 && (
            <Card className="rounded-2xl border shadow-sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <BarChart3 className="w-3.5 h-3.5" />المعدل حسب القسم
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={avgByClass} barSize={22} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 20]} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<MiniTooltip />} />
                    <Bar dataKey="avg" name="المعدل" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Gender × track */}
          {genderTrackData.length > 0 && (
            <Card className="rounded-2xl border shadow-sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />الجنس حسب التوجيه
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={genderTrackData} barSize={18} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
                    <XAxis dataKey="track" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<MiniTooltip />} />
                    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="ذكور" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="إناث" fill="#ec4899" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Grade distribution */}
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-bold text-muted-foreground">توزيع المعدلات</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={gradeDistData} barSize={22} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<MiniTooltip />} />
                  <Bar dataKey="count" name="عدد التلاميذ" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* List */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <motion.div key={i} className="h-16 rounded-xl bg-muted"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.1 }} />
            ))}
          </motion.div>
        ) : filtered.length === 0 ? (
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
            {filtered.length >= 3 && (
              <motion.div className="grid grid-cols-3 gap-3 mb-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                {filtered.slice(0, 3).map((r, i) => {
                  const { nom, prenom } = splitName(r.student.nomPrenom);
                  return (
                    <motion.div key={r.student.id}
                      initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: i * 0.1, type: "spring", stiffness: 260 }}
                      whileHover={{ y: -4 }}
                      className={`rounded-2xl border p-4 text-center ${
                        i === 0
                          ? "bg-gradient-to-b from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800"
                          : i === 1
                            ? "bg-gradient-to-b from-slate-50 to-zinc-50 dark:from-slate-900/40 dark:to-zinc-900/30"
                            : "bg-muted/30"
                      }`}
                    >
                      <motion.div className="text-3xl mb-1"
                        animate={i === 0 ? { scale: [1, 1.1, 1] } : {}}
                        transition={{ duration: 2.5, repeat: Infinity }}>
                        {["🥇", "🥈", "🥉"][i]}
                      </motion.div>
                      {/* لقب */}
                      <p className="font-black text-xs text-muted-foreground uppercase tracking-wide leading-none">{nom}</p>
                      {/* اسم */}
                      <p className="font-bold text-sm mt-0.5">{prenom}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        قسم {r.student.classe} ·{" "}
                        <span className={r.student.sexe === "M" ? "text-blue-500" : "text-pink-500"}>
                          {r.student.sexe === "M" ? "♂" : "♀"}
                        </span>
                      </p>
                      <p className={`text-2xl font-extrabold mt-1.5 ${avgColor(r.annualAvg!)}`}>
                        {r.annualAvg!.toFixed(2)}
                      </p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full mt-2 inline-block font-semibold ${orientTrack(r.annualAvg!).color}`}>
                        {orientTrack(r.annualAvg!).label}
                      </span>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* Full ranked list */}
            {filtered.map((r, i) => {
              const track = orientTrack(r.annualAvg!);
              const { nom, prenom } = splitName(r.student.nomPrenom);
              return (
                <motion.div key={r.student.id}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.5) }}
                  className="flex items-center gap-3 bg-card border rounded-xl p-3.5
                             hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
                >
                  {/* Rank */}
                  <span className="w-7 text-center font-black text-muted-foreground text-sm tabular-nums shrink-0">
                    {i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}
                  </span>

                  <GraduationCap className="w-4 h-4 text-amber-500 shrink-0" />

                  {/* Name block — لقب (nom) bold + اسم (prénom) */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="font-black text-xs text-muted-foreground uppercase tracking-wide">{nom}</span>
                      <span className="font-semibold text-sm">{prenom}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      قسم {r.student.classe}
                      {" · "}
                      <span className={r.student.sexe === "M" ? "text-blue-500 font-semibold" : "text-pink-500 font-semibold"}>
                        {r.student.sexe === "M" ? "♂ ذكر" : "♀ أنثى"}
                      </span>
                    </p>
                  </div>

                  {/* Track badge */}
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${track.color}`}>
                    {track.label}
                  </span>

                  {/* Average */}
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
