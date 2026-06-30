import { Switch, Route, Link, useLocation } from "wouter";
import { ThemeProvider, useTheme } from "@/contexts/theme-provider";
import { LanguageProvider, useLanguage } from "@/contexts/language-provider";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, Moon, Sun, LogOut, BookOpen, Menu, X,
  ClipboardList, GraduationCap, Compass, Database, Settings,
  ChevronDown, FileSpreadsheet, BarChart3, UserX, List, CheckSquare,
  User, BarChart2, CalendarOff, UserCheck, RefreshCw, AlertCircle,
  TrendingUp, Star, CreditCard, Upload, FileText,
} from "lucide-react";
import { QuickImportDialog } from "@/components/quick-import";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import Dashboard from "@/pages/dashboard";
import Students from "@/pages/students";
import Results from "@/pages/results";
import SubjectsPage from "@/pages/subjects";
import YearEnd from "@/pages/yearend";
import ImportPage from "@/pages/import";
import SettingsPage from "@/pages/settings";
import BEMPage from "@/pages/bem";
import ExamResultsPage from "@/pages/exam-results";
import AbsencesPage from "@/pages/absences-page";
import RepeatersPage from "@/pages/repeaters";
import OrientationResultsPage from "@/pages/orientation-results";
import TransferResultsPage from "@/pages/transfer-results";
import CouncilsPage from "@/pages/councils";
import AnalyticsPage from "@/pages/analytics";
import ReportsPage from "@/pages/reports";
import SubscriptionPage from "@/pages/subscription";
import AdminPage from "@/pages/admin";
import PaywallScreen from "@/pages/paywall";
import NotFound from "@/pages/not-found";

// ── Types ─────────────────────────────────────────────────────────────────────
interface NavItemDef {
  href: string;
  icon: React.ElementType;
  labelKey: string;
  badge?: string;
  accent?: string;
}
interface SectionDef {
  id: string;
  icon: React.ElementType;
  labelKey: string;
  color: string;
  gradient: string;
  items: NavItemDef[];
}

// ── Sidebar sections ──────────────────────────────────────────────────────────
const SECTIONS: SectionDef[] = [
  {
    id: "students", icon: Users, labelKey: "nav.students_section",
    color: "text-blue-400", gradient: "from-blue-500 to-blue-700",
    items: [
      { href: "/",         icon: LayoutDashboard, labelKey: "nav.dashboard" },
      { href: "/students", icon: List,            labelKey: "nav.students"  },
    ],
  },
  {
    id: "results", icon: ClipboardList, labelKey: "nav.results_section",
    color: "text-violet-400", gradient: "from-violet-500 to-purple-700",
    items: [
      { href: "/results",              icon: ClipboardList,  labelKey: "nav.results"           },
      { href: "/subjects",             icon: BarChart3,      labelKey: "nav.subjects"          },
      { href: "/exam-results",         icon: BarChart2,      labelKey: "nav.exam_results"      },
      { href: "/absences",             icon: CalendarOff,    labelKey: "nav.absences"          },
      { href: "/repeaters",            icon: UserCheck,      labelKey: "nav.repeaters"         },
      { href: "/failed",               icon: AlertCircle,    labelKey: "nav.failed"            },
      { href: "/orientation-results",  icon: Compass,        labelKey: "nav.orient_results"   },
      { href: "/transfer-results",     icon: RefreshCw,      labelKey: "nav.transfer_results" },
      { href: "/councils",             icon: ClipboardList,  labelKey: "nav.councils"         },
      { href: "/bem",                  icon: GraduationCap,  labelKey: "nav.bem"              },
    ],
  },
  {
    id: "yearend", icon: GraduationCap, labelKey: "nav.yearend_section",
    color: "text-emerald-400", gradient: "from-emerald-500 to-green-700",
    items: [
      { href: "/yearend",        icon: CheckSquare, labelKey: "nav.yearend"     },
      { href: "/yearend/passed", icon: CheckSquare, labelKey: "nav.passed_list" },
      { href: "/yearend/failed", icon: UserX,       labelKey: "nav.failed_list" },
    ],
  },
  {
    id: "analytics", icon: TrendingUp, labelKey: "nav.analytics_section",
    color: "text-cyan-400", gradient: "from-cyan-500 to-blue-600",
    items: [
      { href: "/analytics", icon: BarChart3, labelKey: "nav.analytics", accent: "text-cyan-400" },
      { href: "/reports",   icon: FileText,  labelKey: "nav.reports",   accent: "text-cyan-400" },
    ],
  },
  {
    id: "orient", icon: Compass, labelKey: "nav.orient_section",
    color: "text-amber-400", gradient: "from-amber-500 to-orange-700",
    items: [
      { href: "/orientation", icon: Compass, labelKey: "nav.orientation", badge: "قريباً" },
    ],
  },
  {
    id: "data", icon: Database, labelKey: "nav.data_section",
    color: "text-sky-400", gradient: "from-sky-500 to-cyan-700",
    items: [
      { href: "/import", icon: FileSpreadsheet, labelKey: "nav.import" },
    ],
  },
  {
    id: "more", icon: Settings, labelKey: "nav.more_section",
    color: "text-slate-400", gradient: "from-slate-500 to-slate-700",
    items: [
      { href: "/settings",      icon: Settings,    labelKey: "nav.settings"     },
      { href: "/account",       icon: User,        labelKey: "nav.account"      },
      { href: "/subscription",  icon: CreditCard,  labelKey: "nav.subscription", badge: "PRO" },
      { href: "/admin",         icon: Star,        labelKey: "nav.admin"        },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function isActive(href: string, loc: string): boolean {
  if (href === "/") return loc === "/";
  return loc === href || loc.startsWith(href + "/");
}
function sectionHasActive(section: SectionDef, loc: string): boolean {
  return section.items.some(item => isActive(item.href, loc));
}

// ── Nav item ──────────────────────────────────────────────────────────────────
function NavItem({ item, loc, onClick }: { item: NavItemDef; loc: string; onClick?: () => void }) {
  const { t } = useLanguage();
  const active = isActive(item.href, loc);
  return (
    <Link href={item.href} onClick={onClick}>
      <motion.div
        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg cursor-pointer relative group transition-colors
          ${active ? "bg-white/14 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-white/6"}`}
        whileHover={{ x: active ? 0 : 3 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {active && (
          <motion.div className="absolute inset-0 rounded-lg bg-white/12" layoutId="activeItem"
            transition={{ type: "spring", stiffness: 300, damping: 30 }} />
        )}
        {active && <div className="absolute start-0 inset-y-2 w-0.5 bg-white/80 rounded-full" />}
        <item.icon className={`w-3.5 h-3.5 shrink-0 relative z-10 ${active ? "text-white" : item.accent || ""}`} />
        <span className="text-xs relative z-10 flex-1">{t(item.labelKey)}</span>
        {item.badge && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold relative z-10 ${
            item.badge === "PRO"
              ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white"
              : "bg-amber-500/20 text-amber-400"
          }`}>
            {item.badge}
          </span>
        )}
      </motion.div>
    </Link>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────
function SidebarSection({ section, loc, onItemClick }: {
  section: SectionDef; loc: string; onItemClick?: () => void;
}) {
  const { t } = useLanguage();
  const hasActive = sectionHasActive(section, loc);
  const [open, setOpen] = useState(hasActive);
  useEffect(() => { if (hasActive) setOpen(true); }, [hasActive]);

  return (
    <div className="space-y-0.5">
      <motion.button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-start hover:bg-white/5 transition-colors group"
        whileTap={{ scale: 0.98 }}
      >
        <section.icon className={`w-3.5 h-3.5 shrink-0 ${section.color}`} />
        <span className={`text-[11px] font-bold uppercase tracking-wider flex-1 ${hasActive ? "text-white" : "text-slate-400 group-hover:text-slate-300"}`}>
          {t(section.labelKey)}
        </span>
        <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-3 h-3 text-slate-500" />
        </motion.div>
      </motion.button>

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
                transition={{ delay: i * 0.03 }}>
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
      <motion.div className="px-4 py-3 border-b border-white/8 flex items-center justify-between shrink-0"
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-2.5">
          <motion.div
            className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/40"
            whileHover={{ rotate: 8, scale: 1.1 }} transition={{ type: "spring", stiffness: 300 }}
          >
            <BookOpen className="w-4 h-4 text-white" />
          </motion.div>
          <div>
            <p className="font-extrabold text-sm leading-tight bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
              {t("appName")}
            </p>
            <p className="text-[9px] text-slate-400 leading-tight">إدارة المتوسطة</p>
          </div>
        </div>
        {onClose && (
          <motion.button onClick={onClose} className="text-slate-400 hover:text-white" whileTap={{ scale: 0.9 }}>
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </motion.div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        {SECTIONS.map((section, i) => (
          <motion.div key={section.id}
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}>
            <SidebarSection section={section} loc={loc} onItemClick={onClose} />
          </motion.div>
        ))}
      </nav>

      {/* Upgrade banner */}
      <motion.div
        className="mx-2 mb-2 rounded-xl overflow-hidden"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
      >
        <Link href="/subscription">
          <motion.div
            className="bg-gradient-to-r from-violet-600 to-indigo-700 p-3 cursor-pointer relative overflow-hidden"
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10 blur-xl" />
            <div className="flex items-center gap-2 relative">
              <Star className="w-4 h-4 text-amber-300 fill-amber-300 shrink-0" />
              <div>
                <p className="text-white text-[11px] font-bold">{t("sub.upgrade")} → Pro</p>
                <p className="text-white/60 text-[9px]">{t("sub.p2")}</p>
              </div>
            </div>
          </motion.div>
        </Link>
      </motion.div>

      {/* User footer */}
      <motion.div className="px-2 pb-3 pt-1 border-t border-white/8 shrink-0"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        {user && (
          <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
            <motion.div whileHover={{ scale: 1.1 }} className="shrink-0">
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} className="w-6 h-6 rounded-full" alt="" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold shadow-md">
                  {(user.firstName?.[0] || user.email?.[0] || "?").toUpperCase()}
                </div>
              )}
            </motion.div>
            <p className="text-[11px] text-slate-300 truncate flex-1">
              {user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user.email}
            </p>
          </div>
        )}
        <motion.button onClick={logout} whileHover={{ x: 3 }} whileTap={{ scale: 0.97 }}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors text-xs">
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          {t("nav.logout")}
        </motion.button>
      </motion.div>
    </div>
  );
}

// ── Lang + Theme ──────────────────────────────────────────────────────────────
function LangButtons() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="flex items-center rounded-lg border bg-muted p-0.5 gap-0.5">
      {(["ar", "fr", "en"] as const).map(lang => (
        <motion.button key={lang} onClick={() => setLanguage(lang)} whileTap={{ scale: 0.92 }}
          className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${
            language === lang
              ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}>{lang.toUpperCase()}</motion.button>
      ))}
    </div>
  );
}
function ThemeButton() {
  const { theme, setTheme } = useTheme();
  return (
    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}>
      <Button variant="ghost" size="icon" className="h-8 w-8"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
        <AnimatePresence mode="wait">
          {theme === "dark"
            ? <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}><Sun className="h-4 w-4 text-amber-400" /></motion.div>
            : <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}><Moon className="h-4 w-4" /></motion.div>}
        </AnimatePresence>
      </Button>
    </motion.div>
  );
}

// ── Mobile bar ────────────────────────────────────────────────────────────────
function MobileBar() {
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  return (
    <>
      <header className="h-12 border-b bg-background flex items-center justify-between px-4 lg:hidden">
        <motion.button onClick={() => setOpen(true)} whileTap={{ scale: 0.9 }}>
          <Menu className="w-5 h-5" />
        </motion.button>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 text-white text-xs font-semibold"
            whileTap={{ scale: 0.92 }}
            data-testid="button-mobile-import"
          >
            <Upload className="w-3 h-3" />
            استيراد
          </motion.button>
          <LangButtons /><ThemeButton />
        </div>
      </header>
      <QuickImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setOpen(false)} />
            <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed inset-y-0 start-0 w-64 z-50 lg:hidden shadow-2xl">
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
      <motion.div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/30 dark:to-orange-950/30 flex items-center justify-center mb-4 shadow-lg"
        animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
        <Compass className="w-8 h-8 text-amber-500 opacity-60" />
      </motion.div>
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <p className="text-muted-foreground text-sm">هذه الصفحة قيد الإنشاء — قريباً</p>
    </motion.div>
  );
}

// ── App layout ────────────────────────────────────────────────────────────────
function AppLayout() {
  const [loc] = useLocation();
  const [importOpen, setImportOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden lg:flex w-56 xl:w-60 shrink-0 flex-col border-e">
        <Sidebar />
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <MobileBar />
        <motion.div className="hidden lg:flex items-center justify-end gap-2 px-5 py-2 border-b bg-background/90 backdrop-blur-md"
          style={{ borderImage: "linear-gradient(to right, transparent, hsl(var(--border)), transparent) 1" }}
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Button
              size="sm"
              onClick={() => setImportOpen(true)}
              className="gap-1.5 h-8 text-xs font-semibold bg-gradient-to-r from-sky-500 to-blue-600 text-white border-0 shadow-md shadow-sky-500/25 hover:from-sky-600 hover:to-blue-700"
              data-testid="button-header-import"
            >
              <Upload className="w-3.5 h-3.5" />
              استيراد
            </Button>
          </motion.div>
          <LangButtons /><ThemeButton />
        </motion.div>
        <QuickImportDialog open={importOpen} onOpenChange={setImportOpen} />
        <main className="flex-1 overflow-y-auto bg-dot-grid">
          <AnimatePresence mode="wait" initial={false}>
            <Switch key={loc}>
              <Route path="/"                    component={Dashboard} />
              <Route path="/students"            component={Students} />
              <Route path="/results"             component={Results} />
              <Route path="/subjects"            component={SubjectsPage} />
              <Route path="/exam-results"        component={ExamResultsPage} />
              <Route path="/absences"            component={AbsencesPage} />
              <Route path="/repeaters"           component={RepeatersPage} />
              <Route path="/failed">{() => <RepeatersPage />}</Route>
              <Route path="/orientation-results" component={OrientationResultsPage} />
              <Route path="/transfer-results"    component={TransferResultsPage} />
              <Route path="/councils"            component={CouncilsPage} />
              <Route path="/bem"                 component={BEMPage} />
              <Route path="/yearend"             component={YearEnd} />
              <Route path="/yearend/passed">{() => <YearEnd />}</Route>
              <Route path="/yearend/failed">{() => <YearEnd />}</Route>
              <Route path="/analytics"           component={AnalyticsPage} />
              <Route path="/reports"             component={ReportsPage} />
              <Route path="/subscription"        component={SubscriptionPage} />
              <Route path="/admin"               component={AdminPage} />
              <Route path="/orientation">{() => <ComingSoon title="التوجيه النهائي" />}</Route>
              <Route path="/import"              component={ImportPage} />
              <Route path="/settings"            component={SettingsPage} />
              <Route path="/account">{() => <SettingsPage />}</Route>
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
  const featureIcons = [Users, BarChart3, LayoutDashboard, GraduationCap];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background overflow-hidden relative bg-dot-grid">
      {/* Decorative blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div className="absolute -top-40 -end-40 w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-3xl"
          animate={{ scale: [1, 1.14, 1], rotate: [0, 12, 0] }} transition={{ duration: 9, repeat: Infinity }} />
        <motion.div className="absolute -bottom-40 -start-40 w-[500px] h-[500px] rounded-full bg-violet-500/10 blur-3xl"
          animate={{ scale: [1, 1.2, 1], rotate: [0, -12, 0] }} transition={{ duration: 11, repeat: Infinity, delay: 2 }} />
        <motion.div className="absolute top-1/3 start-1/4 w-64 h-64 rounded-full bg-cyan-400/8 blur-3xl"
          animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 7, repeat: Infinity, delay: 1 }} />
        <motion.div className="absolute bottom-1/3 end-1/4 w-48 h-48 rounded-full bg-pink-400/8 blur-3xl"
          animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 8, repeat: Infinity, delay: 3 }} />
      </div>

      <motion.div className="text-center max-w-xl mx-auto relative z-10">
        {/* Brand pill */}
        <motion.div
          className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-500/15 to-indigo-500/15 border border-blue-400/25 text-blue-600 dark:text-blue-300 text-sm font-bold mb-8 shadow-lg backdrop-blur-sm"
          initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, type: "spring", stiffness: 260 }}
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4 }}
            className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md"
          >
            <BookOpen className="w-3.5 h-3.5 text-white" />
          </motion.div>
          {t("appName")}
        </motion.div>

        <motion.h1
          className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent mb-4 leading-tight"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
        >
          {t("login.hero")}
        </motion.h1>
        <motion.p
          className="text-lg text-muted-foreground mb-10"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.18 }}
        >
          {t("login.subtitle")}
        </motion.p>

        {/* Feature cards */}
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-10">
          {features.map((k, i) => {
            const Icon = featureIcons[i];
            const gradients = [
              "from-blue-500 to-indigo-600",
              "from-violet-500 to-purple-600",
              "from-cyan-500 to-blue-600",
              "from-emerald-500 to-teal-600",
            ];
            return (
              <motion.div key={k}
                initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.25 + i * 0.07, type: "spring", stiffness: 260 }}
                whileHover={{ y: -4, scale: 1.03 }}
                className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-card/80 backdrop-blur-sm border shadow-sm text-sm text-muted-foreground hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all cursor-default"
              >
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${gradients[i]} flex items-center justify-center shrink-0 shadow-md`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium">{t(k)}</span>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          <motion.div
            whileHover={{ scale: 1.05, y: -3 }} whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Button size="lg"
              className="px-14 py-6 text-base font-extrabold rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 text-white shadow-2xl shadow-blue-500/30 border-0 tracking-wide"
              onClick={login}
            >
              {t("login.cta")}
            </Button>
          </motion.div>
          <motion.p className="text-xs text-muted-foreground mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
            تسجيل الدخول عبر حساب Replit • آمن ومشفر
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ── Auth gate ─────────────────────────────────────────────────────────────────
function AuthGate() {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"
        animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
    </div>
  );

  const isSubscribed = user?.subscriptionStatus === "active";

  return (
    <AnimatePresence mode="wait">
      {!isAuthenticated
        ? <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}><LoginScreen /></motion.div>
        : !isSubscribed
          ? <motion.div key="paywall" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}><PaywallScreen /></motion.div>
          : <motion.div key="app" className="h-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}><AppLayout /></motion.div>
      }
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
