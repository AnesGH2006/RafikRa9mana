import { Switch, Route, Link, useRoute } from "wouter";
import { ThemeProvider } from "@/contexts/theme-provider";
import { LanguageProvider, useLanguage } from "@/contexts/language-provider";
import { SubscriptionProvider } from "@/contexts/subscription-context";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/contexts/theme-provider";
import { Button } from "@/components/ui/button";
import { BookOpen, Moon, Sun, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Home from "@/pages/home";
import Pricing from "@/pages/pricing";
import NotFound from "@/pages/not-found";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [active] = useRoute(href === "/" ? "/" : `${href}*`);
  return (
    <Link href={href}>
      <Button variant={active ? "default" : "ghost"} size="sm" className="text-xs">
        {children}
      </Button>
    </Link>
  );
}

function Header() {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-foreground hover:opacity-80 transition-opacity">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold hidden sm:inline">School Grade Analyzer</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink href="/">{t("nav.analyzer")}</NavLink>
            <NavLink href="/pricing">{t("nav.myPlan")}</NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border bg-muted p-0.5 gap-0.5">
            {(["en", "ar", "fr"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                  language === lang
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={t("toggleTheme")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {user && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={logout} aria-label={t("nav.logout")}>
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function LoginScreen() {
  const { login } = useAuth();
  const { t } = useLanguage();

  const features = [
    t("login.feature1"),
    t("login.feature2"),
    t("login.feature3"),
    t("login.feature4"),
  ];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="text-center max-w-2xl mx-auto"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-8">
          <BookOpen className="w-4 h-4" />
          School Grade Analyzer
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4">
          {t("login.hero")}
        </h1>
        <p className="text-lg text-muted-foreground mb-10">
          {t("login.subtitle")}
        </p>

        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-10">
          {features.map((feat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="flex items-center gap-2 p-3 rounded-xl bg-card border text-sm text-muted-foreground"
            >
              <BookOpen className="w-4 h-4 text-primary shrink-0" />
              {feat}
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.45 }}
        >
          <Button size="lg" className="px-10 py-6 text-base font-bold rounded-2xl shadow-lg" onClick={login}>
            {t("login.cta")}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <SubscriptionProvider>
      <AnimatePresence mode="wait">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/pricing" component={Pricing} />
          <Route component={NotFound} />
        </Switch>
      </AnimatePresence>
    </SubscriptionProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="ui-theme">
      <LanguageProvider defaultLang="en">
        <div className="min-h-screen bg-background text-foreground">
          <Header />
          <main>
            <AuthGate />
          </main>
        </div>
        <Toaster />
      </LanguageProvider>
    </ThemeProvider>
  );
}
