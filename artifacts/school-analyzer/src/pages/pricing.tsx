import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/language-provider";
import { useSubscription } from "@/contexts/subscription-context";
import { useToast } from "@/hooks/use-toast";
import { SubscriptionPlan } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function Pricing() {
  const { t, language } = useLanguage();
  const { subscription, refetch } = useSubscription();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  // Pro/Max mode selection
  const [selectedModeForPremium, setSelectedModeForPremium] = useState<"cem" | "lycee">("lycee");

  useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/subscriptions/plans`);
        if (res.ok) {
          const data = await res.json();
          setPlans(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchPlans();
  }, []);

  const handleActivate = async (planId: string) => {
    setActivating(planId);
    
    const isPremium = planId === "pro" || planId === "max";
    const modeToUse = isPremium ? selectedModeForPremium : "cem";

    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/subscriptions/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, schoolMode: modeToUse }),
        credentials: "include"
      });

      if (res.ok) {
        await refetch();
        toast({ title: "Success", description: "Subscription updated successfully." });
        setLocation("/");
      } else {
        toast({ variant: "destructive", title: "Error", description: "Failed to update subscription." });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: "Failed to update subscription." });
    } finally {
      setActivating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="text-center mb-12 space-y-4">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          {t("pricing.title")}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          {t("pricing.subtitle")}
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan, i) => {
          const isCurrent = subscription?.plan === plan.id;
          const isPro = plan.id === "pro";
          const isPremium = plan.id === "pro" || plan.id === "max";
          
          let titleKey = `plan.${plan.id}`;
          let localizedName = t(titleKey as any);
          if (localizedName === titleKey) localizedName = plan.name; // fallback

          let planFeatures = plan.features;
          if (language === "ar") planFeatures = plan.featuresAr;
          if (language === "fr") planFeatures = plan.featuresFr;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex"
            >
              <Card className={`relative flex flex-col w-full transition-all duration-300 ${
                isCurrent ? "ring-2 ring-primary shadow-lg shadow-primary/10" : "hover:shadow-md"
              } ${isPro ? "border-primary/50" : ""} ${plan.id === "max" ? "border-amber-500/30" : ""}`}>
                
                {isPro && (
                  <div className="absolute -top-3 left-0 right-0 flex justify-center">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                      <Sparkles className="w-3 h-3" />
                      {t("pricing.mostPopular")}
                    </span>
                  </div>
                )}
                
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-2xl font-bold">{localizedName}</CardTitle>
                  <div className="mt-4 flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-extrabold">
                      {plan.priceDA === 0 ? t("pricing.free") : plan.priceDA}
                    </span>
                    {plan.priceDA > 0 && <span className="text-muted-foreground font-medium">DA{plan.priceYear}</span>}
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 pt-6 space-y-6">
                  {isPremium && (
                    <div className="space-y-3 p-4 bg-muted/50 rounded-xl border">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("pricing.schoolMode")}</Label>
                      <RadioGroup 
                        value={isCurrent ? subscription.schoolMode : selectedModeForPremium} 
                        onValueChange={(val) => setSelectedModeForPremium(val as "cem" | "lycee")}
                        disabled={isCurrent}
                        className="grid gap-2"
                      >
                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                          <RadioGroupItem value="cem" id={`${plan.id}-cem`} />
                          <Label htmlFor={`${plan.id}-cem`} className="cursor-pointer">{t("pricing.cem")}</Label>
                        </div>
                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                          <RadioGroupItem value="lycee" id={`${plan.id}-lycee`} />
                          <Label htmlFor={`${plan.id}-lycee`} className="cursor-pointer">{t("pricing.lycee")}</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  {!isPremium && (
                     <div className="space-y-3 p-4 bg-muted/50 rounded-xl border opacity-50">
                       <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("pricing.schoolMode")}</Label>
                       <div className="text-sm font-medium">{t("pricing.cem")}</div>
                     </div>
                  )}

                  <ul className="space-y-3 text-sm">
                    {planFeatures.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                        <span className="text-muted-foreground">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                
                <CardFooter className="pt-6">
                  <Button 
                    className="w-full font-bold" 
                    size="lg"
                    variant={isCurrent ? "outline" : (isPro || plan.id === "max" ? "default" : "secondary")}
                    disabled={isCurrent || activating === plan.id}
                    onClick={() => handleActivate(plan.id)}
                  >
                    {activating === plan.id && <Loader2 className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 animate-spin" />}
                    {isCurrent ? t("pricing.currentPlan") : t("pricing.activate")}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
