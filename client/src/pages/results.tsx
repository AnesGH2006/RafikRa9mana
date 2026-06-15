import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/language-provider";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, ClipboardList, Search, Upload, CheckCircle2, AlertCircle, X, FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { getSubjectsForLevel, calcWeightedAvg } from "@shared/subjects";
import type { StudentResult } from "@shared/types";
import type { Niveau } from "@shared/types";

const BASE = import.meta.env.BASE_URL;
const LEVELS: Niveau[] = ["1AM", "2AM", "3AM", "4AM"];
const LEVEL_LABELS: Record<Niveau, string> = {
  "1AM": "1ère AM", "2AM": "2ème AM", "3AM": "3ème AM", "4AM": "4ème AM",
};

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

function avg2(v: number | null) {
  if (v === null) return "—";
  return v.toFixed(2);
}

// ── Arabic subject header → internal key ─────────────────────────────────────
const SUBJECT_HEADER_MAP: Record<string, string> = {
  "اللغة العربية":              "arabe",
  "اللغة الفرنسية":             "francais",
  "اللغة الإنجليزية":           "anglais",
  "اللغة اﻷمازيغية":           "amazigh",
  "التربية الإسلامية":           "islam",
  "التربية المدنية":             "civique",
  "التاريخ والجغرافيا":          "histoire_geo",
  "الرياضيات":                   "maths",
  "ع الطبيعة و الحياة":         "svt",
  "ع الفيزيائية والتكنولوجيا":  "physique",
  "المعلوماتية":                  "informatique",
  "التربية التشكيلية":            "plastique",
  "التربية الموسيقية":            "musique",
  "ت البدنية و الرياضية":       "eps",
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface ParsedStudent {
  raqm: number;
  nomPrenom: string;
  gender: string;
  grades: { 1: Record<string, number>; 2: Record<string, number>; 3: Record<string, number> };
  t1Avg: number | null;
  t2Avg: number | null;
  t3Avg: number | null;
  annualAvg: number | null;
  passed: boolean | null;
}

// ── Parser ────────────────────────────────────────────────────────────────────
function parseHTMLExcel(text: string): ParsedStudent[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");
  const tableRows = Array.from(doc.querySelectorAll("tr"));

  let headerRowIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < tableRows.length; i++) {
    const cells = Array.from(tableRows[i].querySelectorAll("td,th")).map(c => c.textContent?.trim() ?? "");
    if (cells.some(c => c === "الرقم")) {
      headerRowIdx = i;
      headers = cells;
      break;
    }
  }
  if (headerRowIdx === -1) throw new Error("لم يتم العثور على صف العناوين (الرقم)");

  interface ColMeta {
    type: "raqm" | "name" | "gender" | "subject" | "avg" | "skip";
    subjectKey?: string;
    tri?: 1 | 2 | 3;
  }
  const colMeta: ColMeta[] = headers.map(h => {
    if (h === "الرقم") return { type: "raqm" };
    if (h === "اللقب و الاسم" || h === "اللقب والاسم") return { type: "name" };
    if (h === "الجنس") return { type: "gender" };
    for (const [arLabel, key] of Object.entries(SUBJECT_HEADER_MAP)) {
      for (const tri of [1, 2, 3] as const) {
        if (h === `${arLabel} ف ${tri}`) return { type: "subject", subjectKey: key, tri };
      }
    }
    for (const tri of [1, 2, 3] as const) {
      if (h === `معدل الفصل ${tri}`) return { type: "avg", tri };
    }
    return { type: "skip" };
  });

  const iRaqm  = colMeta.findIndex(c => c.type === "raqm");
  const iName  = colMeta.findIndex(c => c.type === "name");
  const iGender = colMeta.findIndex(c => c.type === "gender");

  const students: ParsedStudent[] = [];

  for (let i = headerRowIdx + 1; i < tableRows.length; i++) {
    const cells = Array.from(tableRows[i].querySelectorAll("td,th")).map(c => c.textContent?.trim() ?? "");
    const raqmRaw = cells[iRaqm];
    if (!raqmRaw || isNaN(Number(raqmRaw))) continue;

    const grades: ParsedStudent["grades"] = { 1: {}, 2: {}, 3: {} };
    const triAvgs: Record<number, number | null> = { 1: null, 2: null, 3: null };

    cells.forEach((val, ci) => {
      const meta = colMeta[ci];
      if (!meta) return;
      const n = parseFloat(val);
      if (meta.type === "subject" && meta.subjectKey && meta.tri && !isNaN(n) && n > 0) {
        grades[meta.tri][meta.subjectKey] = Math.max(0, Math.min(20, n));
      }
      if (meta.type === "avg" && meta.tri && !isNaN(n) && n > 0) {
        triAvgs[meta.tri] = n;
      }
    });

    const available = ([1, 2, 3] as const).map(t => triAvgs[t]).filter((v): v is number => v !== null);
    const annualAvg = available.length > 0
      ? Math.round((available.reduce((a, b) => a + b, 0) / available.length) * 100) / 100
      : null;

    students.push({
      raqm: Number(raqmRaw),
      nomPrenom: cells[iName] ?? "",
      gender: cells[iGender] ?? "",
      grades,
      t1Avg: triAvgs[1],
      t2Avg: triAvgs[2],
      t3Avg: triAvgs[3],
      annualAvg,
      passed: annualAvg !== null ? annualAvg >= 10 : null,
    });
  }

  if (students.length === 0) throw new Error("لم يتم العثور على بيانات تلاميذ في الملف");
  return students;
}

// ── Print helper ──────────────────────────────────────────────────────────────
function printResults(results: StudentResult[], niveauLabel: string, classeLabel: string, t: (k: string) => string) {
  const win = window.open("", "_blank");
  if (!win) return;

  const rowsHtml = results.map((r, i) => {
    const passClass = r.passed === true ? "pass" : r.passed === false ? "fail" : "";
    const passLabel = r.passed === null ? "—" : r.passed ? "ناجح" : "راسب";
    return `
      <tr>
        <td>${r.rank ?? i + 1}</td>
        <td class="name">${r.student.nomPrenom}</td>
        <td>${avg2(r.t1Avg)}</td>
        <td>${avg2(r.t2Avg)}</td>
        <td>${avg2(r.t3Avg)}</td>
        <td class="bold">${avg2(r.annualAvg)}</td>
        <td class="${passClass}">${passLabel}</td>
      </tr>`;
  }).join("");

  const now = new Date();
  const dateStr = now.toLocaleDateString("ar-DZ", { year: "numeric", month: "long", day: "numeric" });

  win.document.write(`
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8" />
<title>نتائج التلاميذ</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", Tahoma, Arial, sans-serif;
    direction: rtl;
    color: #1a1a1a;
    padding: 24px;
  }
  .header {
    text-align: center;
    margin-bottom: 20px;
    border-bottom: 2px solid #1a1a1a;
    padding-bottom: 12px;
  }
  .header h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .header .sub { font-size: 13px; color: #555; }
  .meta {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    margin: 16px 0;
    color: #333;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  th, td {
    border: 1px solid #999;
    padding: 6px 8px;
    text-align: center;
  }
  th {
    background: #e8e8e8;
    font-weight: 700;
  }
  td.name { text-align: right; font-weight: 600; }
  td.bold { font-weight: 700; }
  td.pass { color: #0a7a3d; font-weight: 700; }
  td.fail { color: #c0392b; font-weight: 700; }
  tr:nth-child(even) { background: #f7f7f7; }
  .footer {
    margin-top: 24px;
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #555;
  }
  .stamp {
    margin-top: 60px;
    display: flex;
    justify-content: space-between;
    font-size: 13px;
  }
  .stamp .box { text-align: center; }
  .stamp .line {
    margin-top: 50px;
    border-top: 1px solid #999;
    width: 160px;
  }
  @media print {
    body { padding: 0; }
    @page { size: A4 landscape; margin: 12mm; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>نتائج التلاميذ</h1>
    <div class="sub">${niveauLabel}${classeLabel ? " — قسم " + classeLabel : ""}</div>
  </div>

  <div class="meta">
    <span>عدد التلاميذ: ${results.length}</span>
    <span>تاريخ الطباعة: ${dateStr}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th>الرتبة</th>
        <th>اللقب والاسم</th>
        <th>معدل ف1</th>
        <th>معدل ف2</th>
        <th>معدل ف3</th>
        <th>المعدل السنوي</th>
        <th>النتيجة</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="stamp">
    <div class="box">
      <div>توقيع الأستاذ (ة)</div>
      <div class="line"></div>
    </div>
    <div class="box">
      <div>ختم وتوقيع الإدارة</div>
      <div class="line"></div>
    </div>
  </div>
</body>
</html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 300);
}

// ── Import modal ──────────────────────────────────────────────────────────────
function ImportModal({ annee, onClose, onDone }: { annee: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "parsing" | "preview" | "importing" | "done" | "error">("idle");
  const [students, setStudents] = useState<ParsedStudent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const handleFile = async (file: File) => {
    setStatus("parsing");
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseHTMLExcel(text);
      setStudents(parsed);
      setStatus("preview");
    } catch (e: any) {
      setError(e.message ?? "خطأ في قراءة الملف");
      setStatus("error");
    }
  };

  const handleImport = async () => {
    setStatus("importing");
    setProgress({ done: 0, total: students.length });
    let saved = 0;

    for (const s of students) {
      try {
        for (const tri of [1, 2, 3] as const) {
          const grades = s.grades[tri];
          if (Object.keys(grades).length === 0) continue;
          await fetch(`${BASE}api/grades/bulk`, {
            method: "POST", credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentName: s.nomPrenom,
              raqm: s.raqm,
              annee,
              trimestre: tri,
              grades,
              triAvg: tri === 1 ? s.t1Avg : tri === 2 ? s.t2Avg : s.t3Avg,
              annualAvg: s.annualAvg,
            }),
          });
        }
        saved++;
      } catch { /* skip individual failures */ }
      setProgress(p => ({ ...p, done: p.done + 1 }));
    }

    toast({ title: `✓ تم استيراد نتائج ${saved} تلميذ` });
    setStatus("done");
    onDone();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
            استيراد وحساب المعدلات من Excel
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">

          {(status === "idle" || status === "parsing") && (
            <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div
                onDrop={e => { e.preventDefault(); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]); }}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="mt-1 border-2 border-dashed border-muted-foreground/25 rounded-xl p-12 text-center cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-50/5 transition-all"
              >
                {status === "parsing"
                  ? <Loader2 className="w-8 h-8 mx-auto mb-3 text-emerald-500 animate-spin" />
                  : <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />}
                <p className="text-sm font-medium">
                  {status === "parsing" ? "جارٍ تحليل الملف…" : "اسحب ملف Excel هنا أو انقر للاختيار"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  يدعم ملفات تحليل النتائج (.xls) — سيتم حساب المعدل السنوي تلقائياً
                </p>
              </div>
              <input ref={fileRef} type="file" accept=".xls,.xlsx,.html,.htm" className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </motion.div>
          )}

          {status === "error" && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertCircle className="w-10 h-10 text-red-500" />
              <p className="text-sm font-medium text-red-500">{error}</p>
              <Button variant="outline" onClick={() => setStatus("idle")}>حاول مجدداً</Button>
            </motion.div>
          )}

          {status === "preview" && (
            <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between my-3">
                <p className="text-sm text-muted-foreground">
                  تم تحليل <span className="font-bold text-foreground">{students.length}</span> تلميذ —
                  سيتم حساب المعدل السنوي تلقائياً
                </p>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span className="text-emerald-500 font-semibold">
                    {students.filter(s => s.passed).length} ناجح
                  </span>
                  <span>·</span>
                  <span className="text-red-500 font-semibold">
                    {students.filter(s => s.passed === false).length} راسب
                  </span>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden max-h-72 overflow-y-auto text-sm">
                <table className="w-full">
                  <thead className="bg-muted/60 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-start text-xs text-muted-foreground font-semibold">#</th>
                      <th className="px-3 py-2 text-start text-xs text-muted-foreground font-semibold">الاسم</th>
                      <th className="px-3 py-2 text-center text-xs text-muted-foreground font-semibold">ف1</th>
                      <th className="px-3 py-2 text-center text-xs text-muted-foreground font-semibold">ف2</th>
                      <th className="px-3 py-2 text-center text-xs text-muted-foreground font-semibold">ف3</th>
                      <th className="px-3 py-2 text-center text-xs text-muted-foreground font-semibold">المعدل السنوي</th>
                      <th className="px-3 py-2 text-center text-xs text-muted-foreground font-semibold">النتيجة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, i) => (
                      <tr key={i} className={`border-t ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                        <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{s.raqm}</td>
                        <td className="px-3 py-2 font-medium text-xs">{s.nomPrenom}</td>
                        {[s.t1Avg, s.t2Avg, s.t3Avg].map((a, ti) => (
                          <td key={ti} className={`px-3 py-2 text-center font-mono text-xs ${
                            a === null ? "text-muted-foreground" : a >= 10 ? "text-emerald-600" : "text-red-500"
                          }`}>{a !== null ? a.toFixed(2) : "—"}</td>
                        ))}
                        <td className={`px-3 py-2 text-center font-mono font-bold text-xs ${
                          s.annualAvg === null ? "text-muted-foreground"
                            : s.annualAvg >= 10 ? "text-emerald-600" : "text-red-500"
                        }`}>
                          {s.annualAvg !== null ? s.annualAvg.toFixed(2) : "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {s.passed === null ? "—"
                            : s.passed
                              ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">ناجح</span>
                              : <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 font-semibold">راسب</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 justify-end mt-4">
                <Button variant="outline" onClick={() => { setStudents([]); setStatus("idle"); }}>
                  <X className="w-4 h-4 me-1" /> إلغاء
                </Button>
                <Button onClick={handleImport} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                  <Upload className="w-4 h-4" />
                  حفظ نتائج {students.length} تلميذ
                </Button>
              </div>
            </motion.div>
          )}

          {status === "importing" && (
            <motion.div key="importing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 py-10">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
              <p className="text-sm text-muted-foreground">
                جارٍ الحفظ… {progress.done} / {progress.total}
              </p>
              <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div className="h-full bg-emerald-500 rounded-full"
                  animate={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                  transition={{ duration: 0.3 }} />
              </div>
            </motion.div>
          )}

          {status === "done" && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="text-base font-semibold">تم الاستيراد وحساب المعدلات بنجاح</p>
              <p className="text-sm text-muted-foreground">
                تم حفظ نتائج {students.length} تلميذ مع معدلاتهم السنوية
              </p>
              <Button onClick={onClose} className="mt-2">إغلاق</Button>
            </motion.div>
          )}

        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

// ── Grade entry modal (manual) ────────────────────────────────────────────────
function GradeModal({ result, annee, onClose, onSaved }: {
  result: StudentResult; annee: string; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [tri, setTri] = useState<1 | 2 | 3>(1);
  const [grades, setGrades] = useState<Record<string, Record<string, string>>>({ "1": {}, "2": {}, "3": {} });
  const [saving, setSaving] = useState(false);
  const subjects = getSubjectsForLevel(result.student.niveau as Niveau);

  useEffect(() => {
    const g: Record<string, Record<string, string>> = { "1": {}, "2": {}, "3": {} };
    for (const [t, subs] of Object.entries(result.scores)) {
      g[t] = {};
      for (const [sub, score] of Object.entries(subs)) g[t]![sub] = String(score);
    }
    setGrades(g);
  }, [result]);

  const setScore = (subject: string, val: string) =>
    setGrades(prev => ({ ...prev, [String(tri)]: { ...prev[String(tri)], [subject]: val } }));

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
        if (!res.ok) throw new Error("Failed");
      }
      toast({ title: "تم حفظ النقاط ✓" });
      onSaved(); onClose();
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {subjects.map((s, i) => (
            <motion.div key={s.key} className="flex items-center gap-3"
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">{s.arLabel}</p>
                <p className="text-xs text-muted-foreground">معامل {s.coef}</p>
              </div>
              <Input type="number" min={0} max={20} step={0.25} placeholder="— /20"
                className="w-20 text-center font-mono text-base"
                value={grades[String(tri)]?.[s.key] ?? ""}
                onChange={e => setScore(s.key, e.target.value)} />
            </motion.div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t pt-3 mt-1">
          <div className="text-sm text-muted-foreground">
            معدل الفصل {tri}:
            <span className={`ms-2 text-xl font-extrabold ${
              triAvg === null ? "text-muted-foreground" : triAvg >= 10 ? "text-emerald-600" : "text-red-500"
            }`}>{triAvg !== null ? triAvg.toFixed(2) : "—"}</span>
            {triAvg !== null && <span className="text-muted-foreground text-xs ms-1">/20</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ النقاط"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Results() {
  const { t } = useLanguage();
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StudentResult | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [annee, setAnnee] = useState("2025-2026");
  const [filters, setFilters] = useState({ niveau: "", classe: "", q: "" });
  const [listKey, setListKey] = useState(0);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.niveau) p.set("niveau", filters.niveau);
      if (filters.classe) p.set("classe", filters.classe);
      const res = await fetch(`${BASE}api/results?${p}`, { credentials: "include" });
      if (res.ok) { setResults(await res.json()); setListKey(k => k + 1); }
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const classes = [...new Set(results.map(r => r.student.classe))].sort();
  const displayed = filters.q
    ? results.filter(r => r.student.nomPrenom.toLowerCase().includes(filters.q.toLowerCase()))
    : results;

  const niveauLabel = filters.niveau ? LEVEL_LABELS[filters.niveau as Niveau] : "جميع المستويات";

  const handlePrint = () => {
    if (displayed.length === 0) return;
    printResults(displayed, niveauLabel, filters.classe, t);
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 space-y-5 max-w-7xl mx-auto">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <motion.h1 className="text-2xl font-bold" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          {t("results.title")}
        </motion.h1>
        <motion.div className="flex items-center gap-2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <Button variant="outline"
            className="gap-2"
            onClick={handlePrint}
            disabled={displayed.length === 0}>
            <Printer className="w-4 h-4" />
            طباعة
          </Button>
          <Button variant="outline"
            className="gap-2 border-emerald-500/40 text-emerald-600 hover:bg-emerald-50/10 hover:border-emerald-500"
            onClick={() => setShowImport(true)}>
            <FileSpreadsheet className="w-4 h-4" />
            استيراد Excel
          </Button>
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div className="flex flex-wrap gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input className="ps-9" placeholder={t("students.search")} value={filters.q}
            onChange={e => setFilters(p => ({ ...p, q: e.target.value }))} />
        </div>
        <Select value={filters.niveau || "__all__"}
          onValueChange={v => setFilters(p => ({ ...p, niveau: v === "__all__" ? "" : v, classe: "" }))}>
          <SelectTrigger className="w-36"><SelectValue placeholder={t("students.filterLevel")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("students.allLevels")}</SelectItem>
            {LEVELS.map(l => <SelectItem key={l} value={l}>{LEVEL_LABELS[l]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.classe || "__all__"}
          onValueChange={v => setFilters(p => ({ ...p, classe: v === "__all__" ? "" : v }))}>
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
                    {["#", t("col.name"), t("col.level"), t("col.class"), t("col.t1"), t("col.t2"), t("col.t3"), t("col.avg"), t("col.result"), ""].map((h, i) => (
                      <th key={i} className="px-3 py-3 text-start text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((r, i) => (
                    <motion.tr key={r.student.id}
                      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.02, 0.4) }}
                      className={`border-t hover:bg-muted/30 transition-colors cursor-pointer ${i % 2 === 0 ? "" : "bg-muted/15"}`}
                      onClick={() => setSelected(r)}>
                      <td className="px-3 py-3 text-muted-foreground text-xs font-mono">
                        {r.rank !== null ? (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            r.rank === 1 ? "bg-amber-100 text-amber-700"
                              : r.rank === 2 ? "bg-slate-100 text-slate-600"
                              : r.rank === 3 ? "bg-orange-100 text-orange-600"
                              : "text-muted-foreground"
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
                        {r.passed === null
                          ? <span className="text-muted-foreground text-xs">—</span>
                          : r.passed
                            ? <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{t("val.admis")}</span>
                            : <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">{t("val.non_admis")}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                            onClick={e => { e.stopPropagation(); setSelected(r); }}>
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
        <GradeModal result={selected} annee={annee} onClose={() => setSelected(null)} onSaved={fetchResults} />
      )}
      {showImport && (
        <ImportModal annee={annee} onClose={() => setShowImport(false)} onDone={fetchResults} />
      )}
    </motion.div>
  );
}