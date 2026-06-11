import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/language-provider";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, Search, Users, FileSpreadsheet, X, CheckCircle2, AlertCircle } from "lucide-react";
import { CountUp } from "@/components/count-up";
import type { Student, Niveau, Sexe, Statut } from "@shared/types";

const BASE = import.meta.env.BASE_URL;
const LEVELS: Niveau[] = ["1AM", "2AM", "3AM", "4AM"];
const LEVEL_LABELS: Record<Niveau, string> = { "1AM": "1ère AM", "2AM": "2ème AM", "3AM": "3ème AM", "4AM": "4ème AM" };

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as any } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

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
  const [listKey, setListKey] = useState(0); // key to re-trigger table animation

  const [filters, setFilters] = useState({ q: "", niveau: "", classe: "", sexe: "", statut: "", annee: "" });

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
        <motion.h1 className="text-2xl font-bold text-foreground"
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
          {t("students.title")}
        </motion.h1>

        <motion.div className="flex items-center gap-2"
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
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

      {/* Filters */}
      <motion.div className="flex flex-wrap gap-3 items-center"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input className="ps-9 transition-shadow focus:shadow-md" placeholder={t("students.search")}
            value={filters.q} onChange={e => setFilters(p => ({ ...p, q: e.target.value }))} />
        </div>
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
                  <p className="text-3xl font-extrabold text-emerald-600">
                    <CountUp to={importResult.imported} duration={0.8} />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">تم الاستيراد</p>
                </motion.div>
                <motion.div className="flex-1 rounded-xl bg-amber-50 dark:bg-amber-950/30 p-4 text-center"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                  <p className="text-3xl font-extrabold text-amber-600">
                    <CountUp to={importResult.skipped} duration={0.8} />
                  </p>
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
                  <p className="text-xs text-muted-foreground">
                    تأكد أن الملف يحتوي على أعمدة: <span className="font-semibold">الاسم، المستوى، القسم، الجنس</span>
                  </p>
                </motion.div>
              )}
              {importResult.imported === 0 && importResult.errors.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  لم يتم التعرف على أعمدة الملف. تأكد أن الصف الأول يحتوي على عناوين الأعمدة.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button onClick={() => setImportResultOpen(false)}>حسناً</Button>
            </motion.div>
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
