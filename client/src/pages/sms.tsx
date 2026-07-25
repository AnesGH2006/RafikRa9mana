import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Search, Phone, User, ChevronDown,
  Send, Copy, CheckCheck, Edit3, RefreshCw, AlertCircle,
} from "lucide-react";

// ─── Message templates ────────────────────────────────────────────────────────
const TEMPLATES: { id: string; labelAr: string; icon: string; build: (name: string, extra?: string) => string }[] = [
  {
    id: "absence",
    labelAr: "إشعار غياب",
    icon: "🔔",
    build: (name) =>
      `السيد / السيدة ولي أمر التلميذ(ة): ${name}\nنُعلمكم بأن ابنكم/ابنتكم تغيّب(ت) اليوم عن الدراسة دون إذن مسبق. نرجو التواصل مع إدارة المتوسطة في أقرب وقت.\nمع التقدير.`,
  },
  {
    id: "weak_results",
    labelAr: "نتائج دراسية ضعيفة",
    icon: "📉",
    build: (name) =>
      `السيد / السيدة ولي أمر التلميذ(ة): ${name}\nنُحيطكم علمًا بأن نتائج ابنكم/ابنتكم الدراسية دون المستوى المطلوب. نأمل منكم متابعته/متابعتها عن كثب والتواصل معنا.\nمع التقدير.`,
  },
  {
    id: "meeting",
    labelAr: "استدعاء لاجتماع",
    icon: "📅",
    build: (name) =>
      `السيد / السيدة ولي أمر التلميذ(ة): ${name}\nتُدعى حضراتكم لحضور اجتماع أولياء الأمور المقرر في المتوسطة. للمزيد من التفاصيل يُرجى التواصل مع الإدارة.\nمع التقدير.`,
  },
  {
    id: "behavior",
    labelAr: "سلوك غير لائق",
    icon: "⚠️",
    build: (name) =>
      `السيد / السيدة ولي أمر التلميذ(ة): ${name}\nنُبلّغكم بأن ابنكم/ابنتكم صدر منه/منها سلوك غير لائق داخل المؤسسة. نرجو التنسيق معنا لمعالجة هذا الأمر في أقرب وقت.\nمع التقدير.`,
  },
  {
    id: "congratulations",
    labelAr: "تهنئة بنتائج ممتازة",
    icon: "🏆",
    build: (name) =>
      `السيد / السيدة ولي أمر التلميذ(ة): ${name}\nيسعدنا إبلاغكم بأن ابنكم/ابنتكم حقق/ت نتائج ممتازة خلال هذا الفصل الدراسي. نهنئكم وندعو إلى مواصلة هذا المستوى.\nمع التقدير.`,
  },
  {
    id: "mustarrak",
    labelAr: "استدراك — إشعار اختبار",
    icon: "📝",
    build: (name) =>
      `السيد / السيدة ولي أمر التلميذ(ة): ${name}\nنُعلمكم بأن ابنكم/ابنتكم مُعنيّ(ة) باجتياز اختبار الاستدراك. يُرجى الاستعداد الجيد والتواصل مع الإدارة لمعرفة جدول الاختبارات.\nمع التقدير.`,
  },
  {
    id: "recovery_result",
    labelAr: "نتيجة الاستدراك",
    icon: "📋",
    build: (name, extra) =>
      `السيد / السيدة ولي أمر التلميذ(ة): ${name}\nنُبلغكم بأن نتيجة ابنكم/ابنتكم في اختبار الاستدراك: ${extra ?? "—"}. للاستفسار، تواصلوا مع إدارة المتوسطة.\nمع التقدير.`,
  },
  {
    id: "supplies",
    labelAr: "تذكير بالمستلزمات",
    icon: "🎒",
    build: (name) =>
      `السيد / السيدة ولي أمر التلميذ(ة): ${name}\nنُذكّركم بضرورة تزويد ابنكم/ابنتكم بكامل المستلزمات المدرسية المطلوبة. شكرًا على تعاونكم.\nمع التقدير.`,
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface Student {
  id: number;
  nomPrenom: string;
  niveau: string;
  classe: string;
  parentPhone: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SmsPage() {
  // Student search
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Template
  const [templateId, setTemplateId] = useState<string>("");
  const [extra, setExtra] = useState(""); // optional extra field (e.g. result value)

  // Message
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  // Search students as user types
  useEffect(() => {
    if (query.trim().length < 2) { setStudents([]); setShowDropdown(false); return; }
    const t = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const res = await fetch(`/api/students?search=${encodeURIComponent(query)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setStudents(data);
          setShowDropdown(true);
        }
      } catch {}
      setLoadingSearch(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Rebuild message when template or student changes
  useEffect(() => {
    if (!selected || !templateId) { setMessage(""); return; }
    const tmpl = TEMPLATES.find(t => t.id === templateId);
    if (tmpl) setMessage(tmpl.build(selected.nomPrenom, extra || undefined));
  }, [selected, templateId, extra]);

  const handleSelectStudent = (s: Student) => {
    setSelected(s);
    setQuery(s.nomPrenom);
    setShowDropdown(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const smsHref = selected?.parentPhone
    ? `sms:${selected.parentPhone}${/iPhone|iPad|iPod/.test(navigator.userAgent) ? "&" : "?"}body=${encodeURIComponent(message)}`
    : "#";

  const canSend = !!selected && !!templateId && !!message.trim();
  const hasPhone = !!selected?.parentPhone;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center gap-4"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-lg">
          <MessageSquare className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-l from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            إرسال رسالة SMS
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            اختر التلميذ، الموضوع، راجع النص، ثم أرسل مباشرة من هاتفك
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {/* ── Left panel: student + template ── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="space-y-5"
        >
          {/* Student search */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <User className="h-4 w-4" /> البحث عن التلميذ
            </h2>
            <div className="relative">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={e => { setQuery(e.target.value); setSelected(null); }}
                  placeholder="اكتب اسم التلميذ..."
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
                {loadingSearch && (
                  <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              <AnimatePresence>
                {showDropdown && students.length > 0 && (
                  <motion.ul
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-card shadow-xl overflow-hidden"
                  >
                    {students.map(s => (
                      <li key={s.id}>
                        <button
                          onClick={() => handleSelectStudent(s)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                        >
                          <span className="font-medium">{s.nomPrenom}</span>
                          <span className="mr-auto text-xs text-muted-foreground">{s.niveau} · {s.classe}</span>
                          {s.parentPhone
                            ? <Phone className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                            : <Phone className="h-3.5 w-3.5 text-destructive/50 flex-shrink-0" />}
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

            {/* Selected student card */}
            <AnimatePresence>
              {selected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{selected.nomPrenom}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selected.niveau} · الفوج {selected.classe}
                      </p>
                    </div>
                    <div className="text-left">
                      {hasPhone ? (
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <Phone className="h-4 w-4" />
                          <span className="text-xs font-mono">{selected.parentPhone}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-destructive">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-xs">لا يوجد رقم</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Template picker */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <ChevronDown className="h-4 w-4" /> موضوع الرسالة
            </h2>
            <div className="grid grid-cols-1 gap-2">
              {TEMPLATES.map(tmpl => (
                <button
                  key={tmpl.id}
                  onClick={() => setTemplateId(tmpl.id)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm text-right transition-all ${
                    templateId === tmpl.id
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-sm shadow-emerald-500/20"
                      : "border-border hover:border-emerald-500/40 hover:bg-accent"
                  }`}
                >
                  <span className="text-base">{tmpl.icon}</span>
                  <span>{tmpl.labelAr}</span>
                  {templateId === tmpl.id && (
                    <CheckCheck className="mr-auto h-4 w-4 text-emerald-400" />
                  )}
                </button>
              ))}
            </div>

            {/* Extra field for recovery_result */}
            <AnimatePresence>
              {templateId === "recovery_result" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3"
                >
                  <input
                    type="text"
                    value={extra}
                    onChange={e => setExtra(e.target.value)}
                    placeholder="أدخل النتيجة (مثال: ناجح / راسب / 12.5)"
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Right panel: message preview + actions ── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-5"
        >
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm h-full flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Edit3 className="h-4 w-4" /> نص الرسالة
              </h2>
              {message && (
                <span className="text-xs text-muted-foreground">
                  {message.length} حرف
                </span>
              )}
            </div>

            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={
                !selected
                  ? "ابحث عن تلميذ أولاً..."
                  : !templateId
                  ? "اختر موضوع الرسالة..."
                  : ""
              }
              rows={10}
              className="flex-1 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-40"
              disabled={!selected || !templateId}
            />

            {/* Warning: no phone */}
            <AnimatePresence>
              {selected && !hasPhone && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300"
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>هذا التلميذ ليس لديه رقم هاتف ولي الأمر مسجّل في النظام. يمكنك نسخ النص وإرساله يدويًا.</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleCopy}
                disabled={!canSend}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-accent px-4 py-2.5 text-sm font-medium transition-all hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {copied ? (
                  <><CheckCheck className="h-4 w-4 text-emerald-400" /> تم النسخ</>
                ) : (
                  <><Copy className="h-4 w-4" /> نسخ النص</>
                )}
              </button>

              <a
                href={canSend && hasPhone ? smsHref : undefined}
                onClick={e => { if (!canSend || !hasPhone) e.preventDefault(); }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  canSend && hasPhone
                    ? "bg-gradient-to-l from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/30 hover:opacity-90"
                    : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                }`}
              >
                <Send className="h-4 w-4" />
                فتح تطبيق الرسائل
              </a>
            </div>

            {/* How it works */}
            <div className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground/70">كيف يعمل؟</p>
              <p>① ابحث عن التلميذ وتأكد من وجود رقم ولي الأمر.</p>
              <p>② اختر موضوع الرسالة من القائمة — سيتم توليد النص تلقائيًا.</p>
              <p>③ عدّل النص إن أردت، ثم اضغط <strong>"فتح تطبيق الرسائل"</strong> ليفتح هاتفك مباشرة بالرقم والنص جاهزَين.</p>
              <p>④ إذا لم يكن لديك هاتف قريب، انسخ النص وأرسله من أي وسيلة أخرى.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
