import { Switch, Route, Link, useRoute, useLocation } from "wouter";
import { ThemeProvider, useTheme } from "@/contexts/theme-provider";
import { LanguageProvider, useLanguage } from "@/contexts/language-provider";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Moon, Sun, LogOut, BookOpen, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import Dashboard from "@/pages/dashboard";
import Students from "@/pages/students";
import NotFound from "@/pages/not-found";

// ── Sidebar nav item ─────────────────────────────────────────────────────────
function NavItem({ href, icon: Icon, label, delay = 0 }: { href: string; icon: React.ElementType; label: string; delay?: number }) {
  const [active] = useRoute(href === "/" ? "/" : `${href}*`);
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
    >
      <Link href={href}>
        <motion.div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer relative overflow-hidden group
            ${active ? "text-white font-semibold" : "text-slate-300 hover:text-white"}`}
          whileHover={{ x: active ? 0 : 4 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          {/* Active background */}
          <AnimatePresence>
            {active && (
              <motion.div
                className="absolute inset-0 bg-white/15 rounded-xl"
                layoutId="activeNav"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </AnimatePresence>
          {/* Hover bg */}
          <div className="absolute inset-0 bg-white/0 group-hover:bg-white/8 rounded-xl transition-colors duration-200" />
          <Icon className={`w-5 h-5 shrink-0 relative z-10 transition-transform duration-200 group-hover:scale-110 ${active ? "text-white" : ""}`} />
          <span className="text-sm relative z-10">{label}</span>
          {active && (
            <motion.div
              className="ms-auto w-1.5 h-1.5 rounded-full bg-white/80 relative z-10"
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}
            />
          )}
        </motion.div>
      </Link>
    </motion.div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ onClose }: { onClose?: () => void }) {
  const { t } = useLanguage();
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      {/* Logo */}
      <motion.div className="p-5 border-b border-white/10 flex items-center justify-between"
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3">
          <motion.div
            className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0"
            whileHover={{ rotate: 10, scale: 1.1 }} transition={{ type: "spring", stiffness: 300 }}
          >
            <BookOpen className="w-4 h-4 text-white" />
          </motion.div>
          <span className="font-bold text-sm leading-tight">{t("appName")}</span>
        </div>
        {onClose && (
          <motion.button onClick={onClose} className="text-slate-400 hover:text-white" whileTap={{ scale: 0.9 }}>
            <X className="w-5 h-5" />
          </motion.button>
        )}
      </motion.div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <NavItem href="/"        icon={LayoutDashboard} label={t("nav.dashboard")} delay={0.08} />
        <NavItem href="/students" icon={Users}           label={t("nav.students")}  delay={0.14} />
      </nav>

      {/* User / logout */}
      <motion.div className="p-3 border-t border-white/10"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        {user && (
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <motion.div whileHover={{ scale: 1.1 }} transition={{ type: "spring", stiffness: 300 }}>
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} className="w-7 h-7 rounded-full" alt="" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
                  {(user.firstName?.[0] || user.email?.[0] || "?").toUpperCase()}
                </div>
              )}
            </motion.div>
            <span className="text-xs text-slate-300 truncate flex-1">
              {user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user.email}
            </span>
          </div>
        )}
        <motion.button
          onClick={logout} whileHover={{ x: 3 }} whileTap={{ scale: 0.97 }}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition-colors text-sm"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {t("nav.logout")}
        </motion.button>
      </motion.div>
    </div>
  );
}

// ── Language + Theme controls ────────────────────────────────────────────────
function LangButtons({ language, setLanguage }: { language: string; setLanguage: (l: "en" | "ar" | "fr") => void }) {
  return (
    <div className="flex items-center rounded-lg border bg-muted p-0.5 gap-0.5">
      {(["en", "ar", "fr"] as const).map(lang => (
        <motion.button key={lang} onClick={() => setLanguage(lang)} whileTap={{ scale: 0.92 }}
          className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${
            language === lang ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}>{lang.toUpperCase()}</motion.button>
      ))}
    </div>
  );
}

function ThemeButton({ theme, setTheme, t }: { theme: string; setTheme: (t: "light" | "dark") => void; t: (k: any) => string }) {
  return (
    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}>
      <Button variant="ghost" size="icon" className="h-8 w-8"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t("toggleTheme")}>
        <AnimatePresence mode="wait">
          {theme === "dark" ? (
            <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <Sun className="h-4 w-4" />
            </motion.div>
          ) : (
            <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <Moon className="h-4 w-4" />
            </motion.div>
          )}
        </AnimatePresence>
      </Button>
    </motion.div>
  );
}

// ── Mobile top bar ────────────────────────────────────────────────────────────
function MobileBar() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="h-14 border-b bg-background flex items-center justify-between px-4 lg:hidden">
        <motion.button onClick={() => setMobileOpen(true)} className="text-foreground" whileTap={{ scale: 0.9 }}>
          <Menu className="w-5 h-5" />
        </motion.button>
        <div className="flex items-center gap-2">
          <LangButtons language={language} setLanguage={setLanguage} />
          <ThemeButton theme={theme} setTheme={setTheme} t={t} />
        </div>
      </header>
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
            <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed inset-y-0 start-0 w-64 z-50 lg:hidden">
              <Sidebar onClose={() => setMobileOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Main app layout ───────────────────────────────────────────────────────────
function AppLayout() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [location] = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col">
        <Sidebar />
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileBar />
        {/* Desktop toolbar */}
        <motion.div className="hidden lg:flex items-center justify-end gap-2 px-6 py-2 border-b bg-background"
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <LangButtons language={language} setLanguage={setLanguage} />
          <ThemeButton theme={theme} setTheme={setTheme} t={t} />
        </motion.div>
        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <Switch key={location}>
              <Route path="/" component={Dashboard} />
              <Route path="/students" component={Students} />
              <Route component={NotFound} />
            </Switch>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen() {
  const { login } = useAuth();
  const { t } = useLanguage();

  const features = ["login.feature1", "login.feature2", "login.feature3", "login.feature4"] as const;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div className="absolute -top-40 -end-40 w-96 h-96 rounded-full bg-blue-400/10 blur-3xl"
          animate={{ scale: [1, 1.1, 1], rotate: [0, 10, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="absolute -bottom-40 -start-40 w-96 h-96 rounded-full bg-violet-400/10 blur-3xl"
          animate={{ scale: [1, 1.15, 1], rotate: [0, -10, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }} />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
        className="text-center max-w-xl mx-auto relative z-10">

        {/* Logo */}
        <motion.div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-semibold mb-8"
          initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, type: "spring", stiffness: 260 }}>
          <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}>
            <BookOpen className="w-4 h-4" />
          </motion.div>
          CEM Manager
        </motion.div>

        {/* Headline */}
        <motion.h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          {t("login.hero")}
        </motion.h1>

        <motion.p className="text-lg text-muted-foreground mb-10"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.18 }}>
          {t("login.subtitle")}
        </motion.p>

        {/* Feature cards */}
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-10">
          {features.map((k, i) => (
            <motion.div key={k}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.07, duration: 0.4, type: "spring", stiffness: 260 }}
              whileHover={{ y: -3, scale: 1.03 }}
              className="flex items-center gap-2 p-3 rounded-xl bg-card border text-sm text-muted-foreground cursor-default"
            >
              <motion.div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0"
                whileHover={{ rotate: 10 }}>
                <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              </motion.div>
              {t(k)}
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}>
            <Button size="lg"
              className="px-10 py-6 text-base font-bold rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30"
              onClick={login}>
              {t("login.cta")}
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ── Auth gate ─────────────────────────────────────────────────────────────────
function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"
        animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      {isAuthenticated ? (
        <motion.div key="app" className="h-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <AppLayout />
        </motion.div>
      ) : (
        <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <LoginScreen />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="ui-theme">
      <LanguageProvider defaultLang="ar">
        <AuthGate />
        <Toaster />
      </LanguageProvider>
    </ThemeProvider>
  );
}
