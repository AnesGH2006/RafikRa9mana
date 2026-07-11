import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { useLanguage } from "@/contexts/language-provider";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Trash2, Search, Users, FileSpreadsheet, X, CheckCircle2, AlertCircle, BarChart2, Printer } from "lucide-react";
import { CountUp } from "@/components/count-up";
import type { Student, Niveau, Sexe, Statut } from "@shared/types";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";

const BASE = import.meta.env.BASE_URL;
const LEVELS: Niveau[] = ["1AM", "2AM", "3AM", "4AM"];
const LEVEL_LABELS: Record<Niveau, string> = { "1AM": "1ère AM", "2AM": "2ème AM", "3AM": "3ème AM", "4AM": "4ème AM" };
const LEVEL_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#d946ef"];
const GENDER_COLORS = ["#3b82f6", "#ec4899"];
const ACADEMIC_YEARS = ["2026-2027", "2025-2026", "2024-2025", "2023-2024", "2022-2023"];
const DEFAULT_YEAR  = "2025-2026";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as any } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

function MiniTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background/95 border rounded-lg shadow-lg p-2 text-xs">
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-semibold">{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

function StudentAnalytics({ students }: { students: Student[] }) {
  if (students.length === 0) return null;

  const boys  = students.filter(s => s.sexe === "M").length;
  const girls = students.filter(s => s.sexe === "F").length;

  const genderData = [
    { name: "ذكور", value: boys,  fill: GENDER_COLORS[0] },
    { name: "إناث", value: girls, fill: GENDER_COLORS[1] },
  ];

  const levelData = LEVELS.map((l, i) => ({
    name: l,
    total: students.filter(s => s.niveau === l).length,
    fill: LEVEL_COLORS[i],
  })).filter(d => d.total > 0);

  const admis    = students.filter(s => s.resultat === "admis").length;
  const nonAdmis = students.filter(s => s.resultat === "non_admis").length;
  const withResult = admis + nonAdmis;
  const successRate = withResult > 0 ? Math.round((admis / withResult) * 100) : null;

  const statusData = [
    { name: "جديد",  value: students.filter(s => s.statut === "nouveau").length,    fill: "#10b981" },
    { name: "معيد",  value: students.filter(s => s.statut === "redoublant").length,  fill: "#f59e0b" },
  ].filter(d => d.value > 0);

  // Class breakdown (by classe within current filter)
  const classCounts = Object.entries(
    students.reduce((acc, s) => {
      acc[s.classe] = (acc[s.classe] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort(([a], [b]) => a.localeCompare(b, "ar")).map(([name, value]) => ({ name, value }));

  // Per-level pass/fail rate
  const levelPassData = LEVELS.map((lvl, i) => {
    const lvlStudents = students.filter(s => s.niveau === lvl && (s.resultat === "admis" || s.resultat === "non_admis"));
    const lvlPass = lvlStudents.filter(s => s.resultat === "admis");
    return {
      name: LEVEL_LABELS[lvl],
      ناجح: lvlPass.length,
      راسب: lvlStudents.length - lvlPass.length,
      total: lvlStudents.length,
      rate: lvlStudents.length > 0 ? Math.round((lvlPass.length / lvlStudents.length) * 100) : 0,
      fill: LEVEL_COLORS[i],
    };
  }).filter(d => d.total > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {/* KPI bar */}
      <Card className="border-0 shadow-md bg-gradient-to-br from-blue-500 to-indigo-700 overflow-hidden col-span-1">
        <CardContent className="p-4 relative">
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10 blur-xl" />
          <p className="text-white/70 text-xs font-semibold mb-1">إجمالي التلاميذ</p>
          <p className="text-4xl font-extrabold text-white"><CountUp to={students.length} /></p>
          <div className="mt-3 flex gap-3 text-xs text-white/80 font-semibold">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-300" />{boys} ذكور
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-pink-300" />{girls} إناث
            </span>
          </div>
          {successRate !== null && (
            <div className="mt-2 text-xs text-white/70">
              نسبة النجاح: <span className="font-bold text-emerald-200">{successRate}%</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gender pie */}
      <Card className="border-0 shadow-md bg-gradient-to-br from-card to-muted/20 col-span-1">
        <CardHeader className="pb-1 pt-3 px-4">
          <CardTitle className="text-xs font-bold text-muted-foreground">توزيع الجنس</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <ResponsiveContainer width="100%" height={110}>
            <PieChart>
              <Pie data={genderData} cx="50%" cy="50%" innerRadius={30} outerRadius={45}
                paddingAngle={3} dataKey="value" animationDuration={700}>
                {genderData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip content={<MiniTooltip />} />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Level bar */}
      <Card className="border-0 shadow-md bg-gradient-to-br from-card to-muted/20 col-span-1">
        <CardHeader className="pb-1 pt-3 px-4">
          <CardTitle className="text-xs font-bold text-muted-foreground">توزيع المستويات</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2 px-2">
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={levelData} barSize={18} margin={{ top: 6, bottom: 0, left: -20, right: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip content={<MiniTooltip />} />
              <Bar dataKey="total" name="التلاميذ" radius={[4, 4, 0, 0]}>
                {levelData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Status pie */}
      <Card className="border-0 shadow-md bg-gradient-to-br from-card to-muted/20 col-span-1">
        <CardHeader className="pb-1 pt-3 px-4">
          <CardTitle className="text-xs font-bold text-muted-foreground">الوضعية والنتيجة</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <ResponsiveContainer width="100%" height={110}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={28} outerRadius={42}
                paddingAngle={3} dataKey="value" animationDuration={700}>
                {statusData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip content={<MiniTooltip />} />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>

    {/* ── Row 2: Class breakdown + level pass rate ─────────────────── */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Class breakdown bar chart */}
      {classCounts.length > 1 && (
        <Card className="border-0 shadow-md bg-gradient-to-br from-card to-muted/20">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-bold text-muted-foreground">التلاميذ حسب القسم</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-3 px-2">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={classCounts} barSize={22} margin={{ left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<MiniTooltip />} />
                <Bar dataKey="value" name="التلاميذ" radius={[5, 5, 0, 0]}>
                  {classCounts.map((_, i) => <Cell key={i} fill={LEVEL_COLORS[i % LEVEL_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-level pass rate progress bars */}
      {levelPassData.length > 0 && (
        <Card className="border-0 shadow-md bg-gradient-to-br from-card to-muted/20">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-bold text-muted-foreground">نسبة النجاح حسب المستوى</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {levelPassData.map((l, i) => (
              <div key={l.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold" style={{ color: l.fill }}>{l.name}</span>
                  <span className="flex gap-3">
                    <span className="text-muted-foreground">{l.total} تلميذ</span>
                    <span className={`font-bold ${l.rate >= 75 ? "text-emerald-600" : l.rate >= 50 ? "text-amber-600" : "text-red-500"}`}>
                      {l.rate}%
                    </span>
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
                  <motion.div className="h-full bg-emerald-500 rounded-s-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(l.ناجح / l.total) * 100}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }} />
                  <motion.div className="h-full bg-red-400 rounded-e-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(l.راسب / l.total) * 100}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 + 0.05 }} />
                </div>
                <div className="flex gap-3 text-[10px] text-muted-foreground">
                  <span className="text-emerald-600">{l.ناجح} ناجح</span>
                  <span className="text-red-500">{l.راسب} راسب</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>

    {/* ── Row 3: Boys/girls count per group (فوج) within each level (مستوى) ── */}
    <GroupGenderBreakdown students={students} />
    </motion.div>
  );
}

function GroupGenderBreakdown({ students }: { students: Student[] }) {
  const breakdown = LEVELS.map((lvl, i) => {
    const lvlStudents = students.filter(s => s.niveau === lvl);
    if (lvlStudents.length === 0) return null;
    const groupNames = [...new Set(lvlStudents.map(s => s.classe))].sort((a, b) => a.localeCompare(b, "ar"));
    const groups = groupNames.map(name => {
      const gs = lvlStudents.filter(s => s.classe === name);
      return {
        name,
        boys: gs.filter(s => s.sexe === "M").length,
        girls: gs.filter(s => s.sexe === "F").length,
        total: gs.length,
      };
    });
    return {
      level: lvl,
      label: LEVEL_LABELS[lvl],
      color: LEVEL_COLORS[i],
      boys: lvlStudents.filter(s => s.sexe === "M").length,
      girls: lvlStudents.filter(s => s.sexe === "F").length,
      total: lvlStudents.length,
      groups,
    };
  }).filter((d): d is NonNullable<typeof d> => d !== null);

  if (breakdown.length === 0) return null;

  return (
    <Card className="border-0 shadow-md bg-gradient-to-br from-card to-muted/20">
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-xs font-bold text-muted-foreground">توزيع الذكور والإناث حسب الفوج في كل مستوى</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-4 py-2 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">المستوى</th>
                <th className="px-4 py-2 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">الفوج</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-sky-600 uppercase tracking-wider whitespace-nowrap">ذكور</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-pink-600 uppercase tracking-wider whitespace-nowrap">إناث</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">المجموع</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((lvl, li) => (
                <Fragment key={lvl.level}>
                  {lvl.groups.map((g, gi) => (
                    <motion.tr key={`${lvl.level}-${g.name}`}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min((li * 4 + gi) * 0.02, 0.4), duration: 0.25 }}
                      className={`border-t ${gi === 0 ? "border-t-2" : ""} hover:bg-muted/40 transition-colors`}
                      style={gi === 0 ? { borderTopColor: lvl.color } : undefined}
                    >
                      {gi === 0 && (
                        <td rowSpan={lvl.groups.length} className="px-4 py-2 align-top">
                          <Badge className="font-bold" style={{ backgroundColor: `${lvl.color}20`, color: lvl.color, border: `1px solid ${lvl.color}40` }}>
                            {lvl.label}
                          </Badge>
                        </td>
                      )}
                      <td className="px-4 py-2">
                        <Badge variant="outline" className="font-bold">{g.name}</Badge>
                      </td>
                      <td className="px-4 py-2 text-center font-semibold text-sky-600">{g.boys}</td>
                      <td className="px-4 py-2 text-center font-semibold text-pink-600">{g.girls}</td>
                      <td className="px-4 py-2 text-center font-bold text-foreground">{g.total}</td>
                    </motion.tr>
                  ))}
                  <tr key={`${lvl.level}-total`} className="border-t bg-muted/30 font-bold">
                    <td className="px-4 py-2" colSpan={2}>إجمالي {lvl.label}</td>
                    <td className="px-4 py-2 text-center text-sky-700">{lvl.boys}</td>
                    <td className="px-4 py-2 text-center text-pink-700">{lvl.girls}</td>
                    <td className="px-4 py-2 text-center">{lvl.total}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Students() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [listKey, setListKey] = useState(0);
  const [showAnalytics, setShowAnalytics] = useState(true);

  const [filters, setFilters] = useState({ q: "", niveau: "", classe: "", sexe: "", statut: "", annee: DEFAULT_YEAR });

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.niveau) params.set("niveau", filters.niveau);
      if (filters.classe) params.set("classe", filters.classe);
      if (filters.sexe) params.set("sexe", filters.sexe);
      if (filters.statut) params.set("statut", filters.statut);
      if (filters.annee) params.set("annee", filters.annee);
      const res = await fetch(`${BASE}api/students?${params}`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setStudents(d.students); setListKey(k => k + 1); }
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const classes = [...new Set(students.map(s => s.classe))].sort();

  const handleImport = async (file: File) => {
    setImporting(true);
    const form = new FormData();
    form.append("file", file);
    const params = filters.annee ? `?annee=${filters.annee}` : "";
    try {
      const res = await fetch(`${BASE}api/students/import${params}`, { method: "POST", body: form, credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setImportResult(data);
        setImportResultOpen(true);
        fetchStudents();
      } else {
        toast({ variant: "destructive", title: t("students.importError"), description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: t("students.importError"), description: "" });
    } finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const params = filters.annee ? `?annee=${filters.annee}` : "";
      await fetch(`${BASE}api/students${params}`, { method: "DELETE", credentials: "include" });
      setStudents([]);
      setDeleteOpen(false);
    } finally { setDeleting(false); }
  };

  const setFilter = (key: string, val: string) => setFilters(p => ({ ...p, [key]: val === "__all__" ? "" : val }));
  const activeFilters = Object.entries(filters).filter(([k, v]) => v && k !== "q").length;

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 space-y-5 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <span className="inline-flex w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 items-center justify-center shadow-lg shadow-blue-500/30">
              <Users className="w-5 h-5 text-white" />
            </span>
            {t("students.title")}
          </h1>
        </motion.div>

        <motion.div className="flex items-center gap-2"
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button
              size="sm" variant="outline"
              className={`gap-1.5 h-9 text-xs font-semibold ${showAnalytics ? "bg-violet-50 border-violet-200 text-violet-700" : ""}`}
              onClick={() => setShowAnalytics(s => !s)}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              {showAnalytics ? "إخفاء الإحصاءات" : "إظهار الإحصاءات"}
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button
              size="sm" variant="outline"
              className="gap-1.5 h-9 text-xs font-semibold text-slate-600 hover:text-slate-800"
              onClick={() => window.print()}
              data-testid="button-print-students"
            >
              <Printer className="w-3.5 h-3.5" />
              طباعة
            </Button>
          </motion.div>

          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button
              className="gap-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-sm shadow-emerald-500/30 border-0"
              onClick={() => fileRef.current?.click()} disabled={importing}
            >
              {importing ? (
                <>
                  <motion.div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                    animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
                  {t("students.importing")}
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  {t("students.import")}
                </>
              )}
            </Button>
          </motion.div>
          <AnimatePresence>
            {students.length > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button variant="outline" className="gap-2 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                    onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">{t("students.delete")}</span>
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Analytics */}
      <AnimatePresence>
        {showAnalytics && !loading && students.length > 0 && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <StudentAnalytics students={students} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <motion.div className="flex flex-wrap gap-3 items-center"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input className="ps-9 transition-shadow focus:shadow-md" placeholder={t("students.search")}
            value={filters.q} onChange={e => setFilters(p => ({ ...p, q: e.target.value }))} />
        </div>
        <Select value={filters.annee || DEFAULT_YEAR} onValueChange={v => setFilter("annee", v)}>
          <SelectTrigger className="w-36 font-semibold border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACADEMIC_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        {([
          { key: "niveau", placeholder: t("students.filterLevel"), opts: LEVELS.map(l => ({ v: l, label: LEVEL_LABELS[l] })), allLabel: t("students.allLevels"), w: "w-36" },
          { key: "sexe", placeholder: t("students.filterGender"), opts: [{ v: "M", label: t("val.male") }, { v: "F", label: t("val.female") }], allLabel: t("students.allGenders"), w: "w-28" },
          { key: "statut", placeholder: t("students.filterStatus"), opts: [{ v: "nouveau", label: t("val.nouveau") }, { v: "redoublant", label: t("val.redoublant") }], allLabel: t("students.allStatuts"), w: "w-32" },
        ] as const).map(f => (
          <Select key={f.key} value={(filters as any)[f.key] || "__all__"} onValueChange={v => setFilter(f.key, v)}>
            <SelectTrigger className={`${f.w} transition-shadow focus:shadow-md`}><SelectValue placeholder={f.placeholder} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{f.allLabel}</SelectItem>
              {f.opts.map((o: { v: string; label: string }) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}
        <AnimatePresence>
          {(activeFilters > 0 || filters.q) && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground h-9"
                onClick={() => setFilters({ q: "", niveau: "", classe: "", sexe: "", statut: "", annee: "" })}>
                <X className="w-3.5 h-3.5" /> Reset
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Count */}
      <AnimatePresence mode="wait">
        {!loading && (
          <motion.div key={students.length} className="flex items-center gap-2 text-sm text-muted-foreground"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <Users className="w-4 h-4" />
            <span>
              <span className="font-bold text-foreground"><CountUp to={students.length} duration={0.6} /></span>
              {" "}{t("students.title").toLowerCase()}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <motion.div key={i} className="h-12 rounded-lg bg-muted"
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
              />
            ))}
          </motion.div>
        ) : students.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
            className="text-center py-16 text-muted-foreground">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
            </motion.div>
            <p>{t("students.empty")}</p>
          </motion.div>
        ) : (
          <motion.div key={`table-${listKey}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            className="rounded-xl border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr>
                    {[t("col.name"), t("col.birth"), t("col.level"), t("col.class"), t("col.gender"), t("col.status"), t("col.result")].map(h => (
                      <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <motion.tr key={s.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.025, 0.5), duration: 0.3, ease: "easeOut" }}
                      className={`border-t transition-colors hover:bg-muted/40 ${i % 2 === 0 ? "" : "bg-muted/20"}`}
                    >
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{s.nomPrenom}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{s.dateNaissance || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="font-semibold text-xs">{LEVEL_LABELS[s.niveau as Niveau]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-bold">{s.classe}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                          s.sexe === "M"
                            ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                            : "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300"
                        }`}>
                          {s.sexe === "M" ? t("val.male") : t("val.female")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${
                          s.statut === "redoublant"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}>
                          {s.statut === "redoublant" ? t("val.redoublant") : t("val.nouveau")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.resultat === "admis" ? (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{t("val.admis")}</span>
                        ) : s.resultat === "non_admis" ? (
                          <span className="text-xs font-semibold text-red-500">{t("val.non_admis")}</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Result Dialog */}
      <Dialog open={importResultOpen} onOpenChange={setImportResultOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importResult?.imported ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </motion.div>
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-500" />
              )}
              {importResult?.imported ? t("students.importSuccess") : t("students.importError")}
            </DialogTitle>
          </DialogHeader>
          {importResult && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <motion.div className="flex-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-4 text-center"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <p className="text-3xl font-extrabold text-emerald-600"><CountUp to={importResult.imported} duration={0.8} /></p>
                  <p className="text-xs text-muted-foreground mt-1">تم الاستيراد</p>
                </motion.div>
                <motion.div className="flex-1 rounded-xl bg-amber-50 dark:bg-amber-950/30 p-4 text-center"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                  <p className="text-3xl font-extrabold text-amber-600"><CountUp to={importResult.skipped} duration={0.8} /></p>
                  <p className="text-xs text-muted-foreground mt-1">تم التخطي</p>
                </motion.div>
              </div>
              {importResult.imported > 0 && (
                <motion.div className="h-2 rounded-full bg-muted overflow-hidden"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
                  <motion.div className="h-full bg-emerald-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(importResult.imported / (importResult.imported + importResult.skipped)) * 100}%` }}
                    transition={{ duration: 1, delay: 0.35, ease: "easeOut" as any }}
                  />
                </motion.div>
              )}
              {importResult.errors.length > 0 && (
                <motion.div className="space-y-1.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    أسباب التخطي (أول {importResult.errors.length} خطأ)
                  </p>
                  <div className="rounded-lg border bg-muted/40 p-3 max-h-48 overflow-y-auto space-y-1">
                    {importResult.errors.map((e, i) => (
                      <motion.p key={i} className="text-xs text-red-600 dark:text-red-400 font-mono"
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}>
                        {e}
                      </motion.p>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setImportResultOpen(false)}>حسناً</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("students.confirmDelete")}</DialogTitle>
            <DialogDescription>{t("students.confirmDeleteDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t("dashboard.cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <motion.div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
              ) : t("students.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
