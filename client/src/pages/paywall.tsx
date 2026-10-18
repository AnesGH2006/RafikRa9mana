import { useCallback, useEffect, useState, type CSSProperties } from "react";

const BASE: string = (import.meta as any).env?.BASE_URL ?? "/";

type PlanOption = { plan: string; amountDzd: number };
type PaymentsMe = {
  role: string; // owner | admin | teacher | supervisor | counselor | parent
  plan: string;
  status: string;
  expiresAt: string | null;
  active: boolean;
  options: PlanOption[];
  prices: { school: Record<string, number>; staff: number; parent: number };
};

type CardId = "owner" | "teacher" | "supervisor" | "parent";

const CARDS: Array<{ id: CardId; title: string; who: string; features: string[] }> = [
  {
    id: "owner",
    title: "صاحب المؤسسة",
    who: "مدير المؤسسة (الحساب الرئيسي)",
    features: [
      "إدارة التلاميذ والنتائج والغيابات",
      "حسابات الأساتذة والمشرفين والأولياء",
      "إشعارات الغياب الفورية للأولياء",
    ],
  },
  {
    id: "teacher",
    title: "الأستاذ",
    who: "حسابات الأساتذة",
    features: ["استخراج الدرجات بالـ OCR", "تصدير Excel", "حاسبة المعدلات"],
  },
  {
    id: "supervisor",
    title: "المشرف التربوي",
    who: "حسابات المشرفين",
    features: ["استخراج الغيابات بالـ OCR", "تصدير Excel", "إشعارات الغياب لأولياء التلاميذ"],
  },
  {
    id: "parent",
    title: "ولي الأمر",
    who: "حسابات الأولياء",
    features: ["تتبع متقدم لمسار التلميذ", "تحليلات بالذكاء الاصطناعي", "إشعارات فورية على الهاتف"],
  },
];

const PLAN_LABELS: Record<string, string> = { basic: "الخطة الأساسية", pro: "الخطة المتقدمة" };

const css = {
  page: { maxWidth: 1000, margin: "0 auto", padding: "24px 16px", color: "#e6e9f2", fontFamily: "inherit" } as CSSProperties,
  title: { fontSize: 26, fontWeight: 700, margin: "0 0 6px" } as CSSProperties,
  sub: { color: "#94a0bd", margin: "0 0 20px", fontSize: 14 } as CSSProperties,
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 } as CSSProperties,
  card: (mine: boolean): CSSProperties => ({
    background: mine ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.04)",
    border: mine ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    opacity: mine ? 1 : 0.72,
  }),
  badge: { alignSelf: "flex-start", fontSize: 12, background: "#3b82f6", color: "#fff", borderRadius: 999, padding: "2px 10px" } as CSSProperties,
  price: { fontSize: 24, fontWeight: 700 } as CSSProperties,
  muted: { color: "#94a0bd", fontSize: 13 } as CSSProperties,
  list: { margin: 0, paddingInlineStart: 18, display: "grid", gap: 6, fontSize: 14 } as CSSProperties,
  button: (disabled: boolean): CSSProperties => ({
    background: disabled ? "#475569" : "#3b82f6",
    color: "#fff",
    border: 0,
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  }),
  banner: (ok: boolean): CSSProperties => ({
    background: ok ? "rgba(16,185,129,0.14)" : "rgba(245,158,11,0.14)",
    border: `1px solid ${ok ? "#10b981" : "#f59e0b"}`,
    borderRadius: 12,
    padding: "12px 14px",
    marginBottom: 18,
    fontSize: 14,
  }),
  error: { background: "rgba(239,68,68,0.14)", border: "1px solid #ef4444", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 14 } as CSSProperties,
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB");
}

function cardForRole(role: string): CardId | null {
  if (role === "owner" || role === "admin") return "owner";
  if (role === "teacher" || role === "supervisor" || role === "parent") return role;
  return null; // counselor etc.: covered by the school's plan
}

export default function PaymentsPage() {
  const [me, setMe] = useState<PaymentsMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (): Promise<PaymentsMe | null> => {
    try {
      const res = await fetch(`${BASE}api/payments/me`, { credentials: "include" });
      if (!res.ok) throw new Error(res.status === 401 ? "سجّل الدخول أولاً" : "تعذر تحميل حالة الاشتراك");
      const data = (await res.json()) as PaymentsMe;
      setMe(data);
      setError("");
      return data;
    } catch (e: any) {
      setError(e?.message ?? "تعذر تحميل حالة الاشتراك");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Right after paying, the webhook may take a few seconds: check a few times.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).get("paid")) return;
    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      const data = await load();
      if (data?.active || attempts >= 8) window.clearInterval(timer);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function pay(amountDzd: number) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${BASE}api/payments/chargily/checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountDzd, returnUrl: `${window.location.origin}${BASE}payments?paid=1` }),
      });
      const data = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !data.checkoutUrl) throw new Error(data.error ?? "تعذر بدء عملية الدفع");
      window.location.href = data.checkoutUrl;
    } catch (e: any) {
      setError(e?.message ?? "تعذر بدء عملية الدفع");
      setBusy(false);
    }
  }

  if (loading) return <div dir="rtl" style={css.page}>جارٍ التحميل…</div>;

  const mine = me ? cardForRole(me.role) : null;
  const expiry = formatDate(me?.expiresAt ?? null);

  return (
    <div dir="rtl" style={css.page}>
      <h1 style={css.title}>الاشتراكات والدفع</h1>
      <p style={css.sub}>اختر الخطة الخاصة بحسابك. الدفع آمن عبر Chargily (بطاقة CIB أو الذهبية).</p>

      {error && <div style={css.error} role="alert">{error}</div>}

      {me && mine && (
        <div style={css.banner(me.active)}>
          {me.active
            ? `اشتراكك فعّال${expiry ? ` حتى ${expiry}` : ""}.`
            : "ليس لديك اشتراك فعّال حالياً. إذا دفعت للتو فانتظر ثوانيَ ثم حدّث الصفحة."}
          <button
            type="button"
            style={{ ...css.button(false), marginInlineStart: 12, padding: "4px 10px" }}
            onClick={() => void load()}
          >
            تحديث الحالة
          </button>
        </div>
      )}

      {me && !mine && (
        <div style={css.banner(false)}>
          حسابك (مستشار التوجيه) يعمل ضمن اشتراك المؤسسة، ولا يحتاج إلى دفع منفصل.
        </div>
      )}

      <div style={css.grid}>
        {CARDS.map(card => {
          const isMine = mine === card.id;
          const options = isMine && me ? me.options : [];
          return (
            <section key={card.id} style={css.card(isMine)}>
              {isMine && <span style={css.badge}>خطتك</span>}
              <h2 style={{ margin: 0, fontSize: 18 }}>{card.title}</h2>
              <div style={css.muted}>{card.who}</div>

              {card.id === "owner" && me ? (
                <div style={{ display: "grid", gap: 4 }}>
                  {Object.entries(me.prices.school).map(([plan, amount]) => (
                    <div key={plan}>
                      <span style={css.price}>{amount.toLocaleString("en-US")}</span>{" "}
                      <span style={css.muted}>دج / سنة · {PLAN_LABELS[plan] ?? plan}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <span style={css.price}>
                    {(card.id === "parent" ? me?.prices.parent : me?.prices.staff)?.toLocaleString("en-US") ?? "—"}
                  </span>{" "}
                  <span style={css.muted}>دج / سنة</span>
                </div>
              )}

              <ul style={css.list}>
                {card.features.map(feature => <li key={feature}>{feature}</li>)}
              </ul>

              <div style={{ marginTop: "auto", display: "grid", gap: 8 }}>
                {isMine && options.length > 0 ? (
                  options.map(option => (
                    <button
                      key={option.plan}
                      type="button"
                      style={css.button(busy)}
                      disabled={busy}
                      onClick={() => void pay(option.amountDzd)}
                    >
                      {me?.active ? "تجديد" : "اشترك"} · {option.amountDzd.toLocaleString("en-US")} دج
                      {card.id === "owner" ? ` (${PLAN_LABELS[option.plan] ?? option.plan})` : ""}
                    </button>
                  ))
                ) : (
                  <div style={css.muted}>
                    {isMine ? "لا توجد خطة متاحة لحسابك." : `هذه الخطة مخصّصة لـ${card.who}.`}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}