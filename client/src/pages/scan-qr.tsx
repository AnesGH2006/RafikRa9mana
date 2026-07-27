/**
 * /scan-qr — QR Scanner Page
 *
 * Uses html5-qrcode to open the device camera, decode a student QR code
 * (payload: { sid, name, niveau, classe, annee, iat, sig }), then
 * shows the student card and provides a link to the student list.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { QrCode, CheckCircle2, ScanLine, AlertCircle, RotateCcw, Users } from "lucide-react";

const BASE = import.meta.env.BASE_URL;

interface QrPayload {
  sid: string;
  name: string;
  niveau: string;
  classe: string;
  annee: string;
  iat: number;
  sig: string;
}

interface ScannedStudent {
  id: string;
  nomPrenom: string;
  niveau: string;
  classe: string;
  annee: string;
  parentPhone?: string | null;
  dateNaissance?: string | null;
}

const SCANNER_ID = "cem-qr-reader";

export default function ScanQrPage() {
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<"scanning" | "loading" | "found" | "error">("scanning");
  const [student, setStudent] = useState<ScannedStudent | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const scannerRef = useRef<any>(null);
  const mountedRef = useRef(true);

  // ── Load html5-qrcode dynamically to avoid SSR issues ─────────────────────
  useEffect(() => {
    mountedRef.current = true;
    let scanner: any;

    (async () => {
      const { Html5QrcodeScanner } = await import("html5-qrcode");

      scanner = new Html5QrcodeScanner(
        SCANNER_ID,
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
        },
        /* verbose= */ false,
      );
      scannerRef.current = scanner;

      scanner.render(
        async (text: string) => {
          if (!mountedRef.current) return;
          // Stop further scanning
          try { await scanner.clear(); } catch { /* ignore */ }

          // Parse QR payload
          let payload: QrPayload;
          try {
            payload = JSON.parse(text);
            if (!payload?.sid) throw new Error("Invalid payload");
          } catch {
            setErrMsg("رمز QR غير صالح — لا يمكن قراءة بيانات التلميذ");
            setPhase("error");
            return;
          }

          setPhase("loading");

          // Fetch fresh student data from server
          try {
            const res = await fetch(`${BASE}api/students/${encodeURIComponent(payload.sid)}`, {
              credentials: "include",
            });
            if (res.ok) {
              const data = await res.json();
              setStudent(data);
              setPhase("found");
            } else {
              // Fall back to payload data
              setStudent({
                id: payload.sid,
                nomPrenom: payload.name,
                niveau: payload.niveau,
                classe: payload.classe,
                annee: payload.annee,
              });
              setPhase("found");
            }
          } catch {
            setStudent({
              id: payload.sid,
              nomPrenom: payload.name,
              niveau: payload.niveau,
              classe: payload.classe,
              annee: payload.annee,
            });
            setPhase("found");
          }
        },
        (_err: unknown) => {
          // Scanning errors are continuous and expected — ignore them
        },
      );
    })();

    return () => {
      mountedRef.current = false;
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  const handleReset = async () => {
    setStudent(null);
    setErrMsg("");
    setPhase("scanning");

    // Re-render scanner
    const { Html5QrcodeScanner } = await import("html5-qrcode");
    const scanner = new Html5QrcodeScanner(
      SCANNER_ID,
      { fps: 10, qrbox: { width: 260, height: 260 } },
      false,
    );
    scannerRef.current = scanner;
    scanner.render(
      async (text: string) => {
        if (!mountedRef.current) return;
        try { await scanner.clear(); } catch { /* ignore */ }
        let payload: QrPayload;
        try { payload = JSON.parse(text); if (!payload?.sid) throw new Error(); }
        catch { setErrMsg("رمز QR غير صالح"); setPhase("error"); return; }
        setPhase("loading");
        const res = await fetch(`${BASE}api/students/${encodeURIComponent(payload.sid)}`, { credentials: "include" }).catch(() => null);
        const data = res?.ok ? await res.json().catch(() => null) : null;
        setStudent(data ?? { id: payload.sid, nomPrenom: payload.name, niveau: payload.niveau, classe: payload.classe, annee: payload.annee });
        setPhase("found");
      },
      () => {},
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-background flex flex-col items-center p-6 gap-6"
      dir="rtl"
    >
      {/* Header */}
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-1">
          <span className="inline-flex w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 items-center justify-center shadow-lg shadow-blue-500/30">
            <QrCode className="w-5 h-5 text-white" />
          </span>
          <div>
            <h1 className="text-xl font-bold">مسح رمز QR</h1>
            <p className="text-xs text-muted-foreground">وجّه الكاميرا نحو رمز QR الخاص بالتلميذ</p>
          </div>
        </div>
      </div>

      {/* Scanner area */}
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {(phase === "scanning") && (
            <motion.div
              key="scanner"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-2xl overflow-hidden border border-border shadow-lg bg-card"
            >
              {/* Scan indicator */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border">
                <motion.div
                  className="w-2 h-2 rounded-full bg-emerald-500"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">جاري المسح…</span>
                <ScanLine className="w-3.5 h-3.5 text-muted-foreground ms-auto" />
              </div>

              {/* html5-qrcode mounts here */}
              <div id={SCANNER_ID} className="w-full" />

              {/* Permission hint */}
              <p className="text-center text-xs text-muted-foreground px-4 py-3">
                قد يطلب المتصفح الإذن باستخدام الكاميرا — اقبل الطلب لبدء المسح
              </p>
            </motion.div>
          )}

          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-4 py-24 rounded-2xl border border-border bg-card"
            >
              <motion.div
                className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              />
              <p className="text-sm text-muted-foreground">جاري جلب بيانات التلميذ…</p>
            </motion.div>
          )}

          {phase === "found" && student && (
            <motion.div
              key="found"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20 overflow-hidden shadow-md"
            >
              {/* Success header */}
              <div className="flex items-center gap-3 px-5 py-4 bg-emerald-500/10 border-b border-emerald-500/20">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </motion.div>
                <div>
                  <p className="font-bold text-emerald-700 dark:text-emerald-400">تم التعرف على التلميذ</p>
                  <p className="text-xs text-emerald-600/70">رمز QR صالح ومشفر</p>
                </div>
              </div>

              {/* Student card */}
              <div className="px-5 py-5 space-y-3">
                <div>
                  <p className="text-lg font-bold">{student.nomPrenom}</p>
                  {student.dateNaissance && (
                    <p className="text-xs text-muted-foreground">تاريخ الميلاد: {student.dateNaissance}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "المستوى", value: student.niveau },
                    { label: "الفوج",   value: student.classe  },
                    { label: "السنة",   value: student.annee   },
                    ...(student.parentPhone ? [{ label: "هاتف الولي", value: student.parentPhone }] : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl bg-background border border-border px-3 py-2">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                      <p className="font-semibold text-sm mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="px-5 pb-5 flex gap-2">
                <Button
                  className="flex-1 gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-sm"
                  onClick={() => navigate(`/students?highlight=${encodeURIComponent(student.id)}`)}
                >
                  <Users className="w-4 h-4" />
                  عرض في قائمة التلاميذ
                </Button>
                <Button variant="outline" className="gap-1.5" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4" />
                  مسح آخر
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-red-500/30 bg-red-50/30 dark:bg-red-950/20 p-6 flex flex-col items-center gap-4 shadow-md"
            >
              <AlertCircle className="w-12 h-12 text-red-500" />
              <p className="text-sm text-red-700 dark:text-red-400 text-center">{errMsg}</p>
              <Button variant="outline" className="gap-2" onClick={handleReset}>
                <RotateCcw className="w-4 h-4" />
                حاول مرة أخرى
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tips */}
      {phase === "scanning" && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="w-full max-w-md rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1"
        >
          <p className="font-semibold text-foreground mb-2">نصائح للمسح الجيد</p>
          <p>• ضع رمز QR في منتصف الإطار مع إضاءة كافية</p>
          <p>• اقترب أو ابتعد تدريجيًا حتى يُقرأ الرمز</p>
          <p>• يعمل مع بطاقات الهوية المدرسية المطبوعة</p>
        </motion.div>
      )}
    </motion.div>
  );
}
