/**
 * /upload-grades-ocr — OCR Grade Sheet Review Page
 *
 * Flow:
 *  1. Teacher picks year, class, trimestre, subject
 *  2. Uploads an image of a printed grade sheet
 *  3. OCR runs (POST /api/ocr/parse-grades)
 *  4. Results appear in an editable table
 *     • Low-confidence rows highlighted in amber
 *     • Teacher can edit names and grades
 *  5. "Save to Database" button matches rows to students by name and
 *     posts grades via POST /api/grades (existing endpoint, per-student)
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
  Pencil, Save, RotateCcw, ImageIcon, FileImage,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL;

const ACADEMIC_YEARS = ["2026-2027", "2025-2026", "2024-2025", "2023-2024"];
const TRIMESTERS = ["1", "2", "3"];
const SUBJECTS_AR = [
  "عربية", "فرنسية", "رياضيات", "علوم", "تربية إسلامية",
  "تاريخ وجغرافيا", "تربية مدنية", "إنجليزية", "تربية تشكيلية",
  "تربية موسيقية", "تربية بدنية",
];

interface OcrRow {
  rowNumber: number;
  studentName: string;
  grade: number | null;
  confidence: number;
  lowConfidence: boolean;
  // Editable overrides
  editedName?: string;
  editedGrade?: string;
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

export default function UploadGradesOcrPage() {
  const { toast } = useToast();

  // ── Form fields ──────────────────────────────────────────────────────────
  const [annee,     setAnnee]     = useState("2025-2026");
  const [classe,    setClasse]    = useState("");
  const [trimestre, setTrimestre] = useState("1");
  const [subject,   setSubject]   = useState("");

  // ── Upload / OCR state ───────────────────────────────────────────────────
  const [phase,    setPhase]    = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [rows,     setRows]     = useState<OcrRow[]>([]);
  const [preview,  setPreview]  = useState<string | null>(null);
  const [overallConf, setOverallConf] = useState<number | null>(null);
  const [errMsg,   setErrMsg]   = useState("");
  const [dragging, setDragging] = useState(false);

  // ── Save state ────────────────────────────────────────────────────────────
  const [saveState, setSaveState] = useState<SaveState>({ phase: "idle", saved: 0, failed: 0, errors: [] });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Upload handler ────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "خطأ", description: "يجب رفع ملف صورة (JPEG، PNG، WebP)" });
      return;
    }

    // Preview
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
      const res = await fetch(`${BASE}api/ocr/parse-grades?lang=ara%2Bfra`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrMsg(data.error ?? "فشل معالجة الصورة");
        setPhase("error");
        return;
      }

      if (!data.rows || data.rows.length === 0) {
        setErrMsg("لم يتم العثور على أي درجات في الصورة. تأكد من جودة الصورة وحاول مرة أخرى.");
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
  }, [toast]);

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Row editing helpers ────────────────────────────────────────────────────
  const updateRow = (idx: number, patch: Partial<OcrRow>) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));

  const effectiveName  = (r: OcrRow) => r.editedName  ?? r.studentName;
  const effectiveGrade = (r: OcrRow) => r.editedGrade !== undefined ? r.editedGrade : String(r.grade ?? "");

  // ── Save grades ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!classe || !subject) {
      toast({ variant: "destructive", title: "خطأ", description: "يرجى تحديد الفوج والمادة قبل الحفظ" });
      return;
    }

    setSaveState({ phase: "saving", saved: 0, failed: 0, errors: [] });

    // First fetch students in the selected class + year
    let students: Array<{ id: string; nomPrenom: string }> = [];
    try {
      const res = await fetch(
        `${BASE}api/students?annee=${encodeURIComponent(annee)}&classe=${encodeURIComponent(classe)}&limit=200`,
        { credentials: "include" },
      );
      if (res.ok) {
        const d = await res.json();
        students = d.students ?? [];
      }
    } catch { /* continue with empty list */ }

    // Simple fuzzy name match (normalize spaces + case)
    const normalize = (s: string) =>
      s.replace(/\s+/g, " ").trim().toLowerCase();

    const findStudent = (name: string) => {
      const n = normalize(name);
      return (
        students.find(s => normalize(s.nomPrenom) === n) ??
        students.find(s => normalize(s.nomPrenom).includes(n) || n.includes(normalize(s.nomPrenom)))
      );
    };

    let saved = 0, failed = 0;
    const errors: string[] = [];
    const updatedRows = [...rows];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name  = effectiveName(row);
      const grStr = effectiveGrade(row);
      const grade = parseFloat(grStr);

      if (isNaN(grade) || grade < 0 || grade > 20) {
        failed++;
        errors.push(`صف ${row.rowNumber}: درجة غير صالحة "${grStr}"`);
        updatedRows[i] = { ...updatedRows[i], saveError: "درجة غير صالحة" };
        continue;
      }

      const student = findStudent(name);
      if (!student) {
        failed++;
        errors.push(`صف ${row.rowNumber}: لم يُطابق أي تلميذ لـ "${name}"`);
        updatedRows[i] = { ...updatedRows[i], saveError: "لم يُعثر على التلميذ في الفوج" };
        continue;
      }

      // POST to the existing grades endpoint
      try {
        const res = await fetch(`${BASE}api/grades`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: student.id,
            annee,
            trimestre: parseInt(trimestre),
            subject,
            score: grade,
          }),
        });
        if (res.ok) {
          saved++;
          updatedRows[i] = { ...updatedRows[i], saved: true, saveError: undefined };
        } else {
          const d = await res.json().catch(() => ({}));
          failed++;
          const msg = d.error ?? "فشل الحفظ";
          errors.push(`${name}: ${msg}`);
          updatedRows[i] = { ...updatedRows[i], saveError: msg };
        }
      } catch (e: any) {
        failed++;
        errors.push(`${name}: ${e?.message ?? "خطأ"}`);
        updatedRows[i] = { ...updatedRows[i], saveError: e?.message ?? "خطأ" };
      }
    }

    setRows(updatedRows);
    setSaveState({ phase: "done", saved, failed, errors });

    if (saved > 0) {
      toast({ title: `✅ تم حفظ ${saved} درجة بنجاح`, description: failed > 0 ? `فشل ${failed} صف — راجع الجدول` : undefined });
    } else {
      toast({ variant: "destructive", title: "فشل الحفظ", description: "لم يتم حفظ أي درجة — تحقق من الأخطاء" });
    }
  };

  const lowConfCount = rows.filter(r => r.lowConfidence).length;

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 space-y-6 max-w-5xl mx-auto" dir="rtl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="inline-flex w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 items-center justify-center shadow-lg shadow-violet-500/30">
          <ScanLine className="w-5 h-5 text-white" />
        </span>
        <div>
          <h1 className="text-xl font-bold">استخراج الدرجات بالـ OCR</h1>
          <p className="text-xs text-muted-foreground">ارفع صورة كشف الدرجات المطبوع وراجع النتائج قبل الحفظ</p>
        </div>
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Select value={annee} onValueChange={setAnnee}>
          <SelectTrigger><SelectValue placeholder="السنة" /></SelectTrigger>
          <SelectContent>{ACADEMIC_YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="الفوج (مثال: 1أ)" value={classe} onChange={e => setClasse(e.target.value)} />
        <Select value={trimestre} onValueChange={setTrimestre}>
          <SelectTrigger><SelectValue placeholder="الفصل" /></SelectTrigger>
          <SelectContent>{TRIMESTERS.map(t => <SelectItem key={t} value={t}>الفصل {t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger><SelectValue placeholder="المادة" /></SelectTrigger>
          <SelectContent>{SUBJECTS_AR.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
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
                <p className="font-semibold text-base">أسقط صورة الكشف هنا أو انقر للاختيار</p>
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
              <Button size="sm" variant="outline" className="gap-2" onClick={e => { e.stopPropagation(); setPhase("idle"); setPreview(null); }}>
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
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
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
                    <AlertTriangle className="w-3 h-3" />
                    {lowConfCount} ثقة منخفضة
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
                  disabled={saveState.phase === "saving" || !classe || !subject}
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
                className={`rounded-xl border p-3 flex items-center gap-3 text-sm ${
                  saveState.failed === 0
                    ? "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-amber-500/30 bg-amber-50 dark:bg-amber-950/30"
                }`}
              >
                {saveState.failed === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                )}
                <span className="font-semibold">
                  تم حفظ {saveState.saved} درجة
                  {saveState.failed > 0 && ` · فشل ${saveState.failed} صف`}
                </span>
              </motion.div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-100 border border-amber-400" />
                ثقة OCR منخفضة — تحقق يدويًا
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
                      {["#", "اسم التلميذ (قابل للتعديل)", "الدرجة / 20", "الثقة", "الحالة"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
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
                          row.saved
                            ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                            : row.saveError
                            ? "bg-red-50/50 dark:bg-red-950/20"
                            : row.lowConfidence
                            ? "bg-amber-50/60 dark:bg-amber-950/20"
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

                        {/* Editable grade */}
                        <td className="px-4 py-2 w-24">
                          <Input
                            value={effectiveGrade(row)}
                            onChange={e => updateRow(idx, { editedGrade: e.target.value })}
                            type="number"
                            min={0}
                            max={20}
                            step={0.25}
                            className="h-7 text-xs font-bold text-center border-transparent hover:border-border focus:border-border bg-transparent"
                            dir="ltr"
                          />
                        </td>

                        {/* Confidence */}
                        <td className="px-4 py-2 w-20">
                          <span className={`text-xs font-mono ${
                            row.confidence >= 85 ? "text-emerald-600" :
                            row.confidence >= 70 ? "text-amber-600"   : "text-red-500"
                          }`}>
                            {row.confidence}%
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-2 w-32">
                          {row.saved ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> تم الحفظ
                            </span>
                          ) : row.saveError ? (
                            <span className="flex items-center gap-1 text-xs text-red-500" title={row.saveError}>
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[110px]">{row.saveError}</span>
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

            {/* No-phone warning if class not set */}
            {(!classe || !subject) && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                حدد الفوج والمادة أعلاه لتفعيل زر الحفظ
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
