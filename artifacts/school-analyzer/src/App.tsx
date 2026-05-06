import { Switch, Route, Router as WouterRouter, Link } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/contexts/theme-provider";
import { LanguageProvider, useLanguage, Language } from "@/contexts/language-provider";
import { SubscriptionProvider } from "@/contexts/subscription-context";
import { useAuth } from "@workspace/replit-auth-web";
import { Loader2, BookOpen, Sun, Moon, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

import Home from "@/pages/home";
import Pricing from "@/pages/pricing";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Header() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { logout, user } = useAuth();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-primary no-underline hover:opacity-90">
            <BookOpen className="h-6 w-6" />
            <h1 className="font-bold text-lg tracking-tight hidden sm:block">
              {t("appName")}
            </h1>
          </Link>
          <nav className="hidden md:flex gap-4">
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              {t("nav.analyzer")}
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              {t("nav.myPlan")}
            </Link>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-muted rounded-md p-1">
            {(["en", "ar", "fr"] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${
                  language === lang
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`lang-${lang}`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-muted-foreground rounded-full"
            title={t("toggleTheme")}
            data-testid="btn-theme-toggle"
          >
            <Sun className="h-5 w-5 scale-100 dark:scale-0 transition-transform absolute" />
            <Moon className="h-5 w-5 scale-0 dark:scale-100 transition-transform" />
            <span className="sr-only">{t("toggleTheme")}</span>
          </Button>

          {user && (
            <div className="flex items-center gap-2 border-l pl-4 ml-2">
              <span className="text-sm font-medium hidden lg:block">{user.firstName || user.email}</span>
              <Button variant="ghost" size="icon" onClick={logout} title={t("nav.logout")}>
                <LogOut className="h-5 w-5 text-muted-foreground" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function LoginLanding() {
  const { t } = useLanguage();
  const { login } = useAuth();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center container mx-auto px-4 py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl w-full text-center space-y-8"
        >
          <div className="space-y-4">
            <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight text-foreground">
              {t("login.hero")}
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              {t("login.subtitle")}
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-4 text-left max-w-2xl mx-auto py-8">
            {[1, 2, 3, 4].map(num => (
              <div key={num} className="flex items-start gap-3">
                <div className="mt-1 bg-primary/10 p-1 rounded-full text-primary">
                  <BookOpen className="w-4 h-4" />
                </div>
                <span className="text-muted-foreground font-medium">{t(`login.feature${num}` as keyof ReturnType<typeof useLanguage>['t'])}</span>
              </div>
            ))}
          </div>

          <Button size="lg" className="text-lg px-8 py-6 h-auto rounded-full font-bold shadow-lg hover:shadow-xl transition-all" onClick={login}>
            {t("login.cta")}
          </Button>
        </motion.div>
      </main>
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginLanding />;
  }

  return (
    <SubscriptionProvider>
      <div className="min-h-[100dvh] flex flex-col bg-background transition-colors duration-300">
        <Header />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </SubscriptionProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/pricing" component={Pricing} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="school-analyzer-theme">
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AuthGate>
                <Router />
              </AuthGate>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
