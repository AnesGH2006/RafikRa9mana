/**
 * أرشفة البيانات
 * Data archiving page — snapshot the current year's data as JSON or Excel.
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Archive, Download, Database, CheckCircle2,
  Loader2, FileJson, FileSpreadsheet, Calendar, Users, BookOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL;
const YEARS = ["2026-2027", "2025-2026", "2024-2025", "2023-2024", "2022-2023"];

type ExportFormat = "json" | "excel";

interface ArchiveStats {
  students: number;
  grades: number;
  absences: number;
}

interface ArchiveEntry {
  year: string;
  archivedAt: string;
  stats: ArchiveStats;
  filename: string;
  format: ExportFormat;
}

const YEAR_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-sky-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-slate-500 to-slate-600",
];

export default function ArchivePage() {
  const { toast } = useToast();
  const [stats, setStats]         = useState<Record<string, ArchiveStats>>({});
  const [loading, setLoading]     = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [format, setFormat]       = useState<ExportFormat>("json");
  const [archives, setArchives]   = useState<ArchiveEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem("schoolArchives") ?? "[]"); }
    catch { return []; }
  });

  useEffect(() => {
    Promise.all(
      YEARS.map(y =>
        fetch(`${BASE}api/results?annee=${encodeURIComponent(y)}`, { credentials: "include" })
          .then(r => r.ok ? r.json() : [])
          .then((d: any[]) => [y, { students: d.length, grades: d.length * 3, absences: 0 }] as const)
          .catch(() => [y, { students: 0, grades: 0, absences: 0 }] as const),
      ),
    ).then(pairs => { setStats(Object.fromEntries(pairs)); setLoading(false); });
  }, []);

  async function exportYear(year: string) {
    setExporting(year);
    try {
      const [resultsRes, studentsRes] = await Promise.all([
        fetch(`${BASE}api/results?annee=${encodeURIComponent(year)}`, { credentials: "include" }),
        fetch(`${BASE}api/students?annee=${encodeURIComponent(year)}`, { credentials: "include" }),
      ]);
      const results  = resultsRes.ok  ? await resultsRes.json()  : [];
      const students = studentsRes.ok ? await studentsRes.json() : [];

      let blob: Blob;
      let filename: string;

      if (format === "excel") {
        // Build Excel workbook
        const XLSX = await import("xlsx");

        // Students sheet
        const studentRows = (students as any[]).map((s: any) => ({
          "المعرّف": s.id,
          "الاسم واللقب": s.nomPrenom,
          "المستوى": s.niveau,
          "القسم": s.classe,
          "الجنس": s.sexe === "M" ? "ذكر" : "أنثى",
          "الحالة": s.statut === "nouveau" ? "جديد" : "معيد",
          "تاريخ الميلاد": s.dateNaissance ?? "",
          "هاتف الولي": s.parentPhone ?? "",
        }));

        // Results sheet
        const resultRows = (results as any[]).map((r: any) => ({
          "المعرّف": r.student?.id ?? "",
          "الاسم واللقب": r.student?.nomPrenom ?? "",
          "المستوى": r.student?.niveau ?? "",
          "القسم": r.student?.classe ?? "",
          "معدل ف1": r.t1Avg?.toFixed(2) ?? "",
          "معدل ف2": r.t2Avg?.toFixed(2) ?? "",
          "معدل ف3": r.t3Avg?.toFixed(2) ?? "",
          "المعدل السنوي": r.annualAvg?.toFixed(2) ?? "",
          "النتيجة": r.annualAvg !== null ? (r.annualAvg >= 10 ? "ناجح" : r.annualAvg >= 9 ? "مستدرك" : "راسب") : "",
        }));

        const wb = XLSX.utils.book_new();
        const wsStudents = XLSX.utils.json_to_sheet(studentRows);
        const wsResults  = XLSX.utils.json_to_sheet(resultRows);
        XLSX.utils.book_append_sheet(wb, wsStudents, "التلاميذ");
        XLSX.utils.book_append_sheet(wb, wsResults,  "النتائج");

        const wbArray = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        blob = new Blob([wbArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        filename = `archive-${year}.xlsx`;
      } else {
        const payload = {
          exportedAt: new Date().toISOString(),
          schoolYear: year,
          version: "1.0",
          students,
          results,
        };
        blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        filename = `archive-${year}.json`;
      }

      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      const entry: ArchiveEntry = {
        year,
        archivedAt: new Date().toISOString(),
        stats: stats[year] ?? { students: students.length, grades: 0, absences: 0 },
        filename,
        format,
      };
      const updated = [entry, ...archives.filter(a => a.year !== year)];
      setArchives(updated);
      localStorage.setItem("schoolArchives", JSON.stringify(updated));
      toast({ title: "تم الأرشفة بنجاح", description: `تم تصدير بيانات السنة ${year} بصيغة ${format.toUpperCase()}` });
    } catch (err: any) {
      toast({ title: "خطأ في التصدير", description: err.message, variant: "destructive" });
    } finally {
      setExporting(null);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center">
            <Archive className="w-4 h-4 text-sky-400" />
          </span>
          أرشفة البيانات
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          أرشفة بيانات السنة الدراسية وتصديرها كنسخة احتياطية رسمية
        </p>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border bg-sky-500/5 border-sky-500/20 p-4 mb-6 flex items-start gap-3">
        <Database className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-sky-300">كيف تعمل الأرشفة؟</p>
          <p className="text-muted-foreground mt-1 leading-relaxed">
            يتم تنزيل ملف يحتوي على جميع بيانات التلاميذ والنقاط للسنة المختارة.
            احتفظ بهذا الملف في مكان آمن كنسخة احتياطية رسمية.
          </p>
        </div>
      </div>

      {/* Format selector */}
      <div className="mb-6">
        <p className="text-sm font-semibold mb-3 text-muted-foreground">صيغة الملف المُصدَّر</p>
        <div className="flex gap-3">
          <button
            onClick={() => setFormat("json")}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
              format === "json"
                ? "border-sky-500/60 bg-sky-500/10 text-sky-300 shadow-sm"
                : "border-border text-muted-foreground hover:border-sky-500/30 hover:bg-sky-500/5"
            }`}
          >
            <FileJson className="w-4 h-4" />
            JSON
            <span className="text-xs opacity-70 font-normal">للتطبيقات والنسخ الاحتياطية</span>
          </button>
          <button
            onClick={() => setFormat("excel")}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
              format === "excel"
                ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300 shadow-sm"
                : "border-border text-muted-foreground hover:border-emerald-500/30 hover:bg-emerald-500/5"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel (.xlsx)
            <span className="text-xs opacity-70 font-normal">للطباعة والمراجعة</span>
          </button>
        </div>
      </div>

      {/* Year cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {YEARS.map((year, idx) => {
          const s = stats[year];
          const archived = archives.find(a => a.year === year);
          const isExp = exporting === year;
          const hasData = (s?.students ?? 0) > 0;

          return (
            <motion.div
              key={year}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
            >
              <Card className={`overflow-hidden transition-shadow hover:shadow-md ${hasData ? "" : "opacity-60"}`}>
                <div className={`h-1 w-full bg-gradient-to-r ${YEAR_GRADIENTS[idx] ?? "from-slate-500 to-slate-600"}`} />
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-lg">{year}</p>
                      {archived && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          أُرشف {new Date(archived.archivedAt).toLocaleDateString("ar-DZ")}
                          {archived.format && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-1">
                              {archived.format.toUpperCase()}
                            </Badge>
                          )}
                        </p>
                      )}
                    </div>
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Badge variant={hasData ? "default" : "secondary"} className="text-xs">
                        {hasData ? `${s!.students} تلميذ` : "لا توجد بيانات"}
                      </Badge>
                    )}
                  </div>

                  {hasData && s && (
                    <div className="flex gap-4 mb-4">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span>{s.students} تلميذ</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>نقاط {s.students * 3} سجل</span>
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    variant={archived ? "outline" : "default"}
                    size="sm"
                    disabled={!hasData || isExp}
                    onClick={() => exportYear(year)}
                  >
                    {isExp ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />جارٍ التصدير…</>
                    ) : archived ? (
                      <><Download className="w-3.5 h-3.5 mr-1.5" />إعادة التصدير ({format.toUpperCase()})</>
                    ) : (
                      <>{format === "excel"
                        ? <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                        : <Archive className="w-3.5 h-3.5 mr-1.5" />
                      }أرشفة وتصدير ({format.toUpperCase()})</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Archive history */}
      {archives.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> سجل الأرشفة
          </h2>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  {["السنة الدراسية", "تاريخ الأرشفة", "التلاميذ", "الصيغة", "اسم الملف"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {archives.map((a, i) => (
                  <tr key={a.year} className={`border-t ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="px-4 py-2.5 font-medium">{a.year}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {new Date(a.archivedAt).toLocaleString("ar-DZ")}
                    </td>
                    <td className="px-4 py-2.5">{a.stats.students}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="secondary" className="text-xs">
                        {(a.format ?? "json").toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-sky-400">{a.filename}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}
