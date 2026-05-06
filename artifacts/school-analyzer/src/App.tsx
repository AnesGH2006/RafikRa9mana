import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/contexts/theme-provider";
import { LanguageProvider, useLanguage, Language } from "@/contexts/language-provider";
import { SubscriptionProvider } from "@/contexts/subscription-context";
import { useAuth } from "@workspace/replit-auth-web";
import { Loader2, BookOpen, Sun, Moon, LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

import Home from "@/pages/home";
import Pricing from "@/pages/pricing";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

const pageVariants = {
  initial: { opacity: 0, y: 14, filter: "blur(4px)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: "blur(4px)",
    transition: { duration: 0.2, ease: [0.55, 0, 1, 0.45] },
  },
};

const langVariants = {
  initial: (dir: number) => ({
    opacity: 0,
    x: dir * 18,
    filter: "blur(3px)",
  }),
  animate: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir * -12,
    filter: "blur(3px)",
    transition: { duration: 0.18, ease: [0.55, 0, 1, 0.45] },
  }),
};

const LANG_ORDER: Language[] = ["en", "ar", "fr"];

function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  const handleChange = (lang: Language) => {
    if (lang !== language) setLanguage(lang);
  };

  return (
    <div className="flex bg-muted rounded-lg p-1 relative gap-0.5">
      {LANG_ORDER.map((lang) => (
        <button
          key={lang}
          onClick={() => handleChange(lang)}
          data-testid={`lang-${lang}`}
          className="relative px-3 py-1.5 text-xs font-semibold rounded-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          style={{ zIndex: 1 }}
        >
          {language === lang && (
            <motion.span
              layoutId="lang-pill"
              className="absolute inset-0 rounded-md bg-background shadow-sm"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              style={{ zIndex: -1 }}
            />
          )}
          <span className={language === lang ? "text-foreground" : "text-muted-foreground hover:text-foreground"}>
            {lang.toUpperCase()}
          </span>
        </button>
      ))}
    </div>
  );
}

function Header() {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { logout, user } = useAuth();
  const [location] = useLocation();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const navLink = (href: string, label: string) => {
    const active = location === href;
    return (
      <Link href={href} className="relative text-sm font-medium transition-colors">
        <span className={active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}>
          {label}
        </span>
        {active && (
          <motion.span
            layoutId="nav-underline"
            className="absolute -bottom-[1px] left-0 right-0 h-0.5 bg-primary rounded-full"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
      </Link>
    );
  };

  return (
    <header className="border-b bg-card/60 backdrop-blur-md sticky top-0 z-40">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-primary no-underline hover:opacity-80 transition-opacity">
            <motion.div whileHover={{ rotate: 10, scale: 1.1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
              <BookOpen className="h-6 w-6" />
            </motion.div>
            <h1 className="font-bold text-lg tracking-tight hidden sm:block">{t("appName")}</h1>
          </Link>
          <nav className="hidden md:flex items-center gap-5 border-l pl-5 ml-1">
            {navLink("/", t("nav.analyzer"))}
            {navLink("/pricing", t("nav.myPlan"))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-muted-foreground rounded-full relative"
            title={t("toggleTheme")}
            data-testid="btn-theme-toggle"
          >
            <motion.span
              key={theme}
              initial={{ rotate: -30, opacity: 0, scale: 0.7 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 30, opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute flex items-center justify-center"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </motion.span>
            <span className="sr-only">{t("toggleTheme")}</span>
          </Button>

          {user && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 border-l pl-3 ml-1"
            >
              <span className="text-sm font-medium hidden lg:block text-foreground/80">
                {user.firstName || user.email}
              </span>
              <Button variant="ghost" size="icon" onClick={logout} title={t("nav.logout")} className="text-muted-foreground hover:text-destructive transition-colors">
                <LogOut className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </header>
  );
}

function LoginLanding() {
  const { t, language } = useLanguage();
  const { login } = useAuth();

  const langIndex = LANG_ORDER.indexOf(language);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background overflow-hidden">
      <Header />
      <main className="flex-1 flex items-center justify-center container mx-auto px-4 py-12">
        <AnimatePresence mode="wait" custom={langIndex}>
          <motion.div
            key={language}
            custom={langIndex % 2 === 0 ? 1 : -1}
            variants={langVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="max-w-3xl w-full text-center space-y-8"
          >
            <div className="space-y-5">
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-semibold mb-2"
              >
                <Sparkles className="w-4 h-4" />
                {t("appName")}
              </motion.div>
              <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-tight">
                {t("login.hero")}
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {t("login.subtitle")}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-left max-w-2xl mx-auto py-4">
              {[1, 2, 3, 4].map((num, i) => (
                <motion.div
                  key={num}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.07, duration: 0.3 }}
                  className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border/50"
                >
                  <div className="mt-0.5 bg-primary/15 p-1.5 rounded-lg text-primary shrink-0">
                    <BookOpen className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm text-muted-foreground font-medium leading-snug">
                    {t(`login.feature${num}` as keyof ReturnType<typeof useLanguage>["t"])}
                  </span>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.3 }}
            >
              <Button
                size="lg"
                className="text-base px-10 py-6 h-auto rounded-full font-bold shadow-lg hover:shadow-primary/25 hover:scale-105 transition-all duration-200"
                onClick={login}
              >
                {t("login.cta")}
              </Button>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function AnimatedRoutes() {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="flex-1"
      >
        <Switch location={location}>
          <Route path="/" component={Home} />
          <Route path="/pricing" component={Pricing} />
          <Route component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}

function AuthGate({ children: _children }: { children?: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-[100dvh] flex items-center justify-center bg-background"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-10 h-10 text-primary" />
          </motion.div>
        </motion.div>
      ) : !isAuthenticated ? (
        <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <LoginLanding />
        </motion.div>
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="min-h-[100dvh] flex flex-col bg-background"
        >
          <SubscriptionProvider>
            <Header />
            <main className="flex-1 flex flex-col">
              <AnimatedRoutes />
            </main>
          </SubscriptionProvider>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="school-analyzer-theme">
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AuthGate />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
