import { useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL;

const SAMPLE_JSON = `[
  { "student_id": "2023001", "name": "Aymen Benali", "value": 15.5 },
  { "student_id": "2023002", "name": "Sarah Mansouri", "value": 18 }
]`;

export default function ExcelInjectionPage() {
  const { toast } = useToast();
  const [template, setTemplate] = useState<File | null>(null);
  const [studentsJson, setStudentsJson] = useState(SAMPLE_JSON);
  const [worksheetName, setWorksheetName] = useState("");
  const [studentIdHeader, setStudentIdHeader] = useState("Matricule");
  const [targetColumn, setTargetColumn] = useState("");
  const [headerRow, setHeaderRow] = useState("1");
  const [dataStartRow, setDataStartRow] = useState("2");
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastReport, setLastReport] = useState<{ updated: number; skipped: number } | null>(null);

  async function inject() {
    if (!template) {
      toast({ title: "القالب مطلوب", description: "اختر ملف .xlsx أولاً", variant: "destructive" });
      return;
    }
    if (!targetColumn.trim()) {
      toast({ title: "عمود الهدف مطلوب", description: "اكتب اسم عنوان العمود الذي ستوضع فيه القيم", variant: "destructive" });
      return;
    }

    let parsedStudents: unknown;
    try {
      parsedStudents = JSON.parse(studentsJson);
      if (!Array.isArray(parsedStudents)) throw new Error("يجب أن تكون البيانات مصفوفة JSON");
    } catch (error) {
      toast({ title: "JSON غير صالح", description: error instanceof Error ? error.message : "تحقق من تنسيق البيانات", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("template", template);
      form.append("studentsJson", JSON.stringify(parsedStudents));
      form.append("optionsJson", JSON.stringify({
        worksheetName: worksheetName.trim() || undefined,
        studentIdHeader: studentIdHeader.trim() || "Matricule",
        targetColumn: targetColumn.trim(),
        headerRow: Number(headerRow) || 1,
        dataStartRow: Number(dataStartRow) || 2,
        overwriteExisting,
      }));

      const response = await fetch(`${BASE}api/excel-injection`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `injected-${Date.now()}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      const report = {
        updated: Number(response.headers.get("x-excel-updated") ?? 0),
        skipped: Number(response.headers.get("x-excel-skipped") ?? 0),
      };
      setLastReport(report);
      toast({ title: "تم إنشاء الملف", description: `تم تحديث ${report.updated} صف وتخطي ${report.skipped} صف.` });
    } catch (error) {
      toast({ title: "فشل الحقن", description: error instanceof Error ? error.message : "تعذر معالجة الملف", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main dir="rtl" className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">حقن البيانات في Excel</h1>
          <p className="mt-1 text-sm text-muted-foreground">طابق التلاميذ عبر Matricule واكتب القيم في عمود محدد دون تغيير تصميم القالب.</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">1. القالب والبيانات</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <label className="block space-y-2 text-sm font-semibold">
              قالب Excel (.xlsx)
              <div className="flex items-center gap-3 rounded-xl border border-dashed p-4">
                <Upload className="h-5 w-5 text-emerald-500" />
                <Input type="file" accept=".xlsx" onChange={event => setTemplate(event.target.files?.[0] ?? null)} />
              </div>
              {template && <span className="text-xs text-muted-foreground">{template.name} · {(template.size / 1024).toFixed(1)} KB</span>}
            </label>

            <label className="block space-y-2 text-sm font-semibold">
              بيانات الطلاب بصيغة JSON
              <textarea value={studentsJson} onChange={event => setStudentsJson(event.target.value)} spellCheck={false} className="min-h-52 w-full rounded-xl border bg-muted/20 p-3 font-mono text-xs leading-5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" dir="ltr" />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">2. إعداد المطابقة والهدف</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-1 text-sm">اسم الورقة <Input value={worksheetName} onChange={event => setWorksheetName(event.target.value)} placeholder="فارغ = أول ورقة" /></label>
            <label className="block space-y-1 text-sm">عنوان عمود Matricule <Input value={studentIdHeader} onChange={event => setStudentIdHeader(event.target.value)} dir="ltr" /></label>
            <label className="block space-y-1 text-sm">عنوان عمود الهدف <Input value={targetColumn} onChange={event => setTargetColumn(event.target.value)} placeholder="مثال: علامة الاختبار" dir="ltr" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-sm">صف العناوين <Input type="number" min="1" value={headerRow} onChange={event => setHeaderRow(event.target.value)} /></label>
              <label className="block space-y-1 text-sm">أول صف بيانات <Input type="number" min="2" value={dataStartRow} onChange={event => setDataStartRow(event.target.value)} /></label>
            </div>
            <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              <input type="checkbox" checked={overwriteExisting} onChange={event => setOverwriteExisting(event.target.checked)} />
              استبدال القيم الموجودة
            </label>
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              الخلايا التي تحتوي صيغة أو تقع داخل دمج يتم تخطيها لحماية القالب.
            </div>
            <Button onClick={inject} disabled={busy} className="w-full bg-emerald-600 text-white hover:bg-emerald-700">
              {busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Download className="ml-2 h-4 w-4" />}
              {busy ? "جارٍ تجهيز الملف…" : "حقن البيانات وتنزيل Excel"}
            </Button>
            {lastReport && <p className="text-center text-xs text-muted-foreground">آخر عملية: تم تحديث {lastReport.updated} صف، وتخطي {lastReport.skipped} صف.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <p>استخدم ملف XLSX فقط. الملف الأصلي لا يتغير؛ يتم تنزيل نسخة جديدة بعد الحقن.</p>
      </div>
    </main>
  );
}
