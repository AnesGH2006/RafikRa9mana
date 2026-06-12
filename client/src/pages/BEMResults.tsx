import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, TrendingUp, Users, UserCheck, UserX, BarChart3,
  Search, ChevronDown, Award, Star, Upload, FileSpreadsheet,
  GraduationCap, BookOpen, Atom, Globe, Music2, AlertCircle,
  Calculator, Dumbbell, Landmark, Leaf, Scroll, RefreshCcw,
  CheckCircle2, XCircle, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CountUp } from "@/components/count-up";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

const BASE = import.meta.env.BASE_URL;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BEMStudent {
  num: number;
  reg: number;
  name: string;
  dob: string;
  avg_annual: number;
  avg_bem: number;
  avg_trans: number;
  math: number;
  arabic: number;
  french: number;
  english: number;
  islamic: number;
  civic: number;
  history: number;
  science: number;
  physics: number;
  music: number;
  sport: number;
}

// ── BEM Import logic (mirrored from BEMImport.tsx) ────────────────────────────
const BEM_SUBJECTS_IMPORT = [
  { key: "arabic",      arLabel: "اللغة العربية",         coef: 5 },
  { key: "math",        arLabel: "الرياضيات",             coef: 4 },
  { key: "french",      arLabel: "اللغة الفرنسية",        coef: 3 },
  { key: "islamic",     arLabel: "التربية الإسلامية",      coef: 2 },
  { key: "civic",       arLabel: "التربية المدنية",        coef: 1 },
  { key: "history_geo", arLabel: "التاريخ والجغرافيا",     coef: 3 },
  { key: "science",     arLabel: "العلوم الطبيعية",        coef: 2 },
  { key: "physics",     arLabel: "الفيزياء والتكنولوجيا",  coef: 2 },
  { key: "english",     arLabel: "اللغة الإنجليزية",       coef: 2 },
  { key: "sport",       arLabel: "التربية البدنية",       coef: 1 },
];

const COL_MAP: Record<string, string> = {
  "الاسم واللقب": "nomPrenom", "nom et prénom": "nomPrenom", "الاسم": "nomPrenom",
  "اللقب و الإسم": "nomPrenom", "اللقب والإسم": "nomPrenom",
  "القسم": "classe", "classe": "classe",
  "رقم التسجيل": "inscriptionNum", "numéro d'inscription": "inscriptionNum",
  "المعدل السنوي": "avg_annual", "moyenne annuelle": "avg_annual",
  "معدل ش ت م": "avg_bem", "معدل الشهادة": "avg_bem",
  "معدل الإنتقال": "avg_trans",
  "اللغة العربية": "arabic",      "العربية ش ت م": "arabic",    "arabe": "arabic",
  "الرياضيات": "math",             "رياضيات ش ت م": "math",      "mathématiques": "math",
  "اللغة الفرنسية": "french",      "الفرنسية ش ت م": "french",   "français": "french",
  "التربية الإسلامية": "islamic",  "ت إسلامية ش ت م": "islamic",
  "التربية المدنية": "civic",      "ت مدنية ش ت م": "civic",
  "التاريخ والجغرافيا": "history_geo", "تاريخ جغرافيا ش ت م": "history_geo",
  "العلوم الطبيعية": "science",    "علوم ط ش ت م": "science",
  "الفيزياء والتكنولوجيا": "physics", "فيزياء ش ت م": "physics",
  "اللغة الإنجليزية": "english",   "الإنجليزية ش ت م": "english",
  "التربية البدنية": "sport",       "ت بدنية ش ت م": "sport",
  "التربية الموسيقية": "music",     "ت موسيقية ش ت م": "music",
};

interface ParsedRow {
  nomPrenom: string; classe: string; inscriptionNum: string;
  grades: Record<string, number | null>;
  avg_annual: number | null; avg_bem: number | null; avg_trans: number | null;
  passed: boolean;
}
interface ParseError { row: number; message: string }
interface ParseResult { rows: ParsedRow[]; errors: ParseError[]; unmappedCols: string[] }

function parseWorkbook(wb: XLSX.WorkBook): ParseResult {
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!raw.length) return { rows: [], errors: [{ row: 0, message: "الملف فارغ" }], unmappedCols: [] };

  const headerMap: Record<string, string> = {};
  const unmappedCols: string[] = [];
  for (const col of Object.keys(raw[0]!)) {
    const mapped = COL_MAP[col.trim()] ?? COL_MAP[col.trim().toLowerCase()];
    if (mapped) headerMap[col] = mapped;
    else if (col.trim()) unmappedCols.push(col.trim());
  }

  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];

  raw.forEach((rawRow, idx) => {
    const rowNum = idx + 2;
    const mapped: Record<string, string> = {};
    for (const [col, val] of Object.entries(rawRow)) {
      const key = headerMap[col];
      if (key) mapped[key] = String(val).trim();
    }
    if (!mapped.nomPrenom) { errors.push({ row: rowNum, message: "اسم الطالب مفقود" }); return; }

    const grades: Record<string, number | null> = {};
    for (const s of BEM_SUBJECTS_IMPORT) {
      const raw = mapped[s.key];
      if (!raw || raw === "") { grades[s.key] = null; continue; }
      const n = parseFloat(raw.replace(",", "."));
      if (isNaN(n) || n < 0 || n > 20) {
        errors.push({ row: rowNum, message: `نقطة غير صالحة في "${s.arLabel}": ${raw}` });
        grades[s.key] = null;
      } else { grades[s.key] = n; }
    }

    const parseNum = (k: string) => { const v = mapped[k]; return v ? parseFloat(v.replace(",", ".")) || null : null; };
    const avg_bem   = parseNum("avg_bem");
    const avg_annual = parseNum("avg_annual");
    const avg_trans  = parseNum("avg_trans");

    rows.push({
      nomPrenom: mapped.nomPrenom ?? "",
      classe: mapped.classe ?? "",
      inscriptionNum: mapped.inscriptionNum ?? "",
      grades, avg_annual, avg_bem, avg_trans,
      passed: avg_bem !== null && avg_bem >= 9,
    });
  });
  return { rows, errors, unmappedCols };
}

// ── Analyzer constants ────────────────────────────────────────────────────────
const SUBJECTS = [
  { key: "arabic",   label: "اللغة العربية",         icon: Scroll,     coef: 5 },
  { key: "math",     label: "الرياضيات",              icon: Calculator, coef: 4 },
  { key: "french",   label: "اللغة الفرنسية",         icon: Globe,      coef: 3 },
  { key: "history",  label: "التاريخ والجغرافيا",      icon: Landmark,   coef: 3 },
  { key: "islamic",  label: "التربية الإسلامية",       icon: BookOpen,   coef: 2 },
  { key: "science",  label: "العلوم الطبيعية",         icon: Leaf,       coef: 2 },
  { key: "physics",  label: "الفيزياء والتكنولوجيا",   icon: Atom,       coef: 2 },
  { key: "english",  label: "اللغة الإنجليزية",        icon: Globe,      coef: 2 },
  { key: "civic",    label: "التربية المدنية",         icon: Users,      coef: 1 },
  { key: "music",    label: "التربية الموسيقية",       icon: Music2,     coef: 1 },
  { key: "sport",    label: "التربية البدنية",         icon: Dumbbell,   coef: 1 },
] as const;

const TABS = [
  { id: "stats",    label: "الإحصاءات", icon: BarChart3  },
  { id: "toppers",  label: "النجباء",   icon: Trophy     },
  { id: "passed",   label: "الناجحون",  icon: UserCheck  },
  { id: "failed",   label: "الراسبون",  icon: UserX      },
  { id: "subjects", label: "المواد",    icon: BookOpen   },
  { id: "all",      label: "الكل",      icon: Users      },
] as const;

type TabId = typeof TABS[number]["id"];
type SubjectKey = typeof SUBJECTS[number]["key"];
const MEDALS = ["🥇", "🥈", "🥉"];

function getMention(avg: number) {
  if (avg >= 18) return { label: "ممتاز رفيع",  cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" };
  if (avg >= 16) return { label: "ممتاز",       cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" };
  if (avg >= 14) return { label: "جيد جداً",    cls: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" };
  if (avg >= 12) return { label: "جيد",         cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" };
  if (avg >= 9)  return { label: "مقبول",       cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
  return              { label: "راسب",          cls: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300" };
}

function gradeColor(v: number) {
  if (v >= 16) return "text-emerald-600 dark:text-emerald-400";
  if (v >= 14) return "text-sky-600 dark:text-sky-400";
  if (v >= 12) return "text-blue-600 dark:text-blue-400";
  if (v >= 9)  return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

// ── Animation variants ────────────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
};
const cardVariants = {
  initial: { opacity: 0, y: 20, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: "easeOut" as const } },
};
const rowVariants = {
  initial: { opacity: 0, x: -12 },
  animate: (i: number) => ({
    opacity: 1, x: 0,
    transition: { delay: Math.min(i * 0.03, 0.4), duration: 0.3, ease: "easeOut" },
  }),
};

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, colorBg, colorText, colorLight, icon: Icon }: {
  label: string; value: number | string; sub?: string;
  colorBg: string; colorText: string; colorLight: string; icon: React.ElementType;
}) {
  return (
    <motion.div variants={cardVariants} whileHover={{ y: -3, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}>
      <Card className={`border-0 shadow-sm ${colorLight} overflow-hidden relative`}>
        <div className={`absolute inset-0 opacity-5 ${colorBg}`} />
        <CardContent className="pt-4 pb-3 relative">
          <div className="flex items-start gap-3">
            <motion.div className={`w-10 h-10 rounded-xl ${colorBg} flex items-center justify-center shrink-0`}
              initial={{ scale: 0.5, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}>
              <Icon className={`w-5 h-5 ${colorText}`} />
            </motion.div>
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-0.5">{label}</p>
              <p className={`text-2xl font-extrabold leading-none tracking-tight ${colorText}`}>
                {typeof value === "number" ? <CountUp to={value} /> : value}
              </p>
              {sub && <p className="text-[11px] text-muted-foreground mt-1 truncate max-w-[110px]">{sub}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── ProgressRow ───────────────────────────────────────────────────────────────
function ProgressRow({ leftLabel, leftVal, rightLabel, rightVal, total, leftColor, rightColor }: {
  leftLabel: string; leftVal: number; rightLabel: string; rightVal: number;
  total: number; leftColor: string; rightColor: string;
}) {
  const lp = total > 0 ? (leftVal  / total) * 100 : 0;
  const rp = total > 0 ? (rightVal / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className={`font-semibold ${leftColor}`}>{leftLabel} — <CountUp to={leftVal} /> ({lp.toFixed(1)}%)</span>
        <span className={`font-semibold ${rightColor}`}>{rightLabel} — <CountUp to={rightVal} /> ({rp.toFixed(1)}%)</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden flex gap-0.5">
        <motion.div className={`h-full rounded-full ${leftColor.replace("text-","bg-")}`}
          initial={{ width: 0 }} animate={{ width: `${lp}%` }} transition={{ duration: 1.1, ease: "easeOut", delay: 0.2 }} />
        <motion.div className={`h-full rounded-full ${rightColor.replace("text-","bg-")}`}
          initial={{ width: 0 }} animate={{ width: `${rp}%` }} transition={{ duration: 1.1, ease: "easeOut", delay: 0.3 }} />
      </div>
    </div>
  );
}

// ── Import Dialog ─────────────────────────────────────────────────────────────
function ImportDialog({ open, onClose, onImported }: {
  open: boolean;
  onClose: () => void;
  onImported: (rows: ParsedRow[]) => void;
}) {
  const { toast } = useToast();
  const inputRef  = useRef<HTMLInputElement>(null);
  const [dragging,     setDragging]     = useState(false);
  const [fileName,     setFileName]     = useState<string | null>(null);
  const [parseResult,  setParseResult]  = useState<ParseResult | null>(null);
  const [importing,    setImporting]    = useState(false);
  const [showErrors,   setShowErrors]   = useState(false);
  const [annee,        setAnnee]        = useState("2025-2026");

  const reset = () => {
    setFileName(null); setParseResult(null); setShowErrors(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const processFile = useCallback((file: File) => {
    setFileName(file.name); setParseResult(null);
    const reader = new FileReader();
    reader.onload = e => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const result = parseWorkbook(wb);
      setParseResult(result);
      if (!result.rows.length) toast({ variant: "destructive", title: "لم يُعثر على بيانات صالحة" });
    };
    reader.readAsArrayBuffer(file);
  }, [toast]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) processFile(f);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) processFile(f);
  };

  const handleImport = async () => {
    if (!parseResult?.rows.length) return;
    setImporting(true);
    try {
      const res = await fetch(`${BASE}api/bem/import`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annee, students: parseResult.rows }),
      });
      if (!res.ok) throw new Error();
      toast({ title: `✅ تم استيراد ${parseResult.rows.length} مترشح بنجاح` });
      onImported(parseResult.rows);
      onClose();
      reset();
    } catch {
      toast({ variant: "destructive", title: "فشل الاستيراد، حاول مجدداً" });
    } finally { setImporting(false); }
  };

  const hasData = !!(parseResult?.rows.length);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            استيراد نتائج BEM
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Year selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground shrink-0">السنة الدراسية:</span>
            <select className="text-sm border rounded-md px-2 py-1.5 bg-background flex-1"
              value={annee} onChange={e => setAnnee(e.target.value)}>
              {["2023-2024","2024-2025","2025-2026"].map(y =>
                <option key={y} value={y}>{y}</option>)}
            </select>
            {fileName && (
              <Button variant="ghost" size="sm" onClick={reset} className="gap-1 text-muted-foreground shrink-0">
                <RefreshCcw className="w-3.5 h-3.5" /> ملف جديد
              </Button>
            )}
          </div>

          {/* Drop zone / file info */}
          <AnimatePresence mode="wait">
            {!fileName ? (
              <motion.div key="drop"
                initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all select-none
                  ${dragging
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 scale-[1.01]"
                    : "border-muted-foreground/25 hover:border-blue-400 hover:bg-muted/30"}`}>
                <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
                <motion.div animate={dragging ? { y: -5 } : { y: 0 }} transition={{ type: "spring", stiffness: 300 }}>
                  <Upload className="w-9 h-9 mx-auto mb-2 text-blue-500 opacity-80" />
                </motion.div>
                <p className="font-semibold text-sm">اسحب الملف هنا أو انقر للاختيار</p>
                <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx / .xls) أو CSV</p>
              </motion.div>
            ) : (
              <motion.div key="file"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-xl border bg-muted/20 px-4 py-3 flex items-center gap-3">
                <FileSpreadsheet className="w-7 h-7 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{fileName}</p>
                  {parseResult && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {parseResult.rows.length} سطر صالح
                      {parseResult.errors.length > 0 && ` · ${parseResult.errors.length} تحذير`}
                      {parseResult.unmappedCols.length > 0 && ` · ${parseResult.unmappedCols.length} عمود غير معروف`}
                    </p>
                  )}
                </div>
                {parseResult?.rows.length
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Warnings */}
          <AnimatePresence>
            {parseResult && parseResult.errors.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 px-4 py-3">
                <button className="flex items-center gap-2 w-full text-sm font-semibold text-amber-700 dark:text-amber-400"
                  onClick={() => setShowErrors(v => !v)}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {parseResult.errors.length} تحذير أثناء القراءة
                  <motion.div animate={{ rotate: showErrors ? 0 : -90 }} transition={{ duration: 0.2 }} className="ms-auto">
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {showErrors && (
                    <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} className="mt-2 space-y-1 overflow-hidden">
                      {parseResult.errors.slice(0, 10).map((e, i) => (
                        <li key={i} className="text-xs text-amber-700 dark:text-amber-300 flex gap-2">
                          <span className="font-mono opacity-60">س{e.row}</span> {e.message}
                        </li>
                      ))}
                      {parseResult.errors.length > 10 && (
                        <li className="text-xs text-amber-600 opacity-70">…و{parseResult.errors.length - 10} أخرى</li>
                      )}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {parseResult && parseResult.unmappedCols.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-xl border px-4 py-3 text-xs text-muted-foreground bg-muted/30">
                <span className="font-semibold">أعمدة غير معروفة (تُجاهَل): </span>
                {parseResult.unmappedCols.join(" · ")}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick preview count */}
          {hasData && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900 px-4 py-3 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  {parseResult!.rows.length} مترشح جاهز للاستيراد
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {parseResult!.rows.filter(r => r.passed).length} ناجح &nbsp;·&nbsp;
                  {parseResult!.rows.filter(r => !r.passed).length} راسب
                </p>
              </div>
            </motion.div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => { onClose(); reset(); }}>إلغاء</Button>
            <Button onClick={handleImport} disabled={!hasData || importing}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              {importing ? (
                <>
                  <motion.div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                    animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
                  جارٍ الاستيراد…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  استيراد {hasData ? parseResult!.rows.length : ""} مترشح
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface Props { students: BEMStudent[] }

export default function BEMAnalyzer({ students: initialStudents }: Props) {
  const [students,    setStudents]    = useState<BEMStudent[]>(initialStudents);
  const [activeTab,   setActiveTab]   = useState<TabId>("stats");
  const [search,      setSearch]      = useState("");
  const [showDistrib, setShowDistrib] = useState(false);
  const [importOpen,  setImportOpen]  = useState(false);

  // After import: merge parsed rows into students state
  const handleImported = useCallback((rows: ParsedRow[]) => {
    const mapped: BEMStudent[] = rows.map((r, i) => ({
      num:         i + 1,
      reg:         parseInt(r.inscriptionNum) || i + 1,
      name:        r.nomPrenom,
      dob:         "",
      avg_annual:  r.avg_annual ?? 0,
      avg_bem:     r.avg_bem    ?? 0,
      avg_trans:   r.avg_trans  ?? 0,
      math:        r.grades["math"]        ?? 0,
      arabic:      r.grades["arabic"]      ?? 0,
      french:      r.grades["french"]      ?? 0,
      english:     r.grades["english"]     ?? 0,
      islamic:     r.grades["islamic"]     ?? 0,
      civic:       r.grades["civic"]       ?? 0,
      history:     r.grades["history_geo"] ?? 0,
      science:     r.grades["science"]     ?? 0,
      physics:     r.grades["physics"]     ?? 0,
      music:       r.grades["music"]       ?? 0,
      sport:       r.grades["sport"]       ?? 0,
    }));
    setStudents(mapped);
    setActiveTab("stats");
  }, []);

  // ── Derived stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total     = students.length;
    const passed    = students.filter(s => s.avg_bem >= 9);
    const failed    = students.filter(s => s.avg_bem < 9);
    const top14     = students.filter(s => s.avg_bem >= 14);
    const avgs      = students.map(s => s.avg_bem);
    const mean      = total > 0 ? avgs.reduce((a, b) => a + b, 0) / total : 0;
    const max       = total > 0 ? Math.max(...avgs) : 0;
    const maxStudent = students.find(s => s.avg_bem === max);
    const passRate  = total > 0 ? (passed.length / total) * 100 : 0;

    const distribRanges = [
      { label: "18–20 ممتاز رفيع", min: 18, max: 21, color: "bg-violet-500" },
      { label: "16–18 ممتاز",      min: 16, max: 18, color: "bg-blue-500"   },
      { label: "14–16 جيد جداً",   min: 14, max: 16, color: "bg-cyan-500"   },
      { label: "12–14 جيد",        min: 12, max: 14, color: "bg-teal-500"   },
      { label: "9–12 مقبول",       min: 9,  max: 12, color: "bg-amber-500"  },
      { label: "أقل من 9 راسب",    min: 0,  max: 9,  color: "bg-red-500"    },
    ].map(r => ({ ...r, count: students.filter(s => s.avg_bem >= r.min && s.avg_bem < r.max).length }));

    const subjectStats = SUBJECTS.map(sub => {
      const vals = students.map(s => s[sub.key as SubjectKey] as number).filter(v => v > 0);
      const avg  = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      const pass = vals.filter(v => v >= 9).length;
      return { ...sub, avg, pass, total: vals.length };
    }).sort((a, b) => b.avg - a.avg);

    return { total, passed, failed, top14, mean, max, maxStudent, passRate, distribRanges, subjectStats };
  }, [students]);

  // ── Filtered lists ───────────────────────────────────────────────────────
  const filteredAll = useMemo(() => {
    const q = search.toLowerCase();
    return [...students].sort((a, b) => b.avg_bem - a.avg_bem)
      .filter(s => !q || s.name.toLowerCase().includes(q));
  }, [students, search]);

  const filteredPassed = useMemo(() => filteredAll.filter(s => s.avg_bem >= 9), [filteredAll]);
  const filteredFailed = useMemo(() => filteredAll.filter(s => s.avg_bem < 9),  [filteredAll]);

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!students.length) {
    return (
      <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
        className="p-6 max-w-5xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[55vh] text-center gap-5">
          <motion.div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center"
            animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
            <GraduationCap className="w-10 h-10 text-muted-foreground opacity-40" />
          </motion.div>
          <div>
            <h2 className="text-xl font-bold mb-1">لا توجد نتائج بعد</h2>
            <p className="text-sm text-muted-foreground">استورد ملف Excel من منصة الوزارة لبدء التحليل</p>
          </div>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Button onClick={() => setImportOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 px-6 py-5 text-base rounded-xl shadow-lg shadow-blue-500/20">
              <Upload className="w-5 h-5" />
              استيراد نتائج BEM
            </Button>
          </motion.div>
        </div>
        <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={handleImported} />
      </motion.div>
    );
  }

  // ── Tab renders ──────────────────────────────────────────────────────────
  const renderStats = () => (
    <div className="space-y-5">
      <motion.div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3"
        variants={{ animate: { transition: { staggerChildren: 0.07 } } }} initial="initial" animate="animate">
        <StatCard label="إجمالي المترشحين" value={stats.total} icon={Users}
          colorBg="bg-blue-500" colorText="text-blue-600 dark:text-blue-400" colorLight="bg-blue-50 dark:bg-blue-950/30" />
        <StatCard label="الناجحون" value={stats.passed.length} sub={`${stats.passRate.toFixed(1)}% نسبة النجاح`}
          icon={UserCheck} colorBg="bg-emerald-500" colorText="text-emerald-600 dark:text-emerald-400" colorLight="bg-emerald-50 dark:bg-emerald-950/30" />
        <StatCard label="الراسبون" value={stats.failed.length} icon={UserX}
          colorBg="bg-red-500" colorText="text-red-600 dark:text-red-400" colorLight="bg-red-50 dark:bg-red-950/30" />
        <StatCard label="المتفوقون ≥14" value={stats.top14.length} icon={Star}
          colorBg="bg-amber-500" colorText="text-amber-600 dark:text-amber-400" colorLight="bg-amber-50 dark:bg-amber-950/30" />
        <StatCard label="المتوسط العام" value={stats.mean.toFixed(2)} icon={TrendingUp}
          colorBg="bg-violet-500" colorText="text-violet-600 dark:text-violet-400" colorLight="bg-violet-50 dark:bg-violet-950/30" />
        <StatCard label="أعلى معدل" value={stats.max.toFixed(2)} sub={stats.maxStudent?.name} icon={Trophy}
          colorBg="bg-sky-500" colorText="text-sky-600 dark:text-sky-400" colorLight="bg-sky-50 dark:bg-sky-950/30" />
      </motion.div>

      <motion.div variants={cardVariants} initial="initial" animate="animate">
        <Card className="shadow-sm">
          <CardContent className="pt-5 pb-4">
            <ProgressRow leftLabel="ناجح" leftVal={stats.passed.length}
              rightLabel="راسب" rightVal={stats.failed.length} total={stats.total}
              leftColor="text-emerald-600" rightColor="text-red-500" />
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={cardVariants} initial="initial" animate="animate">
        <Card className="shadow-sm">
          <CardHeader className="pb-0">
            <button className="w-full flex items-center gap-2 text-base font-semibold text-foreground"
              onClick={() => setShowDistrib(v => !v)}>
              <Award className="w-5 h-5 text-amber-500" />
              توزيع التقديرات
              <motion.div className="ms-auto" animate={{ rotate: showDistrib ? 0 : -90 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </button>
          </CardHeader>
          <AnimatePresence initial={false}>
            {showDistrib && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                <CardContent className="pt-3">
                  <div className="space-y-2.5">
                    {stats.distribRanges.map(r => {
                      const pct = stats.total > 0 ? (r.count / stats.total) * 100 : 0;
                      return (
                        <div key={r.label} className="flex items-center gap-3 text-sm">
                          <span className="w-36 text-right text-muted-foreground shrink-0 text-xs">{r.label}</span>
                          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                            <motion.div className={`h-full rounded-full ${r.color}`}
                              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }} />
                          </div>
                          <span className="w-20 text-right font-semibold text-xs">
                            {r.count} ({pct.toFixed(1)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      <motion.div variants={cardVariants} initial="initial" animate="animate">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" /> متوسط كل مادة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.subjectStats.map((s, i) => {
                const pct = (s.avg / 20) * 100;
                const bar = s.avg >= 14 ? "bg-emerald-500" : s.avg >= 9 ? "bg-blue-500" : "bg-red-400";
                return (
                  <motion.div key={s.key} className="flex items-center gap-3 text-sm"
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}>
                    <span className="w-40 text-right text-muted-foreground text-xs shrink-0">{s.label}</span>
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <motion.div className={`h-full rounded-full ${bar}`}
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.04 }} />
                    </div>
                    <span className={`w-12 text-right font-bold text-xs font-mono ${gradeColor(s.avg)}`}>{s.avg.toFixed(2)}</span>
                    <span className="w-20 text-right text-muted-foreground text-xs">{Math.round(s.pass / (s.total||1) * 100)}% ناجح</span>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );

  const renderToppers = () => {
    const list = [...students].filter(s => s.avg_bem >= 14).sort((a, b) => b.avg_bem - a.avg_bem);
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            النجباء — {list.length} تلميذ (معدل ≥ 14)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs uppercase">
                  <th className="pb-2 pt-3 px-4 text-center w-10">#</th>
                  <th className="pb-2 pt-3 px-4 text-start">الاسم واللقب</th>
                  <th className="pb-2 pt-3 px-4 text-center">رقم التسجيل</th>
                  <th className="pb-2 pt-3 px-4 text-center">التقدير</th>
                  <th className="pb-2 pt-3 px-4 text-center">معدل البيام</th>
                  <th className="pb-2 pt-3 px-4 text-center">المعدل السنوي</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s, i) => {
                  const m = getMention(s.avg_bem);
                  return (
                    <motion.tr key={s.num} custom={i} variants={rowVariants} initial="initial" animate="animate"
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-center">
                        {i < 3 ? <span className="text-lg">{MEDALS[i]}</span>
                               : <span className="text-muted-foreground text-xs font-mono">{i+1}</span>}
                      </td>
                      <td className="py-3 px-4 font-medium">{s.name}</td>
                      <td className="py-3 px-4 text-center text-muted-foreground font-mono text-xs">{s.reg}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m.cls}`}>{m.label}</span>
                      </td>
                      <td className={`py-3 px-4 text-center font-extrabold text-base font-mono ${gradeColor(s.avg_bem)}`}>
                        {s.avg_bem.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center text-muted-foreground text-xs font-mono">
                        {s.avg_annual.toFixed(2)}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderList = (list: BEMStudent[], type: "passed" | "failed") => (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className={`text-base flex items-center gap-2 ${type === "failed" ? "text-red-500" : ""}`}>
            {type === "passed"
              ? <><UserCheck className="w-5 h-5 text-emerald-500" /> الناجحون — {list.length} تلميذ</>
              : <><UserX className="w-5 h-5 text-red-500" /> الراسبون — {list.length} تلميذ</>}
          </CardTitle>
          <div className="relative">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم..." className="h-8 text-xs pe-8 w-44" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {type === "failed" && list.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <motion.div animate={{ y: [0,-6,0] }} transition={{ duration: 2.5, repeat: Infinity }}>
              <UserCheck className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-60" />
            </motion.div>
            <p className="text-sm">🎉 لا يوجد راسبون — جميعهم ناجحون!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs uppercase">
                  <th className="pb-2 pt-3 px-4 text-center w-10">#</th>
                  <th className="pb-2 pt-3 px-4 text-start">الاسم واللقب</th>
                  <th className="pb-2 pt-3 px-4 text-center">ت. التسجيل</th>
                  {type === "passed"
                    ? <><th className="pb-2 pt-3 px-4 text-center">التقدير</th><th className="pb-2 pt-3 px-4 text-center">معدل البيام</th><th className="pb-2 pt-3 px-4 text-center">م. السنوي</th></>
                    : <><th className="pb-2 pt-3 px-4 text-center">معدل البيام</th><th className="pb-2 pt-3 px-4 text-center">الحالة</th><th className="pb-2 pt-3 px-4 text-center">ينقصه</th></>}
                </tr>
              </thead>
              <tbody>
                {list.map((s, i) => {
                  const m = getMention(s.avg_bem);
                  return (
                    <motion.tr key={s.num} custom={i} variants={rowVariants} initial="initial" animate="animate"
                      className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i%2===1?"bg-muted/10":""}`}>
                      <td className="py-2.5 px-4 text-center text-muted-foreground text-xs font-mono">{i+1}</td>
                      <td className="py-2.5 px-4 font-medium">{s.name}</td>
                      <td className="py-2.5 px-4 text-center text-muted-foreground font-mono text-xs">{s.reg}</td>
                      {type === "passed" ? (
                        <>
                          <td className="py-2.5 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${m.cls}`}>{m.label}</span>
                          </td>
                          <td className={`py-2.5 px-4 text-center font-bold font-mono ${gradeColor(s.avg_bem)}`}>
                            {s.avg_bem.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-4 text-center text-muted-foreground text-xs font-mono">
                            {s.avg_annual.toFixed(2)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2.5 px-4 text-center font-bold text-red-500 font-mono">{s.avg_bem.toFixed(2)}</td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">راسب</span>
                          </td>
                          <td className="py-2.5 px-4 text-center text-muted-foreground text-xs">{(9-s.avg_bem).toFixed(2)} نقطة</td>
                        </>
                      )}
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderSubjects = () => (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-blue-500" /> تفصيل المواد
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs uppercase">
                <th className="pb-2 pt-3 px-4 text-start">المادة</th>
                <th className="pb-2 pt-3 px-4 text-center">المعامل</th>
                <th className="pb-2 pt-3 px-4 text-center">المتوسط</th>
                <th className="pb-2 pt-3 px-4 text-center">ناجح ≥9</th>
                <th className="pb-2 pt-3 px-4 text-center">نسبة النجاح</th>
              </tr>
            </thead>
            <tbody>
              {stats.subjectStats.map((s, i) => {
                const pr = s.total > 0 ? (s.pass / s.total) * 100 : 0;
                const SubIcon = s.icon;
                return (
                  <motion.tr key={s.key} custom={i} variants={rowVariants} initial="initial" animate="animate"
                    className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i%2===1?"bg-muted/10":""}`}>
                    <td className="py-2.5 px-4">
                      <span className="flex items-center gap-2">
                        <SubIcon className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="font-medium">{s.label}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <Badge variant="outline" className="font-mono text-xs">{s.coef}</Badge>
                    </td>
                    <td className={`py-2.5 px-4 text-center font-bold font-mono ${gradeColor(s.avg)}`}>{s.avg.toFixed(2)}</td>
                    <td className="py-2.5 px-4 text-center text-emerald-600 font-semibold">{s.pass}</td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                          <motion.div className={`h-full rounded-full ${pr >= 50 ? "bg-emerald-500" : "bg-red-400"}`}
                            initial={{ width: 0 }} animate={{ width: `${pr}%` }}
                            transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.04 }} />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">{pr.toFixed(1)}%</span>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  const renderAll = () => (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            كشف النتائج الكامل — {filteredAll.length} تلميذ
          </CardTitle>
          <div className="relative">
            <Search className="absolute end-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالاسم..." className="h-8 text-xs pe-8 w-44" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground uppercase">
                {["#","الاسم","رقم ت","م. البيام","م. السنوي","التقدير","عرب","رياض","فرنس","إنجل","علوم","فيزياء"].map(h => (
                  <th key={h} className="pb-2 pt-3 px-3 text-center first:text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAll.map((s, i) => {
                const m = getMention(s.avg_bem);
                return (
                  <motion.tr key={s.num} custom={i} variants={rowVariants} initial="initial" animate="animate"
                    className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i%2===1?"bg-muted/10":""}`}>
                    <td className="py-2 px-3 text-center text-muted-foreground font-mono">{i+1}</td>
                    <td className="py-2 px-3 font-medium whitespace-nowrap max-w-[150px] truncate">{s.name}</td>
                    <td className="py-2 px-3 text-center text-muted-foreground font-mono">{s.reg}</td>
                    <td className={`py-2 px-3 text-center font-bold font-mono ${gradeColor(s.avg_bem)}`}>{s.avg_bem.toFixed(2)}</td>
                    <td className="py-2 px-3 text-center text-muted-foreground font-mono">{s.avg_annual.toFixed(2)}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${m.cls}`}>{m.label}</span>
                    </td>
                    {(["arabic","math","french","english","science","physics"] as const).map(k => (
                      <td key={k} className={`py-2 px-3 text-center font-mono ${gradeColor(s[k])}`}>
                        {s[k] > 0 ? s[k] : "—"}
                      </td>
                    ))}
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  const tabContent: Record<TabId, () => React.ReactNode> = {
    stats:    renderStats,
    toppers:  renderToppers,
    passed:   () => renderList(filteredPassed, "passed"),
    failed:   () => renderList(filteredFailed, "failed"),
    subjects: renderSubjects,
    all:      renderAll,
  };

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 space-y-5 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-blue-600" />
            محلل نتائج البيام
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats.total} مترشح &nbsp;·&nbsp; السنة الدراسية 2024–2025
          </p>
        </motion.div>

        <motion.div className="flex items-center gap-2 flex-wrap justify-end"
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold">
            ✅ {stats.passed.length} ناجح
          </Badge>
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-bold">
            ⭐ {stats.top14.length} متفوق
          </Badge>
          {stats.failed.length > 0 && (
            <Badge className="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 font-bold">
              ❌ {stats.failed.length} راسب
            </Badge>
          )}
          {/* ── Import button ── */}
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button onClick={() => setImportOpen(true)} variant="outline" size="sm"
              className="gap-2 hover:shadow-md transition-shadow">
              <Upload className="w-4 h-4" />
              استيراد جديد
            </Button>
          </motion.div>
        </motion.div>
      </div>

      {/* Tabs */}
      <motion.div className="flex gap-1 border-b overflow-x-auto pb-0"
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap shrink-0 -mb-px
                ${active
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"}`}>
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </motion.div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}>
          {tabContent[activeTab]()}
        </motion.div>
      </AnimatePresence>

      {/* Import Dialog */}
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={handleImported} />
    </motion.div>
  );
}