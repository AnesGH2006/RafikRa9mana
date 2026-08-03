/**
 * /upload-grades-ocr — OCR Grade Sheet & Absence Sheet Review Page
 *
 * Modes:
 *  • grades   — upload a printed grade sheet, extract scores, save to /api/grades
 *  • absences — upload a printed absence sheet, extract hours, save to /api/absences
 *
 * Flow (both modes):
 *  1. Pick year / niveau / class / trimestre (+ subject for grades mode)
 *  2. Upload an image of a printed sheet
 *  3. OCR runs via POST /api/ocr/parse-grades?type=<mode>
 *  4. Results appear in an editable table
 *  5. "Save to Database" button matches rows to students by name and saves
 *
 * ✅ FIX: Added Levenshtein-distance fuzzy fallback so minor OCR
 *         mis-readings (extra space, one transposed letter) still match.
 * ✅ NEW:  Absences mode (type=absences) — extracts justified/unjustified hours.
 */
import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ScanLine, Upload, Loader2, CheckCircle2, AlertCircle, AlertTriangle,
  Pencil, Save, RotateCcw, FileImage, Clock, BookOpen,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL;

const ACADEMIC_YEARS = ["2026-2027", "2025-2026", "2024-2025", "2023-2024"];
const TRIMESTERS     = ["1", "2", "3"];
const NIVEAUX        = ["1AM", "2AM", "3AM", "4AM"];
const SUBJECTS_AR    = [
  "عربية", "فرنسية", "رياضيات", "علوم", "تربية إسلامية",
  "تاريخ وجغرافيا", "تربية مدنية", "إنجليزية", "تربية تشكيلية",
  "تربية موسيقية", "تربية بدنية",
];

type OcrMode = "grades" | "absences";

interface OcrRow {
  rowNumber: number;
  studentName: string;
  // grades mode
  grade?: number | null;
  // absences mode
  justifiedHours?: number;
  unjustifiedHours?: number;
  // common
  confidence: number;
  lowConfidence: boolean;
  editedName?: string;
  editedGrade?: string;
  editedJustified?: string;
  editedUnjustified?: string;
  saved?: boolean;
  saveError?: string;
}

interface SaveState {
  phase: "idle" | "saving" | "done";
  saved: number;
  failed: number;
  errors: string[];
}

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

// ── Arabic normalizer (strips diacritics, unifies أ/إ/آ/ا, ة/ه, ى/ي) ────────
function normArabic(s: string): string {
  return String(s ?? "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
    .replace(/[أإآا]/g, "ا")
    .replace(/[ةه]/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ── Levenshtein distance for fuzzy fallback ────────────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
  return dp[m]![n]!;
}

// ── Name matching: exact/partial → word-order-independent → fuzzy ─────────────
function nameMatches(a: string, b: string): boolean {
  const na = normArabic(a);
  const nb = normArabic(b);
  if (!na || !nb) return false;
  // 1. exact / substring match
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  // 2. word-order-independent (handles "اسم لقب" vs "لقب اسم")
  const wa = na.split(" ").filter(Boolean);
  const wb = nb.split(" ").filter(Boolean);
  const [shorter, longer] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  if (shorter.length > 0 && shorter.every(w => longer.some(lw => lw.includes(w)))) return true;
  // 3. fuzzy Levenshtein fallback — allow up to 20% edits (min 1, max 3)
  const maxDist = Math.min(3, Math.max(1, Math.floor(Math.min(na.length, nb.length) * 0.2)));
  return levenshtein(na, nb) <= maxDist;
}

export default function UploadGradesOcrPage() {
  const { toast } = useToast();

  // ── Mode ──────────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<OcrMode>("grades");

  // ── Form fields ───────────────────────────────────────────────────────────────
  const [annee,     setAnnee]     = useState("2025-2026");
  const [niveau,    setNiveau]    = useState("");
  const [classe,    setClasse]    = useState("");
  const [trimestre, setTrimestre] = useState("1");
  const [subject,   setSubject]   = useState("");

  // ── Upload / OCR state ────────────────────────────────────────────────────────
  const [phase,    setPhase]    = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [rows,     setRows]     = useState<OcrRow[]>([]);
  const [preview,  setPreview]  = useState<string | null>(null);
  const [overallConf, setOverallConf] = useState<number | null>(null);
  const [errMsg,   setErrMsg]   = useState("");
  const [dragging, setDragging] = useState(false);

  // ── Save state ────────────────────────────────────────────────────────────────
  const [saveState, setSaveState] = useState<SaveState>({ phase: "idle", saved: 0, failed: 0, errors: [] });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Reset when mode changes ────────────────────────────────────────────────────
  const switchMode = (m: OcrMode) => {
    setMode(m);
    setPhase("idle");
    setRows([]);
    setPreview(null);
    setSaveState({ phase: "idle", saved: 0, failed: 0, errors: [] });
    if (m === "absences") setSubject("");
  };

  // ── Upload handler ─────────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "خطأ", description: "يجب رفع ملف صورة (JPEG، PNG، WebP)" });
      return;
    }
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setPhase("uploading");
    setRows([]);
    setErrMsg("");
    setSaveState({ phase: "idle", saved: 0, failed: 0, errors: [] });

    const form = new FormData();
    form.append("image", file);

    try {
      const res = await fetch(
        `${BASE}api/ocr/parse-grades?type=${mode}`,
        { method: "POST", body: form, credentials: "include" },
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrMsg(data.error ?? "فشل معالجة الصورة");
        setPhase("error");
        return;
      }

      if (!data.rows || data.rows.length === 0) {
        setErrMsg("لم يتم العثور على أي بيانات في الصورة. تأكد من جودة الصورة وحاول مرة أخرى.");
        setPhase("error");
        return;
      }

      setRows(data.rows.map((r: OcrRow) => ({ ...r })));
      setOverallConf(data.overallConfidence ?? null);
      setPhase("done");
    } catch (e: any) {
      setErrMsg(e?.message ?? "حدث خطأ غير متوقع");
      setPhase("error");
    }
  }, [toast, mode]);

  // ── Drag & drop ───────────────────────────────────────────────────────────────
  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Row editing helpers ────────────────────────────────────────────────────────
  const updateRow    = (idx: number, patch: Partial<OcrRow>) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  const effectiveName       = (r: OcrRow) => r.editedName ?? r.studentName;
  const effectiveGrade      = (r: OcrRow) => r.editedGrade !== undefined ? r.editedGrade : String(r.grade ?? "");
  const effectiveJustified  = (r: OcrRow) => r.editedJustified  !== undefined ? r.editedJustified  : String(r.justifiedHours  ?? 0);
  const effectiveUnjustified= (r: OcrRow) => r.editedUnjustified !== undefined ? r.editedUnjustified : String(r.unjustifiedHours ?? 0);

  // ── Fetch students for matching ────────────────────────────────────────────────
  async function fetchStudents(): Promise<Array<{ id: string; nomPrenom: string }>> {
    if (!niveau || !classe) return [];
    try {
      const res = await fetch(
        `${BASE}api/students?annee=${encodeURIComponent(annee)}&niveau=${encodeURIComponent(niveau)}&classe=${encodeURIComponent(classe)}&limit=200`,
        { credentials: "include" },
      );
      if (!res.ok) return [];
      const d = await res.json();
      return d.students ?? [];
    } catch { return []; }
  }

  // ── Save grades ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!niveau || !classe) {
      toast({ variant: "destructive", title: "خطأ", description: "يرجى تحديد المستوى والفوج قبل الحفظ" });
      return;
    }
    if (mode === "grades" && !subject) {
      toast({ variant: "destructive", title: "خطأ", description: "يرجى تحديد المادة قبل الحفظ" });
      return;
    }

    setSaveState({ phase: "saving", saved: 0, failed: 0, errors: [] });

    const students = await fetchStudents();

    if (students.length === 0) {
      const msg = `لم يتم العثور على أي تلميذ في ${niveau} — الفوج ${classe} — سنة ${annee}. تحقق من صحة المستوى والفوج المحددين أو تأكد من استيراد القائمة أولاً.`;
      setSaveState({ phase: "done", saved: 0, failed: rows.length, errors: [msg] });
      setRows(prev => prev.map(r => ({ ...r, saveError: "لا يوجد تلاميذ في هذا الفوج" })));
      toast({ variant: "destructive", title: "لم يتم العثور على تلاميذ", description: msg });
      return;
    }

    const findStudent = (name: string) => students.find(s => nameMatches(s.nomPrenom, name));

    let saved = 0, failed = 0;
    const errors: string[] = [];
    const updatedRows = [...rows];

    for (let i = 0; i < rows.length; i++) {
      const row  = rows[i]!;
      const name = effectiveName(row);
      const student = findStudent(name);

      if (!student) {
        failed++;
        errors.push(`صف ${row.rowNumber}: لم يُطابق أي تلميذ لـ "${name}"`);
        updatedRows[i] = { ...updatedRows[i]!, saveError: "لم يُعثر على التلميذ في الفوج" };
        continue;
      }

      try {
        let res: Response;

        if (mode === "grades") {
          const grStr = effectiveGrade(row);
          const grade = parseFloat(grStr);
          if (isNaN(grade) || grade < 0 || grade > 20) {
            failed++;
            errors.push(`صف ${row.rowNumber}: درجة غير صالحة "${grStr}"`);
            updatedRows[i] = { ...updatedRows[i]!, saveError: "درجة غير صالحة" };
            continue;
          }
          res = await fetch(`${BASE}api/grades`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId: student.id, annee,
              trimestre: parseInt(trimestre),
              subject, score: grade,
            }),
          });
        } else {
          // absences mode
          const justified   = parseInt(effectiveJustified(row))   || 0;
          const unjustified = parseInt(effectiveUnjustified(row)) || 0;
          res = await fetch(`${BASE}api/absences`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId: student.id, annee,
              trimestre: parseInt(trimestre),
              justifiedHours: justified,
              unjustifiedHours: unjustified,
            }),
          });
        }

        if (res.ok) {
          saved++;
          updatedRows[i] = { ...updatedRows[i]!, saved: true, saveError: undefined };
        } else {
          const d = await res.json().catch(() => ({}));
          failed++;
          const msg = d.error ?? "فشل الحفظ";
          errors.push(`${name}: ${msg}`);
          updatedRows[i] = { ...updatedRows[i]!, saveError: msg };
        }
      } catch (e: any) {
        failed++;
        errors.push(`${name}: ${e?.message ?? "خطأ"}`);
        updatedRows[i] = { ...updatedRows[i]!, saveError: e?.message ?? "خطأ" };
      }
    }

    setRows(updatedRows);
    setSaveState({ phase: "done", saved, failed, errors });

    if (saved > 0) {
      toast({
        title: `✅ تم حفظ ${saved} ${mode === "grades" ? "درجة" : "سجل غياب"} بنجاح`,
        description: failed > 0 ? `فشل ${failed} صف — راجع الجدول` : undefined,
      });
    } else {
      toast({ variant: "destructive", title: "فشل الحفظ", description: "لم يتم حفظ أي سجل — تحقق من الأخطاء" });
    }
  };

  const lowConfCount = rows.filter(r => r.lowConfidence).length;
  const canSave = mode === "grades" ? !!(niveau && classe && subject) : !!(niveau && classe);

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 space-y-6 max-w-5xl mx-auto" dir="rtl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="inline-flex w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 items-center justify-center shadow-lg shadow-violet-500/30">
          <ScanLine className="w-5 h-5 text-white" />
        </span>
        <div>
          <h1 className="text-xl font-bold">استخراج البيانات بالـ OCR</h1>
          <p className="text-xs text-muted-foreground">ارفع صورة الكشف المطبوع وراجع النتائج قبل الحفظ</p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 p-1 bg-muted/50 rounded-xl w-fit">
        <button
          onClick={() => switchMode("grades")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === "grades"
              ? "bg-background text-violet-600 dark:text-violet-400 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          درجات
        </button>
        <button
          onClick={() => switchMode("absences")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === "absences"
              ? "bg-background text-amber-600 dark:text-amber-400 shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          غيابات
        </button>
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Select value={annee} onValueChange={setAnnee}>
          <SelectTrigger><SelectValue placeholder="السنة" /></SelectTrigger>
          <SelectContent>{ACADEMIC_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={niveau} onValueChange={setNiveau}>
          <SelectTrigger><SelectValue placeholder="المستوى" /></SelectTrigger>
          <SelectContent>{NIVEAUX.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
        </Select>
        <Input
          placeholder="الفوج (مثال: 1 أو A)"
          value={classe}
          onChange={e => setClasse(e.target.value)}
        />
        <Select value={trimestre} onValueChange={setTrimestre}>
          <SelectTrigger><SelectValue placeholder="الفصل" /></SelectTrigger>
          <SelectContent>{TRIMESTERS.map(t => <SelectItem key={t} value={t}>الفصل {t}</SelectItem>)}</SelectContent>
        </Select>
        {mode === "grades" ? (
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><SelectValue placeholder="المادة" /></SelectTrigger>
            <SelectContent>{SUBJECTS_AR.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        ) : (
          <div className="flex items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 text-xs text-amber-700 dark:text-amber-400 font-medium gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            وضع الغيابات
          </div>
        )}
      </div>

      {/* Upload zone */}
      {phase !== "done" && (
        <motion.div
          className={`rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-4 py-14 px-6 text-center
            ${dragging ? "border-violet-400 bg-violet-50/40 dark:bg-violet-950/20" : "border-muted-foreground/25 hover:border-violet-400/50 hover:bg-violet-50/20 dark:hover:bg-violet-950/10"}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => phase === "idle" && fileInputRef.current?.click()}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {phase === "idle" && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-950/40 dark:to-purple-950/40 flex items-center justify-center">
                <FileImage className="w-8 h-8 text-violet-500" />
              </div>
              <div>
                <p className="font-semibold text-base">
                  {mode === "grades" ? "أسقط صورة كشف الدرجات هنا" : "أسقط صورة كشف الغياب هنا"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">JPEG · PNG · WebP · BMP — حجم أقصى 15 MB</p>
              </div>
              <Button size="sm" className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 shadow">
                <Upload className="w-4 h-4" />
                اختيار صورة
              </Button>
            </>
          )}

          {phase === "uploading" && (
            <div className="flex flex-col items-center gap-3">
              {preview && (
                <img src={preview} alt="" className="max-h-32 rounded-xl object-contain shadow border border-border opacity-60" />
              )}
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
              <p className="text-sm text-muted-foreground">جاري معالجة الصورة بالـ OCR… قد يستغرق بضع ثوانٍ</p>
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center gap-3">
              <AlertCircle className="w-10 h-10 text-red-500" />
              <p className="text-sm text-red-600 dark:text-red-400">{errMsg}</p>
              <Button size="sm" variant="outline" className="gap-2"
                onClick={e => { e.stopPropagation(); setPhase("idle"); setPreview(null); }}>
                <RotateCcw className="w-4 h-4" />
                حاول مرة أخرى
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {/* Results table */}
      <AnimatePresence>
        {phase === "done" && rows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="font-bold text-base">نتائج الاستخراج</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 font-semibold">
                  {rows.length} صف
                </span>
                {lowConfCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />{lowConfCount} ثقة منخفضة
                  </span>
                )}
                {overallConf !== null && (
                  <span className="text-xs text-muted-foreground">دقة OCR: {overallConf}%</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
                  onClick={() => { setPhase("idle"); setRows([]); setPreview(null); setSaveState({ phase: "idle", saved: 0, failed: 0, errors: [] }); }}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  صورة جديدة
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs h-8 bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-0 shadow-sm"
                  onClick={handleSave}
                  disabled={saveState.phase === "saving" || !canSave}
                >
                  {saveState.phase === "saving" ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري الحفظ…</>
                  ) : (
                    <><Save className="w-3.5 h-3.5" /> حفظ في قاعدة البيانات</>
                  )}
                </Button>
              </div>
            </div>

            {/* Save summary */}
            {saveState.phase === "done" && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl border p-3 flex items-start gap-3 text-sm ${
                  saveState.failed === 0
                    ? "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-amber-500/30 bg-amber-50 dark:bg-amber-950/30"
                }`}
              >
                {saveState.failed === 0
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}
                <div>
                  <span className="font-semibold block">
                    تم حفظ {saveState.saved} {mode === "grades" ? "درجة" : "سجل غياب"}
                    {saveState.failed > 0 && ` · فشل ${saveState.failed} صف`}
                  </span>
                  {saveState.errors.length > 0 && saveState.saved === 0 && (
                    <span className="text-xs text-muted-foreground mt-1 block">{saveState.errors[0]}</span>
                  )}
                </div>
              </motion.div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-100 border border-amber-400" />
                ثقة OCR منخفضة
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-400" />
                تم الحفظ
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-100 border border-red-400" />
                خطأ في الحفظ
              </span>
            </div>

            {/* Table */}
            <div className="rounded-xl border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 sticky top-0 z-10">
                    <tr>
                      {mode === "grades" ? (
                        <>
                          {["#", "اسم التلميذ (قابل للتعديل)", "الدرجة / 20", "الثقة", "الحالة"].map(h => (
                            <th key={h} className="px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </>
                      ) : (
                        <>
                          {["#", "اسم التلميذ (قابل للتعديل)", "مبرر (ساعة)", "غير مبرر (ساعة)", "المجموع", "الحالة"].map(h => (
                            <th key={h} className="px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <motion.tr
                        key={row.rowNumber}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.4) }}
                        className={`border-t transition-colors ${
                          row.saved      ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                          : row.saveError ? "bg-red-50/50 dark:bg-red-950/20"
                          : row.lowConfidence ? "bg-amber-50/60 dark:bg-amber-950/20"
                          : idx % 2 === 0 ? "" : "bg-muted/20"
                        }`}
                      >
                        {/* Row # */}
                        <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono w-10">
                          {row.rowNumber}
                        </td>

                        {/* Editable name */}
                        <td className="px-4 py-2 min-w-[180px]">
                          <div className="flex items-center gap-1.5">
                            <Input
                              value={effectiveName(row)}
                              onChange={e => updateRow(idx, { editedName: e.target.value })}
                              className="h-7 text-xs font-medium border-transparent hover:border-border focus:border-border bg-transparent px-1.5"
                              dir="rtl"
                            />
                            <Pencil className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                          </div>
                        </td>

                        {mode === "grades" ? (
                          <>
                            {/* Grade */}
                            <td className="px-4 py-2 w-24">
                              <Input
                                value={effectiveGrade(row)}
                                onChange={e => updateRow(idx, { editedGrade: e.target.value })}
                                type="number" min={0} max={20} step={0.25}
                                className="h-7 text-xs font-bold text-center border-transparent hover:border-border focus:border-border bg-transparent"
                                dir="ltr"
                              />
                            </td>
                            {/* Confidence */}
                            <td className="px-4 py-2 w-20">
                              <span className={`text-xs font-mono ${
                                row.confidence >= 85 ? "text-emerald-600" :
                                row.confidence >= 70 ? "text-amber-600"   : "text-red-500"
                              }`}>{row.confidence}%</span>
                            </td>
                          </>
                        ) : (
                          <>
                            {/* Justified hours */}
                            <td className="px-4 py-2 w-24">
                              <Input
                                value={effectiveJustified(row)}
                                onChange={e => updateRow(idx, { editedJustified: e.target.value })}
                                type="number" min={0} max={500} step={1}
                                className="h-7 text-xs font-bold text-center border-transparent hover:border-border focus:border-border bg-transparent"
                                dir="ltr"
                              />
                            </td>
                            {/* Unjustified hours */}
                            <td className="px-4 py-2 w-24">
                              <Input
                                value={effectiveUnjustified(row)}
                                onChange={e => updateRow(idx, { editedUnjustified: e.target.value })}
                                type="number" min={0} max={500} step={1}
                                className="h-7 text-xs font-bold text-center border-transparent hover:border-border focus:border-border bg-transparent"
                                dir="ltr"
                              />
                            </td>
                            {/* Total */}
                            <td className="px-4 py-2 w-20 text-xs font-mono text-center text-muted-foreground">
                              {(parseInt(effectiveJustified(row)) || 0) + (parseInt(effectiveUnjustified(row)) || 0)}
                            </td>
                          </>
                        )}

                        {/* Status */}
                        <td className="px-4 py-2 w-36">
                          {row.saved ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> تم الحفظ
                            </span>
                          ) : row.saveError ? (
                            <span className="flex items-center gap-1 text-xs text-red-500" title={row.saveError}>
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[120px]">{row.saveError}</span>
                            </span>
                          ) : row.lowConfidence ? (
                            <span className="flex items-center gap-1 text-xs text-amber-600">
                              <AlertTriangle className="w-3.5 h-3.5" /> تحقق يدويًا
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">جاهز</span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Missing field warning */}
            {!canSave && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                {mode === "grades"
                  ? "حدد المستوى والفوج والمادة أعلاه لتفعيل زر الحفظ"
                  : "حدد المستوى والفوج أعلاه لتفعيل زر الحفظ"}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
