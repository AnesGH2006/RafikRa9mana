import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Me = { role: string; plan: string; registered: boolean };

function targetFor(me: Me): string {
  if (me.plan === "parent" && !me.registered) return "/parent-register";
  if (me.role === "parent" && me.registered) return "/my-child";
  if (me.role === "teacher" || me.role === "supervisor" || me.plan === "staff") return "/upload-grades-ocr";
  return "/";
}

export default function PaymentReturn() {
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const checkoutId = new URLSearchParams(window.location.search).get("checkout_id");
    if (!checkoutId) {
      setStatus("failed");
      setErrorMessage("معرف الدفع غير موجود في الرابط.");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/payments/verify?checkout_id=${encodeURIComponent(checkoutId)}`, { credentials: "include" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setStatus("failed");
          setErrorMessage(data.error || "فشل التحقق من حالة الدفع.");
          return;
        }
        setStatus("success");
        const me: Me = await fetch("/api/payments/me", { credentials: "include" }).then(r => r.json());
        setTimeout(() => window.location.assign(targetFor(me)), 1500);
      } catch {
        setStatus("failed");
        setErrorMessage("حدث خطأ في الاتصال بالخادم أثناء التحقق.");
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <div className="max-w-md w-full bg-card border rounded-2xl shadow-xl p-8 text-center space-y-6">
        {status === "loading" && (<>
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto" />
          <h2 className="text-xl font-bold">جاري التحقق من عملية الدفع...</h2>
        </>)}
        {status === "success" && (<>
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
          <h2 className="text-xl font-bold text-emerald-600">تم الدفع وتفعيل الباقة بنجاح!</h2>
        </>)}
        {status === "failed" && (<>
          <XCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-red-600">فشل عملية الدفع أو التحقق</h2>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <Button onClick={() => window.location.assign("/")} className="w-full">العودة إلى الرئيسية</Button>
        </>)}
      </div>
    </div>
  );
}