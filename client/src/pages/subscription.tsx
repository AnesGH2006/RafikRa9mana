import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/language-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Zap, Star, Crown } from "lucide-react";

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export default function SubscriptionPage() {
  const { t } = useLanguage();

  const plans = [
    {
      key: "free",
      name: t("sub.free"),
      price: "0",
      icon: Star,
      gradient: "from-slate-500 to-slate-700",
      shadow: "shadow-slate-400/20",
      glow: "hover:shadow-slate-400/30",
      features: [t("sub.f1"), t("sub.f2"), t("sub.f3"), t("sub.f4")],
      cta: t("sub.current"),
      ctaVariant: "outline" as const,
      current: true,
      popular: false,
    },
    {
      key: "pro",
      name: t("sub.pro"),
      price: "1500",
      icon: Zap,
      gradient: "from-violet-600 to-indigo-700",
      shadow: "shadow-violet-500/30",
      glow: "hover:shadow-violet-500/50",
      features: [t("sub.p1"), t("sub.p2"), t("sub.p3"), t("sub.p4"), t("sub.p5")],
      cta: t("sub.upgrade"),
      ctaVariant: "default" as const,
      current: false,
      popular: true,
    },
    {
      key: "premium",
      name: t("sub.premium"),
      price: "4000",
      icon: Crown,
      gradient: "from-amber-500 to-orange-600",
      shadow: "shadow-amber-500/30",
      glow: "hover:shadow-amber-500/50",
      features: [t("sub.pr1"), t("sub.pr2"), t("sub.pr3"), t("sub.pr4"), t("sub.pr5")],
      cta: t("sub.contact"),
      ctaVariant: "default" as const,
      current: false,
      popular: false,
    },
  ];

  return (
    <motion.div
      variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="p-6 max-w-5xl mx-auto space-y-8"
    >
      {/* Header */}
      <motion.div
        className="text-center space-y-3"
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 text-xs font-bold mb-2">
          <Zap className="w-3.5 h-3.5" />
          {t("sub.title")}
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
          {t("sub.title")}
        </h1>
        <p className="text-muted-foreground text-base max-w-md mx-auto">{t("sub.subtitle")}</p>
      </motion.div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.key}
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.1, duration: 0.45, type: "spring", stiffness: 240, damping: 22 }}
            whileHover={{ y: -6, scale: 1.02 }}
            className="relative"
          >
            {plan.popular && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="absolute -top-3.5 inset-x-0 flex justify-center z-10"
              >
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-lg">
                  <Star className="w-3 h-3 fill-white" />
                  {t("sub.popular")}
                </span>
              </motion.div>
            )}

            <Card className={`relative overflow-hidden border-0 h-full shadow-xl ${plan.shadow} transition-shadow duration-300 ${plan.glow} ${plan.popular ? "ring-2 ring-violet-500/60" : ""}`}>
              {/* Gradient header */}
              <div className={`bg-gradient-to-br ${plan.gradient} p-6 relative overflow-hidden`}>
                <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/10 blur-xl" />
                <div className="absolute -bottom-6 -left-6 w-16 h-16 rounded-full bg-white/10 blur-xl" />
                <motion.div
                  className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center mb-4 relative"
                  whileHover={{ rotate: 12, scale: 1.1 }} transition={{ type: "spring", stiffness: 300 }}
                >
                  <plan.icon className="w-6 h-6 text-white" />
                </motion.div>
                <h2 className="text-xl font-extrabold text-white mb-1">{plan.name}</h2>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black text-white">{plan.price === "0" ? "0" : plan.price}</span>
                  {plan.price !== "0" && (
                    <span className="text-white/70 text-sm mb-1.5">
                      DA{t("sub.month")}
                    </span>
                  )}
                  {plan.price === "0" && (
                    <span className="text-white/70 text-sm mb-1.5">DA</span>
                  )}
                </div>
              </div>

              <CardContent className="p-5 space-y-4 flex flex-col">
                {/* Features */}
                <ul className="space-y-3 flex-1">
                  {plan.features.map((f, j) => (
                    <motion.li
                      key={j}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 + j * 0.05 + 0.3 }}
                      className="flex items-start gap-2.5 text-sm text-foreground"
                    >
                      <span className={`mt-0.5 w-5 h-5 rounded-full bg-gradient-to-br ${plan.gradient} flex items-center justify-center shrink-0 shadow-sm`}>
                        <Check className="w-3 h-3 text-white" />
                      </span>
                      {f}
                    </motion.li>
                  ))}
                </ul>

                {/* CTA */}
                <motion.div
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Button
                    variant={plan.ctaVariant}
                    disabled={plan.current}
                    className={`w-full py-5 font-bold text-sm rounded-xl shadow-md transition-all ${
                      plan.current
                        ? "opacity-70 cursor-default"
                        : plan.key === "pro"
                          ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-lg shadow-violet-500/30"
                          : plan.key === "premium"
                            ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0 shadow-lg shadow-amber-500/30"
                            : ""
                    }`}
                  >
                    {plan.current ? `✓ ${plan.cta}` : plan.cta}
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Info banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="rounded-2xl bg-gradient-to-r from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30 border border-blue-200/50 dark:border-blue-800/50 p-5 text-center"
      >
        <p className="text-sm text-muted-foreground">
          📧 &nbsp;
          <span className="font-semibold text-foreground">contact@cem-manager.dz</span>
          &nbsp; — &nbsp; للاستفسارات والاشتراكات تواصل معنا عبر البريد الإلكتروني
        </p>
      </motion.div>
    </motion.div>
  );
}
