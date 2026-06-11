import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X } from "lucide-react";
import { CountUp } from "@/components/count-up";

const BASE = import.meta.env.BASE_URL;

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export default function ImportPage() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [resultOpen, setResultOpen] = useState(false);

  const doImport = async (file: File) => {
    setImporting(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${BASE}api/students/import`, { method: "POST", body: form, credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setResultOpen(true);
      } else {
        toast({ variant: "destructive", title: "خطأ في الاستيراد", description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ في الاتصال" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && /\.(xlsx|xls)$/i.test(file.name)) doImport(file);
    else toast({ variant: "destructive", title: "يجب أن يكون الملف بصيغة .xlsx أو .xls" });
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 space-y-8 max-w-2xl mx-auto">

      <motion.h1 className="text-2xl font-bold" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        استيراد البيانات
      </motion.h1>

      {/* Drop zone */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200
          ${dragOver ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 scale-[1.01]" : "border-muted-foreground/25 hover:border-blue-400 hover:bg-muted/30"}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) doImport(f); }} />

        <motion.div animate={dragOver ? { scale: 1.15 } : { scale: 1 }} transition={{ type: "spring", stiffness: 300 }}>
          {importing ? (
            <motion.div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
              animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
          ) : (
            <motion.div className={`w-16 h-16 rounded-2xl ${dragOver ? "bg-blue-500" : "bg-blue-500/10"} flex items-center justify-center mx-auto mb-4`}
              animate={dragOver ? {} : { y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
              <FileSpreadsheet className={`w-8 h-8 ${dragOver ? "text-white" : "text-blue-500"}`} />
            </motion.div>
          )}
        </motion.div>

        <p className="text-lg font-semibold text-foreground mb-1">
          {importing ? "جارٍ الاستيراد..." : "أسقط ملف Excel هنا"}
        </p>
        <p className="text-sm text-muted-foreground mb-3">أو انقر للاختيار من الجهاز</p>
        <p className="text-xs text-muted-foreground">يقبل .xlsx و .xls — حجم أقصى 20MB</p>
      </motion.div>

      {/* Required columns info */}
      <motion.div className="rounded-xl bg-muted/50 border p-5 space-y-3"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <p className="font-semibold text-sm">الأعمدة المطلوبة في الملف:</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { col: "الاسم واللقب", note: "أو اللقب + الاسم في عمودين" },
            { col: "المستوى", note: "1AM أو أولى، ثانية..." },
            { col: "القسم", note: "A, B, C أو أ، ب، ج" },
            { col: "الجنس", note: "ذكر/أنثى أو M/F أو ذ/أ" },
            { col: "تاريخ الميلاد", note: "اختياري" },
            { col: "الوضعية", note: "جديد/معيد — اختياري" },
          ].map((item, i) => (
            <motion.div key={i} className="flex items-start gap-2"
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 + 0.25 }}>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
              <div>
                <span className="text-sm font-semibold">{item.col}</span>
                <span className="text-xs text-muted-foreground block">{item.note}</span>
              </div>
            </motion.div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          ⚡ الملف قد يحتوي صفوفًا للترويسة قبل البيانات — يتم التعرف عليها تلقائياً.
        </p>
      </motion.div>

      {/* Import result dialog */}
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result?.imported ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </motion.div>
              ) : <AlertCircle className="w-5 h-5 text-amber-500" />}
              {result?.imported ? "تم الاستيراد بنجاح" : "نتيجة الاستيراد"}
            </DialogTitle>
          </DialogHeader>
          {result && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <motion.div className="flex-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-4 text-center"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <p className="text-3xl font-extrabold text-emerald-600"><CountUp to={result.imported} duration={0.8} /></p>
                  <p className="text-xs text-muted-foreground mt-1">تم الاستيراد</p>
                </motion.div>
                <motion.div className="flex-1 rounded-xl bg-amber-50 dark:bg-amber-950/30 p-4 text-center"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                  <p className="text-3xl font-extrabold text-amber-600"><CountUp to={result.skipped} duration={0.8} /></p>
                  <p className="text-xs text-muted-foreground mt-1">تم التخطي</p>
                </motion.div>
              </div>
              {result.imported > 0 && (
                <motion.div className="h-2 rounded-full bg-muted overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
                  <motion.div className="h-full bg-emerald-500 rounded-full" initial={{ width: 0 }}
                    animate={{ width: `${(result.imported / (result.imported + result.skipped)) * 100}%` }}
                    transition={{ duration: 1, delay: 0.35 }} />
                </motion.div>
              )}
              {result.errors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">أسباب التخطي</p>
                  <div className="rounded-lg border bg-muted/40 p-3 max-h-40 overflow-y-auto space-y-1">
                    {result.errors.map((e, i) => (
                      <motion.p key={i} className="text-xs text-red-600 dark:text-red-400 font-mono"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>{e}</motion.p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResultOpen(false)}>حسناً</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
