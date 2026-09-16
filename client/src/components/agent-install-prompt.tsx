/**
 * AgentInstallPrompt
 * ──────────────────
 * Floating bottom-left card that appears when the user is authenticated but
 * has no Desktop Agent token / no recent connection. Dismissible via
 * localStorage (won't re-appear for 7 days after dismiss).
 *
 * Mirrors the same lazy-mount pattern as PwaInstallPrompt.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Copy, Check, Zap, Shield, Wifi, FolderSync, Monitor, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

const DISMISS_KEY = "agent_prompt_dismissed_until";
const DISMISS_DAYS = 7;

export function AgentInstallPrompt() {
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, navigate] = useLocation();

  const serverUrl = typeof window !== "undefined" ? window.location.origin : "https://your-school.replit.app";

  useEffect(() => {
    const until = localStorage.getItem(DISMISS_KEY);
    if (until && Date.now() < Number(until)) {
      setChecked(true);
      return;
    }

    const id = setTimeout(() => {
      setShow(true);
      setChecked(true);
    }, 1500);

    return () => clearTimeout(id);
  }, []);

  const dismiss = () => {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setShow(false);
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(serverUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore copy failures
    }
  };

  const goSetup = () => {
    dismiss();
    navigate("/agent");
  };

  if (!checked) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="agent-install-prompt"
          initial={{ opacity: 0, x: 20, y: 12 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 20, y: 8 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="fixed right-6 top-1/2 z-50 w-[440px] -translate-y-1/2 rounded-2xl border border-cyan-500/30 bg-[#061827]/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-sm"
          dir="rtl"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-200/90 hover:bg-white/10"
            >
              إغلاق
            </button>
            <span className="rounded-full bg-cyan-500/15 px-2 py-1 text-[10px] font-semibold text-cyan-300">
              تثبيت الوكيل
            </span>
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-slate-900/30 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                  <Monitor className="h-5 w-5" />
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-300">برنامج الوكيل</p>
                  <p className="text-xl font-bold text-white">Windows</p>
                </div>
              </div>
              <button
                type="button"
                onClick={goSetup}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/90 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
              >
                <Download className="h-4 w-4" />
                تنزيل
              </button>
            </div>

            <div className="rounded-xl border border-amber-400/30 bg-[#0d1728] p-4 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-500/10 text-amber-200">
                <Monitor className="h-7 w-7" />
              </div>
              <p className="text-lg font-bold text-white">برنامج الوكيل</p>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                يُثبت على جهازك المحلي، ويُراقب Excel، يفتح النوافذ، ويُرسل البيانات بأمان إلى المنصة.
              </p>

              <button
                type="button"
                onClick={goSetup}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/20 hover:bg-amber-300"
              >
                <ArrowLeft className="h-4 w-4" />
                تثبيت الوكيل
              </button>
            </div>

            <div className="mt-4 space-y-2 text-sm text-slate-200">
              {[ 
                "يتكامل مع Excel وملفات الإدارة تلقائياً",
                "يعمل في الخلفية مع اتصال مستقر وآمن",
                "يُحافظ على صلاحيات محددة فقط للمجلدات المسموح بها"
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-right text-slate-200/90">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/15 text-[10px] text-cyan-300">
                    ✓
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-cyan-500/25 bg-slate-900/40 p-3">
              <div className="mb-2 text-right text-[11px] font-semibold text-slate-200">عنوان الخادم</div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0b1d2d] px-2 py-2">
                <button
                  type="button"
                  onClick={copyUrl}
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-700/80 text-slate-100 hover:bg-slate-600"
                  aria-label="Copy server URL"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                </button>
                <span className="flex-1 overflow-hidden text-ellipsis text-right text-sm text-slate-100">{serverUrl}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
