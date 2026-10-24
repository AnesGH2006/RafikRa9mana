import { useCallback, useEffect, useState, type CSSProperties } from "react";

const BASE: string = (import.meta as any).env?.BASE_URL ?? "/";

type Me = {
  role: string; // owner | admin | teacher | supervisor | counselor | parent
  registered: boolean;
  plan: string;
  status: string;
  expiresAt: string | null;
  active: boolean;
  lastPayment: { amountDzd: number; status: string; paidAt: string | null } | null;
  prices: { school: Record<string, number>; staff: number; parent: number };
};

type Phase = "checking" | "active" | "failed" | "waiting" | "error";

/** Where each kind of account should land once its plan is active. */
function targetFor(me: Me): string {
  if (me.role === "parent") return "/my-child";
  // A parent who paid before registering with a school: next step is entering the school code.
  if (me.plan === "parent" && !me.registered) return "/parent-register";
  if (me.role === "teacher" || me.role === "supervisor") return "/upload-grades-ocr";
  return "/";
}

function targetLabel(path: string): string {
  switch (path) {
    case "/my-child": return "صفحة ابنك";
    case "/parent-register": return "ربط حسابك بمدرسة ابنك";
    case "/upload-grades-ocr": return "استخراج البيانات بالـ OCR";
    default: return "لوحة التحكم";
  }
}

const css = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#0b1020", color: "#e6e9f2" } as CSSProperties,
  card: { maxWidth: 440, width: "100%", textAlign: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: 28 } as CSSProperties,
  icon: { fontSize: 44, marginBottom: 8 } as CSSProperties,
  title: { fontSize: 20, fontWeight: 700, margin: "0 0 8px" } as CSSProperties,
  text: { color: "#94a0bd", fontSize: 14, lineHeight: 1.7, margin: "0 0 18px" } as CSSProperties,
  button: { background: "#3b82f6", color: "#fff", border: 0, borderRadius: 10, padding: "10px 18px", fontWeight: 600, cursor: "pointer", margin: 4 } as CSSProperties,
  ghost: { background: "transparent", color: "#cbd5e1", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "10px 18px", cursor: "pointer", margin: 4 } as CSSProperties,
};

export default function PaymentReturnPage() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [me, setMe] = useState<Me | null>(null);
  const [message, setMessage] = useState("");

  const check = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE}api/payments/me`, { credentials: "include" });
      if (res.status === 401) {
        setPhase("error");
        setMessage("انتهت جلستك. سجّل الدخول من جديد ثم افتح هذه الصفحة.");
        return true;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Me;
      setMe(data);
      if (data.active) {
        setPhase("active");
        return true;
      }
      if (data.lastPayment?.status === "failed") {
        setPhase("failed");
        return true;
      }
      return false;
    } catch {
      // A temporary network or server hiccup: keep waiting and try again.
      return false;
    }
  }, []);

  // Right after paying, the webhook can take a few seconds: check every 3 seconds, up to about a minute.
  useEffect(() => {
    let stopped = false;
    let tries = 0;
    let timer: number | undefined;
    const tick = async () => {
      const done = await check();
      tries += 1;
      if (stopped || done) return;
      if (tries >= 20) {
        setPhase("waiting");
        return;
      }
      timer = window.setTimeout(tick, 3000);
    };
    void tick();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [check]);

  const target = me ? targetFor(me) : "/";
  const go = useCallback(() => {
    // A full reload, so the app reads the updated account from the server.
    window.location.href = `${BASE}${target.replace(/^\//, "")}`;
  }, [target]);

  useEffect(() => {
    if (phase !== "active") return;
    const timer = window.setTimeout(go, 2500);
    return () => window.clearTimeout(timer);
  }, [phase, go]);

  return (
    <div dir="rtl" style={css.wrap}>
      <div style={css.card}>
        {phase === "checking" && (
          <>
            <div style={css.icon}>⏳</div>
            <h1 style={css.title}>جارٍ تأكيد الدفع…</h1>
            <p style={css.text}>لا تغلق هذه الصفحة. نتحقق من عملية الدفع وسنفعّل اشتراكك خلال ثوانٍ.</p>
          </>
        )}

        {phase === "active" && (
          <>
            <div style={css.icon}>✅</div>
            <h1 style={css.title}>تم تفعيل اشتراكك</h1>
            <p style={css.text}>سننقلك الآن إلى: {targetLabel(target)}</p>
            <button type="button" style={css.button} onClick={go}>المتابعة الآن</button>
          </>
        )}

        {phase === "waiting" && (
          <>
            <div style={css.icon}>🕐</div>
            <h1 style={css.title}>لم يصلنا تأكيد الدفع بعد</h1>
            <p style={css.text}>
              إذا خُصم المبلغ من بطاقتك فلا تدفع مرة ثانية، فالتفعيل قد يتأخر بضع دقائق. جرّب التحقق مرة أخرى بعد قليل،
              وإذا استمر الأمر فتواصل مع الدعم وأرسل لهم رقم العملية الظاهر في عنوان هذه الصفحة.
            </p>
            <button type="button" style={css.button} onClick={() => window.location.reload()}>تحقق مرة أخرى</button>
            <button type="button" style={css.ghost} onClick={() => { window.location.href = `${BASE}payments`; }}>العودة إلى الاشتراكات</button>
          </>
        )}

        {phase === "failed" && (
          <>
            <div style={css.icon}>⚠️</div>
            <h1 style={css.title}>لم تكتمل عملية الدفع</h1>
            <p style={css.text}>لم يُخصم أي مبلغ. يمكنك المحاولة مرة أخرى.</p>
            <button type="button" style={css.button} onClick={() => { window.location.href = `${BASE}payments`; }}>حاول مرة أخرى</button>
          </>
        )}

        {phase === "error" && (
          <>
            <div style={css.icon}>⚠️</div>
            <h1 style={css.title}>تعذر التحقق</h1>
            <p style={css.text}>{message}</p>
            <button type="button" style={css.button} onClick={() => { window.location.href = BASE; }}>الصفحة الرئيسية</button>
          </>
        )}
      </div>
    </div>
  );
}