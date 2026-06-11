import { Switch, Route, Link, useLocation } from "wouter";
import { ThemeProvider, useTheme } from "@/contexts/theme-provider";
import { LanguageProvider, useLanguage } from "@/contexts/language-provider";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, Moon, Sun, LogOut, BookOpen, Menu, X,
  ClipboardList, GraduationCap, Compass, Database, Settings,
  ChevronDown, FileSpreadsheet, BarChart3, UserX, UserMinus,
  CalendarOff, List, CheckSquare, Archive, User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import Dashboard from "@/pages/dashboard";
import Students from "@/pages/students";
import Results from "@/pages/results";
import SubjectsPage from "@/pages/subjects";
import YearEnd from "@/pages/yearend";
import ImportPage from "@/pages/import";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

// ── Types ─────────────────────────────────────────────────────────────────────
interface NavItemDef {
  href: string;
  icon: React.ElementType;
  labelKey: string;
  badge?: string;
}

interface SectionDef {
  id: string;
  icon: React.ElementType;
  labelKey: string;
  color: string;
  items: NavItemDef[];
}

// ── Sidebar sections config ───────────────────────────────────────────────────
const SECTIONS: SectionDef[] = [
  {
    id: "students", icon: Users, labelKey: "nav.students_section", color: "text-blue-400",
    items: [
      { href: "/",        icon: LayoutDashboard, labelKey: "nav.dashboard" },
      { href: "/students",icon: List,            labelKey: "nav.students"  },
    ],
  },
  {
    id: "results", icon: ClipboardList, labelKey: "nav.results_section", color: "text-violet-400",
    items: [
      { href: "/results",  icon: ClipboardList, labelKey: "nav.results"  },
      { href: "/subjects", icon: BarChart3,     labelKey: "nav.subjects" },
      { href: "/failed",   icon: UserX,         labelKey: "nav.failed"   },
    ],
  },
  {
    id: "yearend", icon: GraduationCap, labelKey: "nav.yearend_section", color: "text-emerald-400",
    items: [
      { href: "/yearend",         icon: CheckSquare,    labelKey: "nav.yearend"      },
      { href: "/yearend/passed",  icon: CheckSquare,    labelKey: "nav.passed_list"  },
      { href: "/yearend/failed",  icon: UserX,          labelKey: "nav.failed_list"  },
    ],
  },
  {
    id: "orient", icon: Compass, labelKey: "nav.orient_section", color: "text-amber-400",
    items: [
      { href: "/orientation", icon: Compass, labelKey: "nav.orientation", badge: "قريباً" },
    ],
  },
  {
    id: "data", icon: Database, labelKey: "nav.data_section", color: "text-cyan-400",
    items: [
      { href: "/import",  icon: FileSpreadsheet, labelKey: "nav.import"  },
    ],
  },
  {
    id: "more", icon: Settings, labelKey: "nav.more_section", color: "text-slate-400",
    items: [
      { href: "/settings", icon: Settings, labelKey: "nav.settings" },
      { href: "/account",  icon: User,     labelKey: "nav.account"  },
    ],
  },
];

// ── Helper: is a path active? ─────────────────────────────────────────────────
function isActive(href: string, loc: string): boolean {
  if (href === "/") return loc === "/";
  return loc === href || loc.startsWith(href + "/");
}

function sectionHasActive(section: SectionDef, loc: string): boolean {
  return section.items.some(item => isActive(item.href, loc));
}

// ── Single nav item ───────────────────────────────────────────────────────────
function NavItem({ item, loc, depth = 0, onClick }: { item: NavItemDef; loc: string; depth?: number; onClick?: () => void }) {
  const { t } = useLanguage();
  const active = isActive(item.href, loc);

  return (
    <Link href={item.href} onClick={onClick}>
      <motion.div
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer relative group transition-colors
          ${active ? "bg-white/12 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-white/6"}`}
        whileHover={{ x: active ? 0 : 3 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {active && (
          <motion.div className="absolute inset-0 rounded-lg bg-white/10" layoutId="activeItem"
            transition={{ type: "spring", stiffness: 300, damping: 30 }} />
        )}
        {active && <div className="absolute start-0 inset-y-2 w-0.5 bg-white rounded-full" />}
        <item.icon className={`w-4 h-4 shrink-0 relative z-10 ${active ? "text-white" : ""}`} />
        <span className="text-sm relative z-10 flex-1">{t(item.labelKey)}</span>
        {item.badge && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium relative z-10">
            {item.badge}
          </span>
        )}
      </motion.div>
    </Link>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────
function SidebarSection({ section, loc, onItemClick }: { section: SectionDef; loc: string; onItemClick?: () => void }) {
  const { t } = useLanguage();
  const hasActive = sectionHasActive(section, loc);
  const [open, setOpen] = useState(hasActive);

  // Auto-expand when navigating to this section
  useEffect(() => { if (hasActive) setOpen(true); }, [hasActive]);

  return (
    <div className="space-y-0.5">
      {/* Section header */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-start hover:bg-white/5 transition-colors group"
        whileTap={{ scale: 0.98 }}
      >
        <section.icon className={`w-4 h-4 shrink-0 ${section.color}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider flex-1 ${hasActive ? "text-white" : "text-slate-400 group-hover:text-slate-300"}`}>
          {t(section.labelKey)}
        </span>
        <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        </motion.div>
      </motion.button>

      {/* Items */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden ps-3 space-y-0.5"
          >
            {section.items.map((item, i) => (
              <motion.div key={item.href}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}>
                <NavItem item={item} loc={loc} onClick={onItemClick} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [loc] = useLocation();

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden">
      {/* Logo */}
      <motion.div className="px-4 py-4 border-b border-white/8 flex items-center justify-between shrink-0"
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3">
          <motion.div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center shrink-0 shadow-lg"
            whileHover={{ rotate: 8, scale: 1.08 }} transition={{ type: "spring", stiffness: 300 }}>
            <BookOpen className="w-4 h-4 text-white" />
          </motion.div>
          <div>
            <p className="font-bold text-sm leading-tight">{t("appName")}</p>
            <p className="text-[10px] text-slate-400 leading-tight">إدارة المتوسطة</p>
          </div>
        </div>
        {onClose && (
          <motion.button onClick={onClose} className="text-slate-400 hover:text-white" whileTap={{ scale: 0.9 }}>
            <X className="w-5 h-5" />
          </motion.button>
        )}
      </motion.div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        {SECTIONS.map((section, i) => (
          <motion.div key={section.id}
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}>
            <SidebarSection section={section} loc={loc} onItemClick={onClose} />
          </motion.div>
        ))}
      </nav>

      {/* User row */}
      <motion.div className="px-2 pb-3 pt-2 border-t border-white/8 shrink-0"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <motion.div whileHover={{ scale: 1.1 }} className="shrink-0">
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} className="w-7 h-7 rounded-full" alt="" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
                  {(user.firstName?.[0] || user.email?.[0] || "?").toUpperCase()}
                </div>
              )}
            </motion.div>
            <p className="text-xs text-slate-300 truncate flex-1">
              {user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user.email}
            </p>
          </div>
        )}
        <motion.button onClick={logout} whileHover={{ x: 3 }} whileTap={{ scale: 0.97 }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-400 hover:bg-white/6 hover:text-white transition-colors text-sm">
          <LogOut className="w-4 h-4 shrink-0" />
          {t("nav.logout")}
        </motion.button>
      </motion.div>
    </div>
  );
}

// ── Lang + Theme controls ─────────────────────────────────────────────────────
function LangButtons() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="flex items-center rounded-lg border bg-muted p-0.5 gap-0.5">
      {(["ar", "fr", "en"] as const).map(lang => (
        <motion.button key={lang} onClick={() => setLanguage(lang)} whileTap={{ scale: 0.92 }}
          className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${
            language === lang ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}>{lang.toUpperCase()}</motion.button>
      ))}
    </div>
  );
}

function ThemeButton() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
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

// ── Mobile drawer + top bar ───────────────────────────────────────────────────
function MobileBar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="h-14 border-b bg-background flex items-center justify-between px-4 lg:hidden">
        <motion.button onClick={() => setOpen(true)} whileTap={{ scale: 0.9 }}>
          <Menu className="w-5 h-5" />
        </motion.button>
        <div className="flex items-center gap-2">
          <LangButtons />
          <ThemeButton />
        </div>
      </header>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setOpen(false)} />
            <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed inset-y-0 start-0 w-64 z-50 lg:hidden">
              <Sidebar onClose={() => setOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Coming soon stub ──────────────────────────────────────────────────────────
function ComingSoon({ title }: { title: string }) {
  return (
    <motion.div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center p-8"
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
      <motion.div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4"
        animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
        <Compass className="w-8 h-8 text-muted-foreground opacity-40" />
      </motion.div>
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <p className="text-muted-foreground text-sm">هذه الصفحة قيد الإنشاء — قريباً</p>
    </motion.div>
  );
}

// ── App layout ────────────────────────────────────────────────────────────────
function AppLayout() {
  const [loc] = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 xl:w-64 shrink-0 flex-col border-e">
        <Sidebar />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <MobileBar />

        {/* Desktop toolbar */}
        <motion.div className="hidden lg:flex items-center justify-end gap-2 px-5 py-2 border-b bg-background"
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <LangButtons />
          <ThemeButton />
        </motion.div>

        {/* Page area */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <Switch key={loc}>
              <Route path="/"            component={Dashboard} />
              <Route path="/students"    component={Students} />
              <Route path="/results"     component={Results} />
              <Route path="/subjects"    component={SubjectsPage} />
              <Route path="/failed">{() => <YearEnd />}</Route>
              <Route path="/yearend"     component={YearEnd} />
              <Route path="/yearend/passed">{() => <YearEnd />}</Route>
              <Route path="/yearend/failed">{() => <YearEnd />}</Route>
              <Route path="/orientation">{() => <ComingSoon title="التوجيه المسبق" />}</Route>
              <Route path="/import"      component={ImportPage} />
              <Route path="/settings"    component={SettingsPage} />
              <Route path="/account">{() => <SettingsPage />}</Route>
              <Route component={NotFound} />
            </Switch>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// ── Login screen ──────────────────────────────────────────────────────────────
function LoginScreen() {
  const { login } = useAuth();
  const { t } = useLanguage();

  const features = ["login.feature1", "login.feature2", "login.feature3", "login.feature4"] as const;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none">
        <motion.div className="absolute -top-40 -end-40 w-96 h-96 rounded-full bg-blue-400/10 blur-3xl"
          animate={{ scale: [1, 1.12, 1], rotate: [0, 12, 0] }} transition={{ duration: 9, repeat: Infinity }} />
        <motion.div className="absolute -bottom-40 -start-40 w-96 h-96 rounded-full bg-violet-400/10 blur-3xl"
          animate={{ scale: [1, 1.18, 1], rotate: [0, -12, 0] }} transition={{ duration: 11, repeat: Infinity, delay: 2 }} />
        <motion.div className="absolute top-1/2 start-1/4 w-64 h-64 rounded-full bg-emerald-400/5 blur-3xl"
          animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 7, repeat: Infinity, delay: 1 }} />
      </div>

      <motion.div className="text-center max-w-xl mx-auto relative z-10">
        <motion.div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-semibold mb-8"
          initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, type: "spring", stiffness: 260 }}>
          <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4 }}>
            <BookOpen className="w-4 h-4" />
          </motion.div>
          {t("appName")}
        </motion.div>

        <motion.h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          {t("login.hero")}
        </motion.h1>

        <motion.p className="text-lg text-muted-foreground mb-10"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.18 }}>
          {t("login.subtitle")}
        </motion.p>

        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-10">
          {features.map((k, i) => (
            <motion.div key={k}
              initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.07, type: "spring", stiffness: 260 }}
              whileHover={{ y: -3, scale: 1.03 }}
              className="flex items-center gap-2 p-3 rounded-xl bg-card border text-sm text-muted-foreground">
              <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              </div>
              {t(k)}
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}>
            <Button size="lg"
              className="px-10 py-6 text-base font-bold rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25"
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
