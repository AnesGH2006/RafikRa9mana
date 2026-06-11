import { Switch, Route, Link, useRoute } from "wouter";
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

function NavItem({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  const [active] = useRoute(href === "/" ? "/" : `${href}*`);
  return (
    <Link href={href}>
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 group
        ${active
          ? "bg-white/15 text-white font-semibold"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
        }`}>
        <Icon className={`w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? "text-white" : ""}`} />
        <span className="text-sm">{label}</span>
        {active && <div className="ms-auto w-1.5 h-1.5 rounded-full bg-white/80" />}
      </div>
    </Link>
  );
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const { t } = useLanguage();
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm leading-tight">{t("appName")}</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <NavItem href="/" icon={LayoutDashboard} label={t("nav.dashboard")} />
        <NavItem href="/students" icon={Users} label={t("nav.students")} />
      </nav>

      <div className="p-3 border-t border-white/10">
        {user && (
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            {user.profileImageUrl ? (
              <img src={user.profileImageUrl} className="w-7 h-7 rounded-full" alt="" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
                {(user.firstName?.[0] || user.email?.[0] || "?").toUpperCase()}
              </div>
            )}
            <span className="text-xs text-slate-300 truncate flex-1">
              {user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user.email}
            </span>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition-all text-sm"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {t("nav.logout")}
        </button>
      </div>
    </div>
  );
}

function TopBar() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="h-14 border-b bg-background flex items-center justify-between px-4 lg:hidden">
        <button onClick={() => setMobileOpen(true)} className="text-foreground">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <LangButtons language={language} setLanguage={setLanguage} />
          <ThemeButton theme={theme} setTheme={setTheme} t={t} />
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed inset-y-0 start-0 w-64 z-50 lg:hidden"
            >
              <Sidebar onClose={() => setMobileOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function LangButtons({ language, setLanguage }: { language: string; setLanguage: (l: "en" | "ar" | "fr") => void }) {
  return (
    <div className="flex items-center rounded-lg border bg-muted p-0.5 gap-0.5">
      {(["en", "ar", "fr"] as const).map(lang => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${
            language === lang ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >{lang.toUpperCase()}</button>
      ))}
    </div>
  );
}

function ThemeButton({ theme, setTheme, t }: { theme: string; setTheme: (t: "light" | "dark") => void; t: (k: any) => string }) {
  return (
    <Button variant="ghost" size="icon" className="h-8 w-8"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t("toggleTheme")}>
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function AppLayout() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col">
        <Sidebar />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <div className="hidden lg:flex items-center justify-end gap-2 px-6 py-2 border-b bg-background">
          <LangButtons language={language} setLanguage={setLanguage} />
          <ThemeButton theme={theme} setTheme={setTheme} t={t} />
        </div>
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <Switch>
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

function LoginScreen() {
  const { login } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-xl mx-auto"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-semibold mb-8">
          <BookOpen className="w-4 h-4" /> CEM Manager
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4">{t("login.hero")}</h1>
        <p className="text-lg text-muted-foreground mb-10">{t("login.subtitle")}</p>
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-10">
          {(["login.feature1","login.feature2","login.feature3","login.feature4"] as const).map((k, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="flex items-center gap-2 p-3 rounded-xl bg-card border text-sm text-muted-foreground">
              <BookOpen className="w-4 h-4 text-blue-500 shrink-0" />{t(k)}
            </motion.div>
          ))}
        </div>
        <Button size="lg" className="px-10 py-6 text-base font-bold rounded-2xl bg-blue-600 hover:bg-blue-700 text-white" onClick={login}>
          {t("login.cta")}
        </Button>
      </motion.div>
    </div>
  );
}

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!isAuthenticated) return <LoginScreen />;
  return <AppLayout />;
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
