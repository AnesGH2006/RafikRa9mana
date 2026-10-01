import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, Loader2, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL;
const YEARS = ["2026-2027", "2025-2026", "2024-2025"];
type SourceRow = { student_id: string | number; name?: string; value: string | number | boolean | null; values?: Record<string, string | number | boolean | null> };
type Mapping = { source: string; target: string };
type Inspection = { worksheetNames: string[]; worksheetName: string; headers: string[]; rows: Array<{ rowNumber: number; studentId: string; name: string }> };

function parsePastedTable(text: string): SourceRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const delimiter = lines[0]!.includes("\t") ? "\t" : ",";
  const headers = lines[0]!.split(delimiter).map(value => value.trim().toLowerCase());
  const idIndex = headers.findIndex(value => /student[_ ]?id|matricule|رقم/.test(value));
  const nameIndex = headers.findIndex(value => /name|nom|اسم/.test(value));
  const valueIndex = headers.findIndex(value => /value|score|note|علامة|معدل/.test(value));
  return lines.slice(1).map(line => {
    const cells = line.split(delimiter).map(value => value.trim());
    const rawValue = cells[valueIndex >= 0 ? valueIndex : 2] ?? "";
    const numeric = rawValue === "" ? null : Number(rawValue);
    return { student_id: cells[idIndex >= 0 ? idIndex : 0] ?? "", name: cells[nameIndex >= 0 ? nameIndex : 1] ?? "", value: Number.isFinite(numeric) ? numeric : rawValue };
  }).filter(row => String(row.student_id).trim());
}

export default function ExcelInjectionPage() {
  const { toast } = useToast();
  const [template, setTemplate] = useState<File | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [sourceMode, setSourceMode] = useState<"system" | "paste">("system");
  const [year, setYear] = useState("2025-2026");
  const [level, setLevel] = useState("");
  const [systemRows, setSystemRows] = useState<SourceRow[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [worksheetName, setWorksheetName] = useState("");
  const [studentIdHeader, setStudentIdHeader] = useState("Matricule");
  const [headerRow, setHeaderRow] = useState("1");
  const [dataStartRow, setDataStartRow] = useState("2");
  const [mappings, setMappings] = useState<Mapping[]>([{ source: "value", target: "" }]);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastReport, setLastReport] = useState<{ updated: number; skipped: number; total: number } | null>(null);
  const [auditDetails, setAuditDetails] = useState<Array<{ student_id: string | number; reason: string; detail: string }>>([]);

  const pasteRows = useMemo(() => parsePastedTable(pasteText), [pasteText]);
  const rows = sourceMode === "system" ? systemRows : pasteRows;
  const sourceFields = ["value", "t1_average", "t2_average", "t3_average", "annual_average", "justified_hours", "unjustified_hours"];

  useEffect(() => {
    if (sourceMode !== "system") return;
    fetch(`${BASE}api/excel-injection/school-data?annee=${encodeURIComponent(year)}${level ? `&niveau=${encodeURIComponent(level)}` : ""}`, { credentials: "include" })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(payload => setSystemRows(payload.rows ?? []))
      .catch(() => setSystemRows([]));
  }, [sourceMode, year, level]);

  async function inspect(file: File) {
    setTemplate(file);
    const form = new FormData();
    form.append("template", file);
    form.append("worksheetName", worksheetName);
    form.append("headerRow", headerRow);
    form.append("dataStartRow", dataStartRow);
    form.append("studentIdHeader", studentIdHeader);
    const response = await fetch(`${BASE}api/excel-injection/inspect`, { method: "POST", credentials: "include", body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "تعذر قراءة القالب");
    setInspection(payload);
    setWorksheetName(payload.worksheetName ?? "");
    setStudentIdHeader(payload.studentIdHeader ?? payload.headers?.find((header: string) => /matricule|رقم/.test(header.toLowerCase())) ?? "Matricule");
    setMappings(current => current.map((mapping, index) => index === 0 ? { ...mapping, target: payload.headers?.find((header: string) => header !== studentIdHeader) ?? "" } : mapping));
  }

  function updateMapping(index: number, key: keyof Mapping, value: string) {
    setMappings(current => current.map((mapping, itemIndex) => itemIndex === index ? { ...mapping, [key]: value } : mapping));
  }

  async function inject() {
    if (!template || !inspection) { toast({ title: "ارفع قالب Excel أولاً", variant: "destructive" }); return; }
    if (mappings.some(mapping => !mapping.source || !mapping.target)) { toast({ title: "أكمل ربط الأعمدة", variant: "destructive" }); return; }
    const targetColumns = Object.fromEntries(mappings.map(mapping => [mapping.source, mapping.target]));
    const normalizedRows = rows.map(row => ({ ...row, value: row.values?.value ?? row.value }));
    setBusy(true);
    try {
      const form = new FormData();
      form.append("template", template);
      form.append("studentsJson", JSON.stringify(normalizedRows));
      form.append("optionsJson", JSON.stringify({ worksheetName: inspection.worksheetName, studentIdHeader, targetColumns, headerRow: Number(headerRow) || 1, dataStartRow: Number(dataStartRow) || 2, overwriteExisting }));
      const response = await fetch(`${BASE}api/excel-injection`, { method: "POST", credentials: "include", body: form });
      if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error ?? `HTTP ${response.status}`); }
      const blob = await response.blob();
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `injected-${Date.now()}.xlsx`; link.click(); URL.revokeObjectURL(link.href);
      const report = { updated: Number(response.headers.get("x-excel-updated") ?? 0), skipped: Number(response.headers.get("x-excel-skipped") ?? 0), total: rows.length };
      setLastReport(report);
      const encodedAudit = response.headers.get("x-excel-skip-report");
      setAuditDetails(encodedAudit ? JSON.parse(decodeURIComponent(encodedAudit)) : []);
      toast({ title: "تم تنزيل الملف", description: `تم حقن ${report.updated} خلية من أصل ${report.total} تلميذ.` });
    } catch (error) { toast({ title: "فشل الحقن", description: error instanceof Error ? error.message : "تعذر معالجة الملف", variant: "destructive" }); }
    finally { setBusy(false); }
  }

  return (
    <main dir="rtl" className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg"><FileSpreadsheet className="h-5 w-5" /></div><div><h1 className="text-2xl font-extrabold">حقن البيانات في Excel</h1><p className="mt-1 text-sm text-muted-foreground">ارفع القالب، اختر مصدر البيانات، راجع المطابقة، ثم نزّل نسخة جديدة دون تغيير تصميم القالب.</p></div></header>

      <Card><CardHeader><CardTitle className="text-base">1. قالب Excel والكشف التلقائي</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-4"><label className="space-y-2 text-sm font-semibold md:col-span-2">القالب (.xlsx)<Input type="file" accept=".xlsx" onChange={event => { const file = event.target.files?.[0]; if (file) inspect(file).catch(error => toast({ title: "فشل قراءة القالب", description: error.message, variant: "destructive" })); }} /></label><label className="space-y-2 text-sm">صف العناوين<Input type="number" min="1" value={headerRow} onChange={event => setHeaderRow(event.target.value)} /></label><label className="space-y-2 text-sm">أول صف بيانات<Input type="number" min="2" value={dataStartRow} onChange={event => setDataStartRow(event.target.value)} /></label>{template && <p className="text-xs text-muted-foreground md:col-span-4">{template.name} · {inspection ? `${inspection.headers.length} أعمدة، ${inspection.rows.length} صفوف مقروءة` : "جارٍ الكشف…"}</p>}</CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">2. مصدر البيانات</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex gap-2"><Button variant={sourceMode === "system" ? "default" : "outline"} onClick={() => setSourceMode("system")}>بيانات النظام</Button><Button variant={sourceMode === "paste" ? "default" : "outline"} onClick={() => setSourceMode("paste")}>لصق Excel/CSV</Button></div>{sourceMode === "system" ? <div className="grid gap-3 md:grid-cols-2"><label className="text-sm">السنة<select value={year} onChange={event => setYear(event.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-2">{YEARS.map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm">المستوى<select value={level} onChange={event => setLevel(event.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-2"><option value="">كل المستويات</option>{["1AM", "2AM", "3AM", "4AM", "1AS", "2AS", "3AS"].map(value => <option key={value}>{value}</option>)}</select></label></div> : <label className="block text-sm">الصق جدولًا من Excel أو CSV<textarea value={pasteText} onChange={event => setPasteText(event.target.value)} placeholder="Matricule\tالاسم\tالعلامة\n2023001\tأحمد\t15" className="mt-1 min-h-32 w-full rounded-xl border bg-muted/20 p-3 font-mono text-xs" dir="ltr" /></label>}<p className="text-xs text-muted-foreground">عدد السجلات الجاهزة: {rows.length}</p></CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">3. ربط الحقول بالأعمدة</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><label className="text-sm">عمود Matricule<select value={studentIdHeader} onChange={event => setStudentIdHeader(event.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-2"><option value="">اختر العمود</option>{(inspection?.headers ?? []).map(header => <option key={header}>{header}</option>)}</select></label><span className="text-sm text-muted-foreground md:col-span-2 md:self-end">تم الكشف تلقائيًا عن {inspection?.headers.length ?? 0} عمود</span></div>{mappings.map((mapping, index) => <div key={index} className="grid gap-3 rounded-xl border bg-muted/20 p-3 md:grid-cols-[1fr_1fr_auto]"><label className="text-sm">حقل المصدر<select value={mapping.source} onChange={event => updateMapping(index, "source", event.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-2">{sourceFields.map(field => <option key={field}>{field}</option>)}</select></label><label className="text-sm">عمود Excel<select value={mapping.target} onChange={event => updateMapping(index, "target", event.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-2"><option value="">اختر العمود</option>{(inspection?.headers ?? []).filter(header => header !== studentIdHeader).map(header => <option key={header}>{header}</option>)}</select></label><Button variant="ghost" size="icon" className="self-end" disabled={mappings.length === 1} onClick={() => setMappings(current => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}<Button variant="outline" size="sm" onClick={() => setMappings(current => [...current, { source: "annual_average", target: "" }])}><Plus className="ml-1 h-4 w-4" /> إضافة عمود آخر</Button><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={overwriteExisting} onChange={event => setOverwriteExisting(event.target.checked)} /> استبدال القيم الموجودة</label></CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">4. المعاينة والتدقيق</CardTitle></CardHeader><CardContent className="space-y-3"><div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="p-2 text-right">Matricule</th><th className="p-2 text-right">الاسم</th>{mappings.map(mapping => <th key={mapping.source} className="p-2 text-right">{mapping.source}</th>)}<th className="p-2 text-right">الحالة</th></tr></thead><tbody>{rows.slice(0, 4).map(row => <tr key={String(row.student_id)} className="border-t"><td className="p-2 font-mono">{row.student_id}</td><td className="p-2">{row.name ?? "—"}</td>{mappings.map(mapping => <td key={mapping.source} className="p-2">{mapping.source === "value" ? row.value : row.values?.[mapping.source] ?? "—"}</td>)}<td className="p-2 text-emerald-600">جاهز</td></tr>)}</tbody></table></div><div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200"><ShieldCheck className="h-4 w-4 shrink-0" />الصيغ والخلايا المدمجة محمية ولن تُستبدل.</div><Button onClick={inject} disabled={busy || !inspection || !rows.length} className="w-full bg-emerald-600 text-white hover:bg-emerald-700">{busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Download className="ml-2 h-4 w-4" />}{busy ? "جارٍ تجهيز الملف…" : "حقن البيانات وتنزيل Excel"}</Button>{lastReport && <><p className="text-center text-sm">تم حقن {lastReport.updated} خلية من أصل {lastReport.total} تلميذ، وتخطي {lastReport.skipped}.</p>{auditDetails.length > 0 && <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200"><p className="mb-2 font-bold">تفاصيل المطابقة والتخطي:</p>{auditDetails.map((item, index) => <p key={index} className="border-b border-red-200/50 py-1 last:border-0">{item.student_id || "بدون رقم"}: {item.detail} ({item.reason})</p>)}</div>}</>}</CardContent></Card><div className="flex gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200"><AlertTriangle className="h-5 w-5 shrink-0" />يتم إنشاء نسخة جديدة؛ الملف الأصلي لا يتغير.</div>
    </main>
  );
}
