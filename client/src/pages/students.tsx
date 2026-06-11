import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/language-provider";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, Search, Users, FileSpreadsheet, X } from "lucide-react";
import type { Student, Niveau, Sexe, Statut } from "@shared/types";

const BASE = import.meta.env.BASE_URL;

const LEVELS: Niveau[] = ["1AM", "2AM", "3AM", "4AM"];
const LEVEL_LABELS: Record<Niveau, string> = { "1AM": "1ère AM", "2AM": "2ème AM", "3AM": "3ème AM", "4AM": "4ème AM" };

export default function Students() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [filters, setFilters] = useState<{ q: string; niveau: string; classe: string; sexe: string; statut: string; annee: string }>({
    q: "", niveau: "", classe: "", sexe: "", statut: "", annee: "",
  });

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
      if (res.ok) { const d = await res.json(); setStudents(d.students); }
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const classes = [...new Set(students.map(s => s.classe))].sort();

  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [importResultOpen, setImportResultOpen] = useState(false);

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

  const activeFilters = Object.entries(filters).filter(([k, v]) => v && k !== "q");

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">{t("students.title")}</h1>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
          <Button className="gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t("students.importing")}</>
              : <><FileSpreadsheet className="w-4 h-4" />{t("students.import")}</>}
          </Button>
          {students.length > 0 && (
            <Button variant="outline" className="gap-2 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t("students.delete")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="ps-9" placeholder={t("students.search")} value={filters.q}
            onChange={e => setFilters(p => ({ ...p, q: e.target.value }))} />
        </div>
        <Select value={filters.niveau || "__all__"} onValueChange={v => setFilter("niveau", v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder={t("students.filterLevel")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("students.allLevels")}</SelectItem>
            {LEVELS.map(l => <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.classe || "__all__"} onValueChange={v => setFilter("classe", v)}>
          <SelectTrigger className="w-28"><SelectValue placeholder={t("students.filterClass")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("students.allClasses")}</SelectItem>
            {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.sexe || "__all__"} onValueChange={v => setFilter("sexe", v)}>
          <SelectTrigger className="w-28"><SelectValue placeholder={t("students.filterGender")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("students.allGenders")}</SelectItem>
            <SelectItem value="M">{t("val.male")}</SelectItem>
            <SelectItem value="F">{t("val.female")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.statut || "__all__"} onValueChange={v => setFilter("statut", v)}>
          <SelectTrigger className="w-32"><SelectValue placeholder={t("students.filterStatus")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("students.allStatuts")}</SelectItem>
            <SelectItem value="nouveau">{t("val.nouveau")}</SelectItem>
            <SelectItem value="redoublant">{t("val.redoublant")}</SelectItem>
          </SelectContent>
        </Select>
        {activeFilters.length > 0 && (
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground h-8"
            onClick={() => setFilters({ q: "", niveau: "", classe: "", sexe: "", statut: "", annee: "" })}>
            <X className="w-3.5 h-3.5" /> Reset
          </Button>
        )}
      </div>

      {/* Count badge */}
      {!loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span><span className="font-bold text-foreground">{students.length}</span> {t("students.title").toLowerCase()}</span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>{t("students.empty")}</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  {[t("col.name"), t("col.birth"), t("col.level"), t("col.class"), t("col.gender"), t("col.status"), t("col.result")].map(h => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.id} className={`border-t transition-colors hover:bg-muted/40 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{s.nomPrenom}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{s.dateNaissance || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="font-semibold text-xs">{LEVEL_LABELS[s.niveau as Niveau]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-bold">{s.classe}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        s.sexe === "M" ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" : "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300"
                      }`}>
                        {s.sexe === "M" ? t("val.male") : t("val.female")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                        s.statut === "redoublant" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      }`}>
                        {s.statut === "redoublant" ? t("val.redoublant") : t("val.nouveau")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.resultat === "admis" ? (
                        <span className="text-xs font-semibold text-green-600 dark:text-green-400">{t("val.admis")}</span>
                      ) : s.resultat === "non_admis" ? (
                        <span className="text-xs font-semibold text-red-500">{t("val.non_admis")}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Import Result Dialog */}
      <Dialog open={importResultOpen} onOpenChange={setImportResultOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{importResult?.imported ? t("students.importSuccess") : t("students.importError")}</DialogTitle>
          </DialogHeader>
          {importResult && (
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="flex-1 rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                  <p className="text-xs text-muted-foreground">تم الاستيراد</p>
                </div>
                <div className="flex-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{importResult.skipped}</p>
                  <p className="text-xs text-muted-foreground">تم التخطي</p>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">أسباب التخطي (أول {importResult.errors.length} خطأ)</p>
                  <div className="rounded-lg border bg-muted/40 p-3 max-h-48 overflow-y-auto space-y-1">
                    {importResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600 dark:text-red-400 font-mono">{e}</p>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    تأكد أن الملف يحتوي على أعمدة: <span className="font-semibold">الاسم، المستوى، القسم، الجنس</span>
                  </p>
                </div>
              )}
              {importResult.imported === 0 && importResult.errors.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  لم يتم التعرف على أعمدة الملف. تأكد أن الصف الأول يحتوي على عناوين الأعمدة.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setImportResultOpen(false)}>حسناً</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("students.confirmDelete")}</DialogTitle>
            <DialogDescription>{t("students.confirmDeleteDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t("dashboard.cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "..." : t("students.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
