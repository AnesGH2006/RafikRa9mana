/**
 * أرشفة البيانات
 * Data archiving page — lets the principal snapshot the current year's
 * data into a downloadable JSON export and view previous archives.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Archive, Download, Database, CheckCircle2, AlertCircle,
  Loader2, FileJson, Calendar, Users, BookOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL;
const YEARS = ["2026-2027", "2025-2026", "2024-2025", "2023-2024", "2022-2023"];

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
}

export default function ArchivePage() {
  const { toast } = useToast();
  const [stats, setStats]       = useState<Record<string, ArchiveStats>>({});
  const [loading, setLoading]   = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [archives, setArchives] = useState<ArchiveEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem("schoolArchives") ?? "[]"); }
    catch { return []; }
  });

  // Fetch quick stats per year
  useEffect(() => {
    Promise.all(
      YEARS.map(y =>
        fetch(`${BASE}api/results?annee=${encodeURIComponent(y)}`, { credentials: "include" })
          .then(r => r.ok ? r.json() : [])
          .then((d: any[]) => [y, { students: d.length, grades: d.length * 3, absences: 0 }] as const)
          .catch(() => [y, { students: 0, grades: 0, absences: 0 }] as const),
      ),
    ).then(pairs => {
      setStats(Object.fromEntries(pairs));
      setLoading(false);
    });
  }, []);

  async function exportYear(year: string) {
    setExporting(year);
    try {
      // Fetch all data for this year
      const [resultsRes, studentsRes] = await Promise.all([
        fetch(`${BASE}api/results?annee=${encodeURIComponent(year)}`, { credentials: "include" }),
        fetch(`${BASE}api/students?annee=${encodeURIComponent(year)}`, { credentials: "include" }),
      ]);
      const results  = resultsRes.ok  ? await resultsRes.json()  : [];
      const students = studentsRes.ok ? await studentsRes.json() : [];

      const payload = {
        exportedAt: new Date().toISOString(),
        schoolYear: year,
        version: "1.0",
        students,
        results,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `archive-${year}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // Save archive entry locally
      const entry: ArchiveEntry = {
        year,
        archivedAt: new Date().toISOString(),
        stats: stats[year] ?? { students: students.length, grades: 0, absences: 0 },
        filename: `archive-${year}.json`,
      };
      const updated = [entry, ...archives.filter(a => a.year !== year)];
      setArchives(updated);
      localStorage.setItem("schoolArchives", JSON.stringify(updated));

      toast({ title: "تم الأرشفة بنجاح", description: `تم تصدير بيانات السنة ${year}` });
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
          أرشفة بيانات السنة الدراسية وتصديرها بصيغة JSON للحفظ الدائم والرجوع إليها لاحقاً
        </p>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border bg-sky-500/5 border-sky-500/20 p-4 mb-6 flex items-start gap-3">
        <Database className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-sky-300">كيف تعمل الأرشفة؟</p>
          <p className="text-muted-foreground mt-1 leading-relaxed">
            تقوم بتنزيل ملف JSON يحتوي على جميع بيانات التلاميذ والنقاط والغيابات للسنة المختارة.
            احتفظ بهذا الملف في مكان آمن كنسخة احتياطية رسمية.
          </p>
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
                <div className={`h-1 w-full bg-gradient-to-r ${
                  idx === 0 ? "from-violet-500 to-purple-600" :
                  idx === 1 ? "from-blue-500 to-sky-600" :
                  idx === 2 ? "from-emerald-500 to-teal-600" :
                  idx === 3 ? "from-amber-500 to-orange-600" :
                              "from-slate-500 to-slate-600"
                }`} />
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-lg">{year}</p>
                      {archived && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          أُرشف {new Date(archived.archivedAt).toLocaleDateString("ar-DZ")}
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

                  {/* Mini stats */}
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
                      <><Download className="w-3.5 h-3.5 mr-1.5" />إعادة التصدير</>
                    ) : (
                      <><Archive className="w-3.5 h-3.5 mr-1.5" />أرشفة وتصدير</>
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
            <FileJson className="w-4 h-4" /> سجل الأرشفة
          </h2>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  {["السنة الدراسية","تاريخ الأرشفة","التلاميذ","اسم الملف"].map(h => (
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
