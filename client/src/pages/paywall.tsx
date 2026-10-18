import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Lock, Phone, Mail, CheckCircle2, Clock, Shield, Zap, Crown, Sparkles, Leaf, School, CreditCard, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { SCHOOL_STAGE } from "@/lib/deployment";
import { FREE_STUDENT_LIMIT } from "@shared/subscription";

const plans = [
  {
    key: "free",
    name: "مجاني",
    price: "0",
    period: "",
    perMonth: "تجربة أساسية",
    features: [
      `حتى ${FREE_STUDENT_LIMIT} تلميذاً`,
      "تسجيل الحضور والغياب الأساسي",
      "إدخال النقاط والنتائج",
      "لوحة التحكم المبسطة"
    ],
    gradient: "from-slate-500 to-slate-700",
    glow: "shadow-slate-500/20",
    icon: Leaf,
    popular: false,
    priceDzd: 0,
  },
  {
    key: "parent_premium",
    name: "ولي الأمر (Parent)",
    nameEn: "Parent Portal",
    price: "1 000",
    period: "سنة",
    perMonth: "متابعة مسار التلميذ",
    features: [
      "تنبيهات الغياب والتأخر الفورية",
      "كشف النقاط والنتائج الرقمية",
      "تحليل المستوى بالذكاء الاصطناعي",
      "تواصل مباشر مع الإدارة والأساتذة"
    ],
    gradient: "from-blue-500 to-indigo-600",
    glow: "shadow-blue-500/30",
    icon: Users,
    popular: false,
    priceDzd: 1000,
  },
  {
    key: "teacher_pro",
    name: "الأستاذ / المستشار Pro",
    nameEn: "Pro Edition",
    price: "2 000",
    period: "سنة",
    perMonth: "اشتراك فردي احترافي",
    features: [
      "توليد الملاحظات بالذكاء الاصطناعي (AI)",
      "مسح وقراءة الشهادات الطبية (OCR)",
      "تصدير وحقن ملفات Excel تلقائياً",
      "تسجيل الغيابات بنقرة زر واحدة",
      "طباعة التقارير واستدعاءات الأولياء"
    ],
    gradient: "from-emerald-500 to-teal-600",
    glow: "shadow-emerald-500/30",
    icon: Zap,
    popular: true,
    priceDzd: 2000,
  },
  {
    key: "school_full",
    name: "المؤسسة (School Admin)",
    nameEn: "School License",
    price: "8 000",
    period: "سنة",
    perMonth: "ترخيص شامل للمؤسسة",
    features: [
      "وصول كامل لجميع الأساتذة والمستشارين",
      "ربط غير محدود للحسابات الإدارية",
      "لوحة قيادة المدير الشاملة (Head Admin)",
      "تكامل تام مع نظام الرقمنة الوزاري",
      "أولوية الدعم الفني والتفعيل الفوري"
    ],
    gradient: "from-violet-600 to-indigo-700",
    glow: "shadow-violet-500/30",
    icon: School,
    popular: false,
    priceDzd: 8000,
  },
  {
    key: "institution",
    name: "مجموعات مدارس",
    nameEn: "Multi-School",
    price: "تواصل",
    period: "",
    perMonth: "للمجمعات المدرسية",
    features: [
      "عدد مدارس وتلاميذ غير محدود",
      "كل ميزات Pro والمؤسسة",
      "تقارير وإحصائيات مخصصة",
      "وكيل سطح المكتب وتكامل خاص",
      "مرافقة ودعم مخصص 24/7"
    ],
    gradient: "from-amber-500 to-orange-600",
    glow: "shadow-amber-500/30",
    icon: Crown,
    popular: false,
    priceDzd: 0,
  },
];

const steps = [
  { icon: Phone, text: "اختر الباقة المناسبة لدورك في المؤسسة" },
  { icon: CheckCircle2, text: "أتمّ عملية الدفع الآمن عبر البطاقة الذهبية / CIB" },
  { icon: Shield, text: "يتم تفعيل الميزات الاحترافية لحسابك فوراً" },
];

export default function PaywallScreen() {
  const { user, logout } = useAuth();
  const [checkoutBusyKey, setCheckoutBusyKey] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [freeBusy, setFreeBusy] = useState(false);

  async function activateFreePlan() {
    setFreeBusy(true);
    setCheckoutError("");
    try {
      const response = await fetch(`/api/payments/free/activate`, {
        method: "POST",
        credentials: "include",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "تعذر تفعيل الخطة المجانية");
      window.location.assign("/");
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "تعذر تفعيل الخطة المجانية");
      setFreeBusy(false);
    }
  }

  async function startCheckout(planKey: string, amountDzd: number) {
    setCheckoutBusyKey(planKey);
    setCheckoutError("");
    try {
      const response = await fetch(`/api/payments/chargily/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          planKey,
          amountDzd,
          returnUrl: `${window.location.origin}/` 
        }),
      });

      const payload = (await response.json()) as { checkoutUrl?: string; error?: string };
      if (!response.ok || !payload.checkoutUrl) throw new Error(payload.error ?? "تعذر بدء عملية الدفع");
      
      window.location.href = payload.checkoutUrl;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "تعذر الاتصال ببوابة الدفع";
      setCheckoutError(errorMsg);
      alert(`تعذر الدفع: ${errorMsg}`);
      setCheckoutBusyKey(null);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start pt-0 overflow-hidden relative font-sans" dir="rtl">
      {/* Top Header Bar */}
      <div className="w-full border-b bg-background/80 backdrop-blur px-6 py-3 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md text-white font-bold text-xs">
            ر
          </div>
          <span className="font-extrabold text-sm bg-gradient-to-r from-blue-500 to-indigo-400 bg-clip-text text-transparent">
            رفيق الرقمنة
          </span>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              {user.firstName || user.email}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={logout} className="text-xs text-muted-foreground">
            تسجيل الخروج
          </Button>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 py-10 space-y-10">
        {/* Hero Banner */}
        <motion.div className="text-center space-y-4"
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <motion.div
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 text-sm font-bold shadow"
            animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 2.5, repeat: Infinity }}
          >
            <Lock className="w-4 h-4" />
            اختر الباقة المناسبة لدورك والمؤسسة
          </motion.div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
            اختر باقتك وابدأ الآن
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto">
            اشتراك سنوي موحد يغطي الفصول الدراسية الثلاثة بالكامل ويوفر لك كافة أدوات الرقمنة.
          </p>
        </motion.div>

        {/* School Stage Info */}
        <motion.div className="rounded-2xl border bg-card/70 backdrop-blur p-5 md:p-6 max-w-3xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-violet-600" />
            <h2 className="font-extrabold text-base">نوع المؤسسة الحالي</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {SCHOOL_STAGE === "moyen" ? "CEM / المتوسطة — 1AM إلى 4AM" : "Lycée / الثانوي — 1AS إلى 3AS"}
          </p>
        </motion.div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {plans.map((plan, i) => {
            const Icon = plan.icon;
            const isBusy = checkoutBusyKey === plan.key;
            return (
              <motion.div key={plan.key}
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className={`relative rounded-2xl bg-gradient-to-br ${plan.gradient} p-0.5 shadow-xl ${plan.glow} flex flex-col`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 inset-x-0 flex justify-center z-10">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-lg">
                      <Sparkles className="w-3 h-3 fill-white" />
                      الأكثر طلباً للأساتذة
                    </span>
                  </div>
                )}
                <div className="bg-card rounded-[14px] p-6 h-full flex flex-col justify-between">
                  <div>
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${plan.gradient} text-white text-sm font-bold w-fit mb-4`}>
                      <Icon className="w-3.5 h-3.5" />
                      {plan.name}
                    </div>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-3xl font-extrabold text-foreground">{plan.price}</span>
                      {plan.period && <span className="text-muted-foreground text-sm">دج / {plan.period}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mb-5 min-h-[32px]">{plan.perMonth}</p>
                    <ul className="space-y-2.5 mb-6">
                      {plan.features.map((f, fi) => (
                        <li key={fi} className="flex items-start gap-2 text-sm text-foreground/80">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-border/40 mt-auto">
                    {plan.key === "free" ? (
                      <Button onClick={activateFreePlan} disabled={freeBusy} variant="outline" className="w-full font-bold">
                        {freeBusy ? "جارٍ تفعيل الخطة…" : "ابدأ مجاناً"}
                      </Button>
                    ) : plan.key === "institution" ? (
                      <a 
                        href="mailto:alaagh23dz@gmail.com" 
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-sm font-bold text-amber-500 transition hover:bg-amber-500/20 w-full"
                      >
                        <Mail className="h-4 w-4" /> تواصل معنا
                      </a>
                    ) : (
                      <Button 
                        onClick={() => startCheckout(plan.key, plan.priceDzd)} 
                        disabled={isBusy} 
                        className="w-full bg-emerald-600 text-white hover:bg-emerald-700 font-bold flex items-center justify-center gap-2"
                      >
                        <CreditCard className="w-4 h-4" />
                        {isBusy ? "جاري التحويل..." : "الدفع عبر Chargily"}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {checkoutError && (
          <p className="text-center text-sm font-bold text-rose-600">{checkoutError}</p>
        )}

        {/* Steps */}
        <motion.div className="rounded-2xl border bg-card/60 backdrop-blur p-6 space-y-5"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        >
          <h2 className="font-bold text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-500" />
            خطوات الاشتراك الفوري
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {steps.map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-3 p-4 rounded-xl bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center">
                  <step.icon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <p className="text-sm text-foreground/80">{step.text}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}