import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/language-provider";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, ClipboardList, Search } from "lucide-react";
import { CEM_SUBJECTS, getSubjectsForLevel, calcWeightedAvg } from "@shared/subjects";
import type { StudentResult } from "@shared/types";
import type { Niveau } from "@shared/types";

const BASE = import.meta.env.BASE_URL;
const LEVELS: Niveau[] = ["1AM", "2AM", "3AM", "4AM"];
const LEVEL_LABELS: Record<Niveau, string> = { "1AM": "1ère AM", "2AM": "2ème AM", "3AM": "3ème AM", "4AM": "4ème AM" };

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as any } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

function avg2(v: number | null) {
  if (v === null) return "—";
  return v.toFixed(2);
}

// ── Grade entry modal ─────────────────────────────────────────────────────────
function GradeModal({
  result, annee, onClose, onSaved,
}: {
  result: StudentResult; annee: string; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [tri, setTri] = useState<1 | 2 | 3>(1);
  const [grades, setGrades] = useState<Record<string, Record<string, string>>>({ "1": {}, "2": {}, "3": {} });
  const [saving, setSaving] = useState(false);
  const subjects = getSubjectsForLevel(result.student.niveau as Niveau);

  // Pre-populate with existing grades
  useEffect(() => {
    const g: Record<string, Record<string, string>> = { "1": {}, "2": {}, "3": {} };
    for (const [t, subs] of Object.entries(result.scores)) {
      g[t] = {};
      for (const [sub, score] of Object.entries(subs)) {
        g[t]![sub] = String(score);
      }
    }
    setGrades(g);
  }, [result]);

  const setScore = (subject: string, val: string) => {
    setGrades(prev => ({ ...prev, [String(tri)]: { ...prev[String(tri)], [subject]: val } }));
  };

  const numericGrades = (t: number) => {
    const parsed: Record<string, number> = {};
    for (const [s, v] of Object.entries(grades[String(t)] ?? {})) {
      const n = parseFloat(v);
      if (!isNaN(n)) parsed[s] = Math.max(0, Math.min(20, n));
    }
    return parsed;
  };

  const triAvg = calcWeightedAvg(numericGrades(tri), subjects);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const t of [1, 2, 3] as const) {
        const g = numericGrades(t);
        if (Object.keys(g).length === 0) continue;
        const res = await fetch(`${BASE}api/grades/bulk`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: result.student.id, annee, trimestre: t, grades: g }),
        });
        if (!res.ok) throw new Error("Failed to save");
      }
      toast({ title: "تم حفظ النقاط ✓" });
      onSaved();
      onClose();
    } catch {
      toast({ variant: "destructive", title: "خطأ في الحفظ" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {result.student.nomPrenom}
            <span className="text-sm font-normal text-muted-foreground ms-2">
              {LEVEL_LABELS[result.student.niveau as Niveau]} — {result.student.classe}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Trimestre tabs */}
        <div className="flex gap-2 border-b pb-3">
          {([1, 2, 3] as const).map(t => {
            const a = calcWeightedAvg(numericGrades(t), subjects);
            return (
              <motion.button key={t} onClick={() => setTri(t)} whileTap={{ scale: 0.96 }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tri === t ? "bg-blue-600 text-white shadow" : "bg-muted hover:bg-muted/80 text-muted-foreground"
                }`}>
                الفصل {t}
                {a !== null && (
                  <span className={`block text-xs font-normal mt-0.5 ${a >= 10 ? "text-emerald-300" : "text-red-300"}`}>
                    {a.toFixed(2)}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Subject inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {subjects.map((s, i) => (
            <motion.div key={s.key} className="flex items-center gap-3"
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">{s.arLabel}</p>
                <p className="text-xs text-muted-foreground">معامل {s.coef}</p>
              </div>
              <Input
                type="number" min={0} max={20} step={0.25}
                placeholder="— /20"
                className="w-20 text-center font-mono text-base"
                value={grades[String(tri)]?.[s.key] ?? ""}
                onChange={e => setScore(s.key, e.target.value)}
              />
            </motion.div>
          ))}
        </div>

        {/* Average display */}
        <div className="flex items-center justify-between border-t pt-3 mt-1">
          <div className="text-sm text-muted-foreground">
            معدل الفصل {tri}:
            <span className={`ms-2 text-xl font-extrabold ${triAvg === null ? "text-muted-foreground" : triAvg >= 10 ? "text-emerald-600" : "text-red-500"}`}>
              {triAvg !== null ? triAvg.toFixed(2) : "—"}
            </span>
            {triAvg !== null && <span className="text-muted-foreground text-xs ms-1">/20</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>إلغاء</Button>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                {saving ? (
                  <motion.div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                    animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
                ) : "حفظ النقاط"}
              </Button>
            </motion.div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Results() {
  const { t } = useLanguage();
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StudentResult | null>(null);
  const [annee, setAnnee] = useState("");
  const [filters, setFilters] = useState({ niveau: "", classe: "", q: "" });
  const [listKey, setListKey] = useState(0);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.niveau) p.set("niveau", filters.niveau);
      if (filters.classe) p.set("classe", filters.classe);
      // Get school annee from API
      const res = await fetch(`${BASE}api/results?${p}`, { credentials: "include" });
      if (res.ok) { setResults(await res.json()); setListKey(k => k + 1); }
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const classes = [...new Set(results.map(r => r.student.classe))].sort();
  const displayed = filters.q
    ? results.filter(r => r.student.nomPrenom.toLowerCase().includes(filters.q.toLowerCase()))
    : results;

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 space-y-5 max-w-7xl mx-auto">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <motion.h1 className="text-2xl font-bold" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          {t("results.title")}
        </motion.h1>
      </div>

      {/* Filters */}
      <motion.div className="flex flex-wrap gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input className="ps-9" placeholder={t("students.search")} value={filters.q}
            onChange={e => setFilters(p => ({ ...p, q: e.target.value }))} />
        </div>
        <Select value={filters.niveau || "__all__"} onValueChange={v => setFilters(p => ({ ...p, niveau: v === "__all__" ? "" : v, classe: "" }))}>
          <SelectTrigger className="w-36"><SelectValue placeholder={t("students.filterLevel")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("students.allLevels")}</SelectItem>
            {LEVELS.map(l => <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.classe || "__all__"} onValueChange={v => setFilters(p => ({ ...p, classe: v === "__all__" ? "" : v }))}>
          <SelectTrigger className="w-32"><SelectValue placeholder={t("students.filterClass")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("students.allClasses")}</SelectItem>
            {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Table */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <motion.div key={i} className="h-12 rounded-lg bg-muted"
                animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }} />
            ))}
          </motion.div>
        ) : displayed.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-16 text-muted-foreground">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}>
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
            </motion.div>
            <p>{t("results.empty")}</p>
          </motion.div>
        ) : (
          <motion.div key={`table-${listKey}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-xl border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 sticky top-0">
                  <tr>
                    {["#", t("col.name"), t("col.level"), t("col.class"), t("col.t1"), t("col.t2"), t("col.t3"), t("col.avg"), t("col.result"), ""].map(h => (
                      <th key={h} className="px-3 py-3 text-start text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((r, i) => (
                    <motion.tr key={r.student.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.02, 0.4) }}
                      className={`border-t hover:bg-muted/30 transition-colors cursor-pointer ${i % 2 === 0 ? "" : "bg-muted/15"}`}
                      onClick={() => setSelected(r)}
                    >
                      <td className="px-3 py-3 text-muted-foreground text-xs font-mono">
                        {r.rank !== null ? (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            r.rank === 1 ? "bg-amber-100 text-amber-700" : r.rank === 2 ? "bg-slate-100 text-slate-600" : r.rank === 3 ? "bg-orange-100 text-orange-600" : "text-muted-foreground"
                          }`}>{r.rank}</span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-3 font-medium">{r.student.nomPrenom}</td>
                      <td className="px-3 py-3"><Badge variant="secondary" className="text-xs">{LEVEL_LABELS[r.student.niveau as Niveau]}</Badge></td>
                      <td className="px-3 py-3"><Badge variant="outline" className="font-bold">{r.student.classe}</Badge></td>
                      {[r.t1Avg, r.t2Avg, r.t3Avg].map((a, ti) => (
                        <td key={ti} className={`px-3 py-3 font-mono text-sm ${a === null ? "text-muted-foreground" : a >= 10 ? "text-emerald-600" : "text-red-500"}`}>
                          {avg2(a)}
                        </td>
                      ))}
                      <td className={`px-3 py-3 font-bold font-mono ${r.annualAvg === null ? "text-muted-foreground" : r.annualAvg >= 10 ? "text-emerald-600" : "text-red-500"}`}>
                        {avg2(r.annualAvg)}
                      </td>
                      <td className="px-3 py-3">
                        {r.passed === null ? <span className="text-muted-foreground text-xs">—</span>
                          : r.passed
                            ? <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{t("val.admis")}</span>
                            : <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">{t("val.non_admis")}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); setSelected(r); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </motion.div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selected && (
        <GradeModal result={selected} annee={annee || "2025-2026"} onClose={() => setSelected(null)} onSaved={fetchResults} />
      )}
    </motion.div>
  );
}
