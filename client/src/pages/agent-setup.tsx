import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/language-provider";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Bot, Download, Key, Trash2, Copy, Check, Monitor, Wifi,
  FolderSync, Shield, RefreshCw, Plus, CheckCircle2, Circle,
  Terminal, ExternalLink, AlertTriangle,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL;

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const cardVariants = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
};

interface AgentToken {
  id: string;
  deviceName: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt?: string;
}

const STEPS = [
  {
    icon: Download,
    color: "bg-blue-500",
    titleAr: "حمّل وثبّت الوكيل",
    descAr: "قم بتنزيل مثبّت School Manager Agent لنظام Windows وشغّله على الحاسوب المكتبي الخاص بالإدارة.",
  },
  {
    icon: Terminal,
    color: "bg-violet-500",
    titleAr: "اضبط عنوان الخادم",
    descAr: 'افتح الوكيل ← الإعدادات، وأدخل عنوان هذه المنصة (URL) ليتمكن الوكيل من الاتصال بها.',
  },
  {
    icon: Key,
    color: "bg-emerald-500",
    titleAr: "أنشئ رمز وكيل",
    descAr: "في القسم أدناه، أنشئ رمزاً خاصاً بالجهاز ثم انسخه.",
  },
  {
    icon: Wifi,
    color: "bg-amber-500",
    titleAr: "الصق الرمز في الوكيل",
    descAr: "في شاشة تسجيل الدخول بالوكيل، الصق الرمز وانقر «اتصال» — سيتصل الوكيل فوراً.",
  },
  {
    icon: FolderSync,
    color: "bg-cyan-500",
    titleAr: "حدّد المجلدات المسموح بها",
    descAr: "في تبويب «الصلاحيات» داخل الوكيل، أضف المجلدات التي يُسمح له بالوصول إليها.",
  },
];

const FEATURES = [
  { icon: FolderSync, color: "text-cyan-400",   label: "مزامنة ملفات Excel تلقائياً عند اكتشافها" },
  { icon: Shield,     color: "text-emerald-400", label: "وصول مقيّد بمجلدات محددة فقط" },
  { icon: Wifi,       color: "text-blue-400",    label: "اتصال دائم عبر WebSocket مع إعادة اتصال تلقائية" },
  { icon: Monitor,    color: "text-violet-400",  label: "يعمل في الخلفية من علبة النظام (System Tray)" },
  { icon: Shield,     color: "text-amber-400",   label: "الرمز مشفّر بـ Electron safeStorage" },
  { icon: RefreshCw,  color: "text-fuchsia-400", label: "تشغيل تلقائي عند بدء تشغيل Windows" },
];

function AgentDownloadBlock({ base }: { base: string }) {
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  // Check installer availability once on mount
  useEffect(() => {
    fetch(`${base}api/agent/download`, { method: "HEAD", credentials: "include" })
      .then(r => setAvailable(r.ok))
      .catch(() => setAvailable(false));
  }, [base]);

  const handleDownload = async () => {
    setChecking(true);
    try {
      const res = await fetch(`${base}api/agent/download`, { credentials: "include" });
      if (res.ok) {
        // Trigger real file download
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = "SchoolManagerAgent-Setup.exe";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "المثبّت غير متوفر",
          description: data?.message || "لم يتم بناء المثبّت بعد. يجب بناؤه من جهاز Windows.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "خطأ في الاتصال", description: "تعذّر الوصول إلى الخادم.", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  const isReady = available === true;

  return (
    <div className={`rounded-xl border p-5 text-center space-y-3 ${
      isReady
        ? "border-blue-500/30 bg-blue-500/5"
        : "border-amber-500/30 bg-amber-500/5"
    }`}>
      {isReady ? (
        <>
          <p className="text-sm font-bold">المثبّت جاهز للتنزيل</p>
          <p className="text-xs text-muted-foreground">
            ملف تثبيت Windows جاهز — لا يحتاج Node.js أو أي أدوات مطوّر.
          </p>
          <button
            onClick={handleDownload}
            disabled={checking}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-60 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-600/30"
          >
            <Download className="w-4 h-4" />
            {checking ? "جارٍ التنزيل…" : "تنزيل الوكيل (Windows 64-bit)"}
          </button>
          <p className="text-[11px] text-muted-foreground">Electron · نظام 64-بت · حجم الملف ≈ 80 MB</p>
        </>
      ) : (
        <div className="space-y-4">
          {/* Icon + heading */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Monitor className="w-6 h-6 text-amber-400" />
            </div>
            <p className="text-sm font-bold">برنامج الوكيل المكتبي</p>
            <p className="text-xs text-muted-foreground text-center leading-relaxed max-w-xs">
              يُتيح مزامنة ملفات Excel من حاسوب الإدارة تلقائياً دون رفع يدوي.
            </p>
          </div>

          {/* Coming soon pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-semibold mx-auto">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            قريباً — سيتوفر التنزيل المباشر
          </div>

          {/* What the user should do */}
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 text-right space-y-2">
            <p className="text-xs font-semibold text-slate-300">في الوقت الحالي:</p>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5 shrink-0">①</span>
                أنشئ رمز وكيل من القسم أدناه.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5 shrink-0">②</span>
                تواصل مع مشرف النظام للحصول على البرنامج وتثبيته.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-0.5 shrink-0">③</span>
                أدخل الرمز وعنوان الخادم عند تشغيل البرنامج لأول مرة.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button size="sm" variant="ghost" onClick={copy} className="h-7 px-2 gap-1 text-xs shrink-0">
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {copied ? "تم" : "نسخ"}
    </Button>
  );
}

export default function AgentSetupPage() {
  const { toast } = useToast();
  const [tokens, setTokens] = useState<AgentToken[]>([]);
  const [deviceName, setDeviceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [loadingTokens, setLoadingTokens] = useState(true);

  const serverUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://your-school.replit.app";

  const fetchTokens = useCallback(async () => {
    setLoadingTokens(true);
    try {
      const res = await fetch(`${BASE}api/agent/tokens`, { credentials: "include" });
      if (res.ok) setTokens(await res.json());
    } finally {
      setLoadingTokens(false);
    }
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  const createToken = async () => {
    const name = deviceName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch(`${BASE}api/agent/token`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceName: name }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setNewToken(data.token);
      setDeviceName("");
      fetchTokens();
      toast({ title: "تم إنشاء الرمز بنجاح", description: "انسخه الآن — لن يُعرض مرة أخرى." });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const revokeToken = async (id: string) => {
    setRevoking(id);
    try {
      const res = await fetch(`${BASE}api/agent/tokens/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      setTokens(t => t.filter(x => x.id !== id));
      toast({ title: "تم إلغاء الرمز" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setRevoking(null);
    }
  };

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString("ar-DZ"); }
    catch { return iso; }
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className="min-h-screen bg-[#020b18] text-slate-100"
      dir="rtl"
    >
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(96,165,250,0.12) 1px, transparent 0)",
        backgroundSize: "22px 22px",
      }} />

      <div className="relative mx-auto flex min-h-screen max-w-[1200px] items-center justify-center px-4 py-8">
        <div className="w-full max-w-[820px] rounded-[26px] border border-slate-700/70 bg-[#061a2e]/90 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-700/60 bg-[#0a1d2f] px-3 py-2">
            <div className="flex items-center gap-2 text-slate-300">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-700 text-[10px]">◌</div>
              <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-700 text-[10px]">◍</div>
              <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-700 text-[10px]">◐</div>
            </div>
            <div className="flex flex-1 items-center justify-center">
              <div className="flex min-w-[260px] max-w-[500px] items-center gap-2 rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-200">
                <span className="text-blue-300">🔒</span>
                <span className="truncate">{serverUrl}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNewToken(null)}
              className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] text-slate-300 ring-1 ring-slate-700"
            >
              إغلاق
            </button>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-cyan-500/20 bg-[#0d2238] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/20">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-300">وكيل سطح المكتب</div>
                    <div className="text-2xl font-bold text-white">Windows</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={createToken}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 hover:bg-cyan-400"
                >
                  <Download className="h-4 w-4" />
                  تثبيت الآن
                </button>
              </div>

              <div className="rounded-xl border border-amber-400/30 bg-[#111f31] p-5 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/15">
                  <Monitor className="h-8 w-8" />
                </div>
                <div className="text-2xl font-bold text-white">برنامج الوكيل</div>
                <div className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-300">
                  يُنقّل المهام الروتينية من جهازك إلى المنصة، ويُبقي الملفات والبيانات في Sync مستمر وآمن.
                </div>
                <button
                  type="button"
                  onClick={goSetup}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-amber-400 px-6 py-2.5 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/20 hover:bg-amber-300"
                >
                  <ArrowLeft className="h-4 w-4" />
                  تثبيت الوكيل
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-sky-500/20 bg-[#0b2036] p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold text-cyan-300">عنوان الخادم</div>
                <div className="text-[11px] text-slate-400">نسخ</div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0a1b2d] px-2 py-2">
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

            <div className="rounded-xl border border-slate-700/50 bg-[#0b1d2f] p-4">
              <div className="mb-3 text-right text-[12px] font-semibold text-white">خطوات التثبيت</div>
              <div className="space-y-2">
                {[
                  "انقر على زر التثبيت وأكمل تثبيت التطبيق على جهاز Windows.",
                  "افتح الوكيل من علبة النظام، ثم الصق عنوان الخادم من أعلى الصفحة.",
                  "أنشئ رمزًا جديدًا من القسم التالي، والصق الرمز داخل الوكيل عند الطلب."
                ].map((item, index) => (
                  <div key={item} className="flex items-start gap-2 rounded-lg border border-slate-700/60 bg-[#0c2238] px-3 py-2 text-sm text-slate-200">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-[10px] font-bold text-cyan-300">
                      {index + 1}
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-700/50 bg-[#0b1d2f] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-right text-[12px] font-semibold text-white">إنشاء رمز جديد</div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <Key className="h-4 w-4" />
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  id="device-name"
                  placeholder="اسم الجهاز"
                  value={deviceName}
                  onChange={e => setDeviceName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createToken()}
                  className="h-11 border-slate-700 bg-[#0a1b2d] text-right text-sm text-white placeholder:text-slate-500"
                />
                <Button onClick={createToken} disabled={creating || !deviceName.trim()} className="h-11 gap-2 rounded-lg bg-blue-500 px-4 text-sm hover:bg-blue-400">
                  {creating ? "..." : "إنشاء"}
                </Button>
              </div>

              <AnimatePresence>
                {newToken && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3"
                  >
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      تم إنشاء الرمز
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#101f31] p-2">
                      <code className="flex-1 break-all text-right text-xs text-emerald-300">{newToken}</code>
                      <CopyButton text={newToken} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="rounded-xl border border-slate-700/50 bg-[#0b1d2f] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-right text-[12px] font-semibold text-white">الأجهزة المفعلة</div>
                <Badge variant="secondary" className="text-xs">{tokens.length}</Badge>
              </div>

              {loadingTokens ? (
                <div className="flex justify-center py-6">
                  <motion.div className="h-6 w-6 rounded-full border-2 border-cyan-400 border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
                </div>
              ) : tokens.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">لا توجد أجهزة مفعلة بعد.</div>
              ) : (
                <div className="space-y-2">
                  {tokens.map((token) => (
                    <div key={token.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-[#0d2134] px-3 py-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700">
                          <Monitor className="h-4 w-4 text-slate-300" />
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-white">{token.deviceName}</div>
                          <div className="text-[11px] text-slate-400">{fmtDate(token.createdAt)}</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                        onClick={() => revokeToken(token.id)}
                        disabled={revoking === token.id}
                      >
                        {revoking === token.id ? "..." : "إلغاء"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
