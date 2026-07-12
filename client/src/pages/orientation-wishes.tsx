import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList, Upload, Search, CheckCircle2, XCircle, HelpCircle, Users, Printer,
} from "lucide-react";
import type { OrientationWish } from "@shared/types";

const BASE = import.meta.env.BASE_URL;
const YEARS = ["2026-2027", "2025-2026", "2024-2025", "2023-2024"];

export default function OrientationWishesPage() {
  const [year, setYear] = useState(() => localStorage.getItem("cem-selected-year") || "2025-2026");
  const [wishes, setWishes] = useState<OrientationWish[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [q, setQ] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async (y: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/orientation/wishes?annee=${y}`, { credentials: "include" });
      if (res.ok) setWishes(await res.json());
      else setWishes([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(year); localStorage.setItem("cem-selected-year", year); }, [year, fetchData]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("annee", year);
      Array.from(files).forEach(f => form.append("files", f));
      const res = await fetch(`${BASE}api/orientation/wishes/import`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "تم استيراد الرغبات",
          description: `تم استيراد ${data.imported} تلميذاً، تمت مطابقة ${data.matched} منهم مع سجل التلاميذ${data.unmatched.length ? `، لم تتم مطابقة ${data.unmatched.length}` : ""}.`,
        });
        fetchData(year);
      } else {
        toast({ title: "فشل الاستيراد", description: data.error ?? "خطأ غير متوقع", variant: "destructive" });
      }
    } catch {
      toast({ title: "فشل الاستيراد", description: "تعذّر الاتصال بالخادم", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filtered = wishes.filter(w =>
    !q || `${w.lastName} ${w.firstName}`.toLowerCase().includes(q.toLowerCase())
  );

  const matchedCount = wishes.filter(w => w.firstChoiceMatchesSuggestion === true).length;
  const mismatchCount = wishes.filter(w => w.firstChoiceMatchesSuggestion === false).length;
  const unmatchedStudentCount = wishes.filter(w => !w.studentId).length;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }} className="p-6 space-y-6 max-w-6xl mx-auto">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent flex items-center gap-2.5">
            <span className="inline-flex w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 items-center justify-center shadow-lg shadow-amber-500/30">
              <ClipboardList className="w-4.5 h-4.5 text-white" />
            </span>
            رغبات التوجيه المسبق
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 ms-11">رغبات كل تلميذ مرتّبة، مقارنة بالمسار المقترح آلياً من المعدل</p>
        </div>
        <div className="flex items-center gap-2 no-print flex-wrap">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-36 h-9 bg-gradient-to-r from-amber-600 to-orange-600 text-white border-0 shadow-lg font-semibold text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button size="sm" variant="outline" className="gap-1.5 h-9 text-xs" disabled={uploading}
            onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" /> {uploading ? "جارِ الاستيراد..." : "استيراد ملفات الرغبات"}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 h-9 text-xs" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5" /> طباعة
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <motion.div className="w-10 h-10 rounded-full border-2 border-amber-500 border-t-transparent"
            animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
        </div>
      ) : wishes.length === 0 ? (
        <div className="text-center py-20">
          <ClipboardList className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground mb-3">لا توجد رغبات مستوردة لهذه السنة الدراسية</p>
          <Button size="sm" className="gap-1.5" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" /> استيراد ملفات الرغبات
          </Button>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 p-4 shadow-lg">
              <p className="text-white/80 text-xs font-semibold mb-1">الإجمالي</p>
              <p className="text-white font-black text-3xl">{wishes.length}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-green-700 p-4 shadow-lg">
              <p className="text-white/80 text-xs font-semibold mb-1">رغبة 1 = الاقتراح</p>
              <p className="text-white font-black text-3xl">{matchedCount}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-amber-700 p-4 shadow-lg">
              <p className="text-white/80 text-xs font-semibold mb-1">رغبة 1 ≠ الاقتراح</p>
              <p className="text-white font-black text-3xl">{mismatchCount}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 to-rose-700 p-4 shadow-lg">
              <p className="text-white/80 text-xs font-semibold mb-1">غير مطابق لسجل التلاميذ</p>
              <p className="text-white font-black text-3xl">{unmatchedStudentCount}</p>
            </motion.div>
          </div>

          <div className="relative no-print">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث بالاسم..." className="ps-9 h-10" />
          </div>

          <Card className="border-0 bg-card/80 shadow-md overflow-hidden">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                قائمة الرغبات ({filtered.length})
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b text-muted-foreground text-xs">
                    <th className="p-3 text-right">الاسم</th>
                    <th className="p-3 text-center">المعدل</th>
                    <th className="p-3 text-right">الرغبات المرتّبة</th>
                    <th className="p-3 text-center">المسار المقترح آلياً</th>
                    <th className="p-3 text-center">التطابق</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((w, i) => (
                    <motion.tr key={w.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.01, 0.3) }}
                      className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                      <td className="p-3 font-semibold">
                        {w.lastName} {w.firstName}
                        {!w.studentId && (
                          <Badge variant="outline" className="ms-2 text-[10px] border-red-300 text-red-600">غير موجود في سجل التلاميذ</Badge>
                        )}
                      </td>
                      <td className="p-3 text-center font-black text-emerald-600">
                        {w.annualAvg !== null ? w.annualAvg.toFixed(2) : "—"}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1.5">
                          {w.choices.map((c, idx) => (
                            <span key={idx} className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                              idx === 0 ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300" : "bg-muted text-muted-foreground"
                            }`}>
                              {idx + 1}. {c}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {w.suggestedTrack
                          ? <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">{w.suggestedTrack}</span>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3 text-center">
                        {w.firstChoiceMatchesSuggestion === true && <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 mx-auto" />}
                        {w.firstChoiceMatchesSuggestion === false && <XCircle className="w-4.5 h-4.5 text-orange-500 mx-auto" />}
                        {w.firstChoiceMatchesSuggestion === null && <HelpCircle className="w-4.5 h-4.5 text-muted-foreground/40 mx-auto" />}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </motion.div>
  );
}
