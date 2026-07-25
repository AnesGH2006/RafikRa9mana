import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Phone, AlertCircle, TrendingDown,
  Clock, CheckCheck, Copy, Send, Save, RefreshCw,
  Filter, ChevronLeft, X, Edit3, Search,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type AlertReason = "avg_below_10" | "high_absence" | "mustarrak";

interface AlertStudent {
  id: string;
  nomPrenom: string;
  niveau: string;
  classe: string;
  annee: string;
  parentPhone: string | null;
  annualAvg: number | null;
  unjustifiedHours: number;
  justifiedHours: number;
  reasons: AlertReason[];
}

// ─── Templates ────────────────────────────────────────────────────────────────
function buildMessage(reason: AlertReason, student: AlertStudent): string {
  const name = student.nomPrenom;
  if (reason === "avg_below_10") {
    const avg = student.annualAvg !== null ? student.annualAvg.toFixed(2) : "—";
    return `السيد / السيدة ولي أمر التلميذ(ة): ${name}\nنُحيطكم علمًا بأن معدّل ابنكم/ابنتكم الدراسي السنوي بلغ ${avg}/20، وهو دون عتبة النجاح المطلوبة (10/20). نرجو منكم متابعته/متابعتها عن كثب ومراجعة دروسه/دروسها يومياً، والتواصل معنا لأي استفسار.\nمع فائق التقدير — إدارة المتوسطة`;
  }
  if (reason === "mustarrak") {
    const avg = student.annualAvg !== null ? student.annualAvg.toFixed(2) : "—";
    return `السيد / السيدة ولي أمر التلميذ(ة): ${name}\nمعدّل ابنكم/ابنتكم الدراسي السنوي هو ${avg}/20. يُعنى باجتياز اختبار الاستدراك للحصول على فرصة النجاح. نأمل حضوره/حضورها في الموعد المحدد.\nمع فائق التقدير — إدارة المتوسطة`;
  }
  if (reason === "high_absence") {
    const hrs = student.unjustifiedHours;
    return `السيد / السيدة ولي أمر التلميذ(ة): ${name}\nنُبلّغكم بأن عدد ساعات الغياب غير المبرر لابنكم/ابنتكم بلغ ${hrs} ساعة، مما قد يؤثر سلباً على نتائجه/نتائجها الدراسية. يُرجى التواصل مع الإدارة في أقرب وقت لتسوية الوضعية.\nمع فائق التقدير — إدارة المتوسطة`;
  }
  return "";
}

// ─── Reason badge ─────────────────────────────────────────────────────────────
const REASON_META: Record<AlertReason, { label: string; icon: React.ReactNode; color: string }> = {
  avg_below_10: {
    label: "معدّل ضعيف",
    icon: <TrendingDown className="h-3 w-3" />,
    color: "bg-red-500/15 text-red-400 border-red-500/30",
  },
  mustarrak: {
    label: "مستدرك",
    icon: <AlertCircle className="h-3 w-3" />,
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  high_absence: {
    label: "غياب مفرط",
    icon: <Clock className="h-3 w-3" />,
    color: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  },
};

function ReasonBadge({ reason }: { reason: AlertReason }) {
  const m = REASON_META[reason];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${m.color}`}>
      {m.icon} {m.label}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
type FilterType = "all" | AlertReason;

export default function SmsPage() {
  const [annee, setAnnee] = useState("2025-2026");
  const [students, setStudents] = useState<AlertStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  // Selected student + compose panel
  const [selected, setSelected] = useState<AlertStudent | null>(null);
  const [activeReason, setActiveReason] = useState<AlertReason | null>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  // Phone editing
  const [phoneEdit, setPhoneEdit] = useState<Record<string, string>>({});
  const [phoneSaving, setPhoneSaving] = useState<Record<string, boolean>>({});
  const [phoneSaved, setPhoneSaved] = useState<Record<string, boolean>>({});

  // ── Fetch alerts ────────────────────────────────────────────────────────────
  const fetchAlerts = async () => {
    setLoading(true);
    setSelected(null);
    try {
      const res = await fetch(`/api/sms/alerts?annee=${encodeURIComponent(annee)}`);
      if (res.ok) {
        const data: AlertStudent[] = await res.json();
        setStudents(data);
        // Pre-fill phone edit fields for students without phones
        const edits: Record<string, string> = {};
        data.forEach(s => { if (!s.parentPhone) edits[s.id] = ""; });
        setPhoneEdit(prev => ({ ...edits, ...prev }));
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchAlerts(); }, [annee]);

  // ── When student or reason selected, rebuild message ────────────────────────
  useEffect(() => {
    if (!selected || !activeReason) { setMessage(""); return; }
    setMessage(buildMessage(activeReason, selected));
  }, [selected, activeReason]);

  const handleSelect = (s: AlertStudent) => {
    setSelected(s);
    // Auto-pick highest-priority reason
    const priority: AlertReason[] = ["avg_below_10", "mustarrak", "high_absence"];
    const first = priority.find(r => s.reasons.includes(r)) ?? s.reasons[0] ?? null;
    setActiveReason(first);
    setCopied(false);
  };

  // ── Save phone ──────────────────────────────────────────────────────────────
  const savePhone = async (studentId: string) => {
    const phone = (phoneEdit[studentId] ?? "").trim();
    if (!phone) return;
    setPhoneSaving(p => ({ ...p, [studentId]: true }));
    try {
      const res = await fetch(`/api/students/${studentId}/phone`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (res.ok) {
        setPhoneSaved(p => ({ ...p, [studentId]: true }));
        // Update local state
        setStudents(prev => prev.map(s =>
          s.id === studentId ? { ...s, parentPhone: phone } : s
        ));
        if (selected?.id === studentId) setSelected(s => s ? { ...s, parentPhone: phone } : s);
        setTimeout(() => setPhoneSaved(p => ({ ...p, [studentId]: false })), 2000);
      }
    } catch {}
    setPhoneSaving(p => ({ ...p, [studentId]: false }));
  };

  // ── Copy / SMS link ─────────────────────────────────────────────────────────
  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const effectivePhone = selected
    ? (selected.parentPhone || (phoneEdit[selected.id] ?? "").trim() || null)
    : null;

  const smsHref = effectivePhone
    ? `sms:${effectivePhone}${/iPhone|iPad/.test(navigator.userAgent) ? "&" : "?"}body=${encodeURIComponent(message)}`
    : "#";

  // ── Filtering ───────────────────────────────────────────────────────────────
  const filtered = students.filter(s => {
    if (filter !== "all" && !s.reasons.includes(filter as AlertReason)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!s.nomPrenom.toLowerCase().includes(q) && !s.classe.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts: Record<FilterType, number> = {
    all: students.length,
    avg_below_10: students.filter(s => s.reasons.includes("avg_below_10")).length,
    mustarrak: students.filter(s => s.reasons.includes("mustarrak")).length,
    high_absence: students.filter(s => s.reasons.includes("high_absence")).length,
  };

  const filterTabs: { key: FilterType; label: string; color: string }[] = [
    { key: "all",         label: `الكل (${counts.all})`,               color: "text-foreground" },
    { key: "avg_below_10",label: `معدّل ضعيف (${counts.avg_below_10})`, color: "text-red-400"    },
    { key: "mustarrak",   label: `مستدركون (${counts.mustarrak})`,      color: "text-amber-400"  },
    { key: "high_absence",label: `غياب مفرط (${counts.high_absence})`,  color: "text-orange-400" },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-l from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                إشعارات SMS الأولياء
              </h1>
              <p className="text-xs text-muted-foreground">تنبيهات تلقائية للنتائج والغياب</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={annee}
              onChange={e => setAnnee(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              {["2025-2026","2024-2025","2023-2024"].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={fetchAlerts}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-accent px-3 py-1.5 text-sm hover:bg-accent/80 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mt-3 flex flex-wrap gap-1">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all border ${
                filter === tab.key
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "border-transparent hover:border-border text-muted-foreground hover:text-foreground"
              } ${tab.color}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex h-[calc(100vh-140px)]">
        {/* ── Student list ─────────────────────────────────────────────────── */}
        <div className="flex w-full flex-col border-l border-border lg:w-[420px] flex-shrink-0">
          {/* Search */}
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="بحث بالاسم أو الفوج..."
                className="w-full rounded-lg border border-border bg-background py-2 pr-9 pl-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin ml-2" /> جاري التحميل...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground text-sm">
                <CheckCheck className="h-8 w-8 text-emerald-500/40" />
                {students.length === 0
                  ? "لا توجد بيانات نتائج أو غياب لهذه السنة."
                  : "لا توجد تنبيهات في هذه الفئة."}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map(s => (
                  <li key={s.id}>
                    <button
                      onClick={() => handleSelect(s)}
                      className={`w-full text-right px-4 py-3 transition-colors hover:bg-accent/50 ${
                        selected?.id === s.id ? "bg-emerald-500/10 border-r-2 border-emerald-500" : ""
                      }`}
                    >
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{s.nomPrenom}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {s.niveau} · الفوج {s.classe}
                            {s.annualAvg !== null && (
                              <span className={`mr-2 font-mono font-semibold ${
                                s.annualAvg < 9 ? "text-red-400" : "text-amber-400"
                              }`}>
                                {s.annualAvg.toFixed(2)}/20
                              </span>
                            )}
                            {s.unjustifiedHours > 0 && (
                              <span className="mr-2 text-orange-400">{s.unjustifiedHours}س غياب</span>
                            )}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {s.reasons.map(r => <ReasonBadge key={r} reason={r} />)}
                        </div>
                      </div>

                      {/* Phone row */}
                      <div className="mt-2" onClick={e => e.stopPropagation()}>
                        {s.parentPhone ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                            <Phone className="h-3 w-3" />
                            <span className="font-mono">{s.parentPhone}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-destructive/60 flex-shrink-0" />
                            <input
                              type="tel"
                              value={phoneEdit[s.id] ?? ""}
                              onChange={e => setPhoneEdit(p => ({ ...p, [s.id]: e.target.value }))}
                              placeholder="أدخل رقم الهاتف..."
                              className="flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-1 text-xs font-mono outline-none focus:ring-1 focus:ring-emerald-500/40 placeholder:text-muted-foreground/50"
                            />
                            <button
                              onClick={() => savePhone(s.id)}
                              disabled={!phoneEdit[s.id]?.trim() || phoneSaving[s.id]}
                              className="flex items-center gap-0.5 rounded-md bg-emerald-600/20 border border-emerald-600/30 px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                            >
                              {phoneSaved[s.id]
                                ? <><CheckCheck className="h-3 w-3" /> تم</>
                                : phoneSaving[s.id]
                                ? <RefreshCw className="h-3 w-3 animate-spin" />
                                : <><Save className="h-3 w-3" /> حفظ</>}
                            </button>
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Compose panel ────────────────────────────────────────────────── */}
        <div className="hidden lg:flex flex-1 flex-col">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
              <ChevronLeft className="h-10 w-10 opacity-20" />
              <p className="text-sm">اختر تلميذاً من القائمة لإعداد رسالته</p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col p-5 gap-4 overflow-y-auto">
              {/* Student header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-base">{selected.nomPrenom}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selected.niveau} · الفوج {selected.classe}
                    {selected.annualAvg !== null && ` · معدّل ${selected.annualAvg.toFixed(2)}/20`}
                    {selected.unjustifiedHours > 0 && ` · ${selected.unjustifiedHours}س غياب`}
                  </p>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {selected.reasons.map(r => <ReasonBadge key={r} reason={r} />)}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-lg p-1.5 hover:bg-accent text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Reason tabs (pick message topic) */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Edit3 className="h-3.5 w-3.5" /> موضوع الرسالة
                </p>
                <div className="flex flex-wrap gap-2">
                  {selected.reasons.map(r => {
                    const m = REASON_META[r];
                    return (
                      <button
                        key={r}
                        onClick={() => setActiveReason(r)}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition-all ${
                          activeReason === r
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-sm"
                            : `${m.color} hover:opacity-80`
                        }`}
                      >
                        {m.icon} {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Phone row in compose panel */}
              {!selected.parentPhone && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
                  <p className="text-xs text-amber-400 mb-2 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> لا يوجد رقم هاتف — أدخله هنا ثم احفظه
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="tel"
                      value={phoneEdit[selected.id] ?? ""}
                      onChange={e => {
                        setPhoneEdit(p => ({ ...p, [selected.id]: e.target.value }));
                        setSelected(s => s ? { ...s, parentPhone: null } : s);
                      }}
                      placeholder="0550 000 000"
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <button
                      onClick={() => savePhone(selected.id)}
                      disabled={!phoneEdit[selected.id]?.trim() || phoneSaving[selected.id]}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {phoneSaved[selected.id]
                        ? <><CheckCheck className="h-4 w-4" /> تم</>
                        : phoneSaving[selected.id]
                        ? <RefreshCw className="h-4 w-4 animate-spin" />
                        : <><Save className="h-4 w-4" /> حفظ</>}
                    </button>
                  </div>
                </div>
              )}

              {/* Message textarea */}
              <div className="flex flex-col flex-1 gap-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground">نص الرسالة</p>
                  <span className="text-xs text-muted-foreground">{message.length} حرف</span>
                </div>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  disabled={!activeReason}
                  rows={8}
                  className="w-full flex-1 resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-40"
                  placeholder={activeReason ? "" : "اختر موضوع الرسالة أعلاه..."}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  disabled={!message.trim()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-accent px-4 py-2.5 text-sm font-medium hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {copied
                    ? <><CheckCheck className="h-4 w-4 text-emerald-400" /> تم النسخ</>
                    : <><Copy className="h-4 w-4" /> نسخ</>}
                </button>

                <a
                  href={message.trim() && effectivePhone ? smsHref : undefined}
                  onClick={e => { if (!message.trim() || !effectivePhone) e.preventDefault(); }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                    message.trim() && effectivePhone
                      ? "bg-gradient-to-l from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/30 hover:opacity-90"
                      : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                  }`}
                >
                  <Send className="h-4 w-4" />
                  {effectivePhone ? "فتح تطبيق الرسائل" : "أدخل رقم الهاتف أولاً"}
                </a>
              </div>

              {/* Tip */}
              <p className="text-xs text-muted-foreground text-center">
                سيفتح تطبيق الرسائل في هاتفك مع الرقم والنص جاهزَين — أنت تؤكد الإرسال
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
