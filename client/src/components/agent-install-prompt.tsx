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
import { Download } from "lucide-react";
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
  return diff < 5 * 60 * 1000;
}

export function AgentInstallPrompt() {
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const until = localStorage.getItem(DISMISS_KEY);
    if (until && Date.now() < Number(until)) {
      setChecked(true);
      return;
    }

    const id = setTimeout(() => {
      setShow(true);
      setChecked(true);
    }, 2000);

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
        <motion.button
          key="agent-install-prompt"
          type="button"
          onClick={goSetup}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-full bg-white px-5 py-3 text-[15px] font-semibold text-slate-800 shadow-[0_8px_25px_rgba(0,0,0,0.18)] ring-1 ring-slate-200 hover:shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition-all"
          aria-label="Download desktop agent for Windows"
        >
          <span>Download for Windows</span>
          <Download className="h-4 w-4" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
