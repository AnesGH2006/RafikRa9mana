import { useState, useEffect, useCallback } from "react";
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
  Smartphone,
} from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

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

  // PWA install state
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Check if already running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setPwaInstalled(true);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setPwaInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handlePwaInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setPwaInstalled(true);
    setDeferredPrompt(null);
    setInstalling(false);
  };

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
    <motion.div variants={pageVariants} initial="initial" animate="animate"
      className="p-6 space-y-6 max-w-3xl mx-auto" dir="rtl">

      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">وكيل سطح المكتب</h1>
          <p className="text-sm text-muted-foreground">اربط حاسوب الإدارة بالمنصة مباشرةً</p>
        </div>
      </motion.div>

      {/* How it works */}
      <motion.div custom={0} variants={cardVariants} initial="initial" animate="animate">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              كيف يعمل الوكيل؟
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Steps */}
            <div className="space-y-3">
              {STEPS.map((step, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.07 }}
                  className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                  <div className={`w-8 h-8 rounded-lg ${step.color} flex items-center justify-center shrink-0 mt-0.5`}>
                    <step.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold text-muted-foreground">الخطوة {i + 1}</span>
                    </div>
                    <p className="text-sm font-semibold">{step.titleAr}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.descAr}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Features grid */}
            <div className="pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-3">ما يقدّمه الوكيل</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FEATURES.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <f.icon className={`w-3.5 h-3.5 shrink-0 ${f.color}`} />
                    <span>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* PWA Install card */}
      <motion.div custom={1} variants={cardVariants} initial="initial" animate="animate">
        <Card className="border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-transparent overflow-hidden">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              {/* Icon */}
              <motion.div
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30"
                animate={{ rotate: [0, -6, 6, 0] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 }}
              >
                <Smartphone className="w-8 h-8 text-white" />
              </motion.div>

              {/* Text */}
              <div className="flex-1 text-center sm:text-right space-y-1">
                <p className="text-base font-bold">ثبّت التطبيق على جهازك</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  أضف مدير المتوسطة إلى الشاشة الرئيسية للوصول الفوري — يعمل بدون متصفح وبدون إنترنت.
                </p>
                <div className="flex flex-wrap justify-center sm:justify-start gap-3 pt-1 text-[11px] text-muted-foreground">
                  {["يعمل بدون إنترنت", "أسرع وأخف", "مثل التطبيق الأصلي"].map((b, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      {b}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action */}
              <div className="shrink-0">
                {pwaInstalled ? (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-emerald-400">مثبَّت</span>
                  </div>
                ) : deferredPrompt ? (
                  <Button
                    onClick={handlePwaInstall}
                    disabled={installing}
                    className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 border-0 shadow-md shadow-blue-500/25 font-semibold"
                  >
                    {installing ? (
                      <motion.div
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    تثبيت الآن
                  </Button>
                ) : (
                  <div className="text-center space-y-1">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/60 border border-muted">
                      <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">مثبَّت مسبقاً</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60">أو افتح من المتصفح</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Token generation */}
      <motion.div custom={2} variants={cardVariants} initial="initial" animate="animate">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Key className="w-4 h-4 text-white" />
              </div>
              إنشاء رمز وكيل جديد
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              كل جهاز يحتاج رمزاً خاصاً. أعطِ الجهاز اسماً واضحاً (مثل: حاسوب مكتب المدير) ثم انسخ الرمز الناتج والصقه في الوكيل.
            </p>

            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="device-name" className="text-xs">اسم الجهاز</Label>
                <Input
                  id="device-name"
                  placeholder="مثال: حاسوب مكتب الإدارة"
                  value={deviceName}
                  onChange={e => setDeviceName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createToken()}
                  className="text-sm"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={createToken} disabled={creating || !deviceName.trim()} className="gap-2">
                  {creating
                    ? <motion.div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                        animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
                    : <Plus className="w-4 h-4" />}
                  إنشاء
                </Button>
              </div>
            </div>

            {/* Newly created token reveal */}
            <AnimatePresence>
              {newToken && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="p-4 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-emerald-400">تم إنشاء الرمز — انسخه الآن!</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    لن يُعرض هذا الرمز مرة أخرى. انسخه والصقه في شاشة تسجيل الدخول بالوكيل.
                  </p>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-700">
                    <code className="flex-1 text-xs font-mono text-emerald-300 break-all">{newToken}</code>
                    <CopyButton text={newToken} />
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setNewToken(null)}>
                    إغلاق
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {/* Existing tokens */}
      <motion.div custom={3} variants={cardVariants} initial="initial" animate="animate">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-600 flex items-center justify-center">
                  <Monitor className="w-4 h-4 text-white" />
                </div>
                الأجهزة المُصرَّح لها
              </div>
              <Badge variant="secondary" className="text-xs">{tokens.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTokens ? (
              <div className="flex justify-center py-8">
                <motion.div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full"
                  animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
              </div>
            ) : tokens.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Circle className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">لا توجد أجهزة مُفعَّلة بعد</p>
                <p className="text-xs text-muted-foreground">أنشئ رمزاً أعلاه للبدء</p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {tokens.map((token, i) => (
                    <motion.div key={token.id}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16, height: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors group">
                      <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                        <Monitor className="w-4 h-4 text-slate-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{token.deviceName}</p>
                        <p className="text-xs text-muted-foreground">
                          أُنشئ {fmtDate(token.createdAt)}
                          {token.lastSeenAt && (
                            <> · آخر اتصال {fmtDate(token.lastSeenAt)}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 hidden sm:flex">
                          نشط
                        </Badge>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                          onClick={() => revokeToken(token.id)}
                          disabled={revoking === token.id}
                          title="إلغاء الرمز">
                          {revoking === token.id
                            ? <motion.div className="w-3 h-3 border border-current border-t-transparent rounded-full"
                                animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity }} />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Architecture note */}
      <motion.div custom={4} variants={cardVariants} initial="initial" animate="animate">
        <Card className="border-muted/50">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground font-semibold mb-3">مخطط الاتصال</p>
            <div className="flex items-center justify-center gap-2 flex-wrap text-xs">
              {[
                { icon: Monitor, label: "الوكيل (Windows)", color: "bg-slate-700" },
                { arrow: "Websocket ←→" },
                { icon: Wifi,    label: "Socket.IO /agent-socket", color: "bg-indigo-600" },
                { arrow: "←→" },
                { icon: Bot,     label: "الخادم (Replit)", color: "bg-violet-600" },
              ].map((item, i) =>
                "arrow" in item ? (
                  <span key={i} className="text-muted-foreground font-mono text-[10px]">{item.arrow}</span>
                ) : (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/60">
                    <div className={`w-5 h-5 rounded ${item.color} flex items-center justify-center`}>
                      <item.icon className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-muted-foreground">{item.label}</span>
                  </div>
                )
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/70 text-center mt-3 leading-relaxed">
              الوكيل يُصادق بـ Bearer Token · يرسل ping كل 30 ثانية · يعيد الاتصال تلقائياً عند الانقطاع
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
