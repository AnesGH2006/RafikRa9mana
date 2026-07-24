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
import { Bot, X, Download, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

const DISMISS_KEY = "agent_prompt_dismissed_until";
const DISMISS_DAYS = 7;

interface AgentToken {
  id: string;
  lastSeenAt?: string;
}

function isRecentlySeen(lastSeenAt?: string): boolean {
  if (!lastSeenAt) return false;
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  return diff < 5 * 60 * 1000; // 5 minutes
}

export function AgentInstallPrompt() {
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    // Respect dismiss cooldown
    const until = localStorage.getItem(DISMISS_KEY);
    if (until && Date.now() < Number(until)) {
      setChecked(true);
      return;
    }

    // Check agent token / connection status
    const check = async () => {
      try {
        const res = await fetch("/api/agent/tokens", { credentials: "include" });
        if (!res.ok) return;
        const tokens: AgentToken[] = await res.json();

        // If any token has been seen recently → agent is connected; hide prompt
        const anyConnected = tokens.some(t => isRecentlySeen(t.lastSeenAt));
        if (anyConnected) return;

        // If no tokens at all → definitely not set up
        // If tokens exist but stale → might be disconnected; still nudge
        setShow(true);
      } catch {
        // Network error or unauthenticated — skip silently
      } finally {
        setChecked(true);
      }
    };

    // Delay slightly so the main UI can paint first
    const id = setTimeout(check, 3500);
    return () => clearTimeout(id);
  }, []);

  const dismiss = () => {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setShow(false);
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
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          exit={{ opacity: 0, y: 16, scale: 0.94 }}
          transition={{ type: "spring", stiffness: 340, damping: 28 }}
          className="fixed bottom-6 left-6 z-50 w-80 rounded-2xl shadow-2xl shadow-black/20 border border-white/10 overflow-hidden"
          dir="rtl"
        >
          {/* Glass background */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-indigo-950/95 to-violet-950/95 backdrop-blur-xl" />

          {/* Subtle glow */}
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-violet-500/20 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-blue-500/15 blur-2xl pointer-events-none" />

          <div className="relative p-4">
            {/* Dismiss */}
            <button
              onClick={dismiss}
              className="absolute top-3 left-3 text-white/40 hover:text-white/80 transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">وكيل سطح المكتب</p>
                <p className="text-violet-300/80 text-xs">غير متصل بعد</p>
              </div>
            </div>

            {/* Body */}
            <p className="text-white/70 text-xs leading-relaxed mb-4">
              قم بتثبيت الوكيل للتحكم الكامل في جهازك المحلي: استخراج بيانات الرقمنة، إرسال SMS، مزامنة الملفات، وأتمتة المهام الإدارية — كل ذلك بأمر واحد.
            </p>

            {/* Features */}
            <ul className="space-y-1.5 mb-4">
              {[
                "استخراج أرقام أولياء الأمور تلقائياً",
                "إرسال SMS عبر مودم محلي",
                "مزامنة ملفات Excel فور اكتشافها",
              ].map(f => (
                <li key={f} className="flex items-center gap-2 text-xs text-white/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={goSetup}
                className="flex-1 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white border-0 text-xs h-8 font-semibold"
              >
                <Download className="w-3.5 h-3.5 ml-1.5" />
                إعداد الوكيل
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={dismiss}
                className="text-white/50 hover:text-white/80 hover:bg-white/5 text-xs h-8 px-2"
              >
                لاحقاً
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
