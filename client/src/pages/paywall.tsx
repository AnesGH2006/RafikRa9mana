import { motion } from "framer-motion";
import { BookOpen, Lock, Phone, Mail, CheckCircle2, Clock, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Pro",
    price: "1500",
    period: "شهر",
    features: ["جميع ميزات الإدارة", "استيراد غير محدود", "إحصائيات تفصيلية", "طباعة القوائم", "دعم فني"],
    gradient: "from-violet-600 to-indigo-700",
    glow: "shadow-violet-500/30",
  },
  {
    name: "Premium",
    price: "4000",
    period: "شهر",
    features: ["كل ميزات Pro", "تحليلات متقدمة", "نسخ احتياطي تلقائي", "تقارير PDF", "دعم أولوية 24/7"],
    gradient: "from-amber-500 to-orange-600",
    glow: "shadow-amber-500/30",
  },
];

const steps = [
  { icon: Phone, text: "تواصل معنا عبر الهاتف أو الإيميل" },
  { icon: CheckCircle2, text: "اختر الباقة المناسبة وأتمّ الدفع" },
  { icon: Shield, text: "يتم تفعيل حسابك فورًا بعد التأكيد" },
];

export default function PaywallScreen() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start pt-0 overflow-hidden relative">
      {/* Blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div className="absolute -top-48 -end-48 w-[500px] h-[500px] rounded-full bg-violet-400/10 blur-3xl"
          animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 9, repeat: Infinity }} />
        <motion.div className="absolute -bottom-48 -start-48 w-[500px] h-[500px] rounded-full bg-blue-400/10 blur-3xl"
          animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 11, repeat: Infinity, delay: 2 }} />
      </div>

      {/* Top bar */}
      <div className="w-full border-b bg-background/80 backdrop-blur px-6 py-3 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold text-sm bg-gradient-to-r from-blue-500 to-indigo-400 bg-clip-text text-transparent">
            مدير المتوسطة
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

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-10 space-y-10">
        {/* Hero */}
        <motion.div className="text-center space-y-4"
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <motion.div
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 text-sm font-bold shadow"
            animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 2.5, repeat: Infinity }}
          >
            <Lock className="w-4 h-4" />
            الوصول مقيّد — يتطلب اشتراكًا
          </motion.div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
            اختر باقتك وابدأ الآن
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto">
            حسابك مسجّل بنجاح. فعّل اشتراكك للوصول إلى جميع ميزات مدير المتوسطة.
          </p>
        </motion.div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {plans.map((plan, i) => (
            <motion.div key={plan.name}
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className={`rounded-2xl bg-gradient-to-br ${plan.gradient} p-0.5 shadow-xl ${plan.glow}`}
            >
              <div className="bg-card rounded-[14px] p-6 h-full flex flex-col">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${plan.gradient} text-white text-sm font-bold w-fit mb-4`}>
                  {plan.name}
                </div>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-4xl font-extrabold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">دج / {plan.period}</span>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f, fi) => (
                    <li key={fi} className="flex items-center gap-2 text-sm text-foreground/80">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>

        {/* How to subscribe */}
        <motion.div
          className="rounded-2xl border bg-card/60 backdrop-blur p-6 space-y-5"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        >
          <h2 className="font-bold text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-500" />
            كيفية الاشتراك
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

        {/* Contact */}
        <motion.div
          className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        >
          <div>
            <p className="font-bold text-lg mb-1">تواصل معنا للاشتراك</p>
            <p className="text-white/70 text-sm">سيتم تفعيل حسابك خلال ساعات قليلة بعد الدفع</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <a href="mailto:contact@cem-manager.dz"
              className="flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-semibold transition-colors">
              <Mail className="w-4 h-4" />
              contact@cem-manager.dz
            </a>
            <a href="tel:+213"
              className="flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-semibold transition-colors">
              <Phone className="w-4 h-4" />
              اتصل بنا
            </a>
          </div>
        </motion.div>

        <p className="text-center text-xs text-muted-foreground">
          البريد الإلكتروني المسجّل: <span className="font-semibold">{user?.email}</span>
        </p>
      </div>
    </div>
  );
}
