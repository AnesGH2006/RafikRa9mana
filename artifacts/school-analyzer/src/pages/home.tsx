import { useState } from "react";
import { FileUpload } from "@/components/ui/file-upload";
import { ResultsView } from "@/components/results-view";
import { GradeAnalysisResult } from "@workspace/api-client-react/src/generated/api.schemas";
import { useLanguage, Language } from "@/contexts/language-provider";
import { useTheme } from "@/contexts/theme-provider";
import { useToast } from "@/hooks/use-toast";
import { Moon, Sun, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState<GradeAnalysisResult | null>(null);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch(`${import.meta.env.BASE_URL}api/grades/upload`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      
      const data = await response.json();
      setResults(data);
      toast({
        title: "Success",
        description: "File analyzed successfully",
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: t("uploadError"),
        description: "Failed to parse the gradebook file.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background transition-colors duration-300">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <BookOpen className="h-6 w-6" />
            <h1 className="font-bold text-lg tracking-tight hidden sm:block">
              {t("appName")}
            </h1>
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
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 md:py-12 flex flex-col">
        {!results ? (
          <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                {t("appName")}
              </h2>
              <p className="text-lg text-muted-foreground">
                {t("uploadDesc")}
              </p>
            </div>
            <div className="w-full">
              <FileUpload onFileSelect={handleFileUpload} isUploading={isUploading} />
            </div>
          </div>
        ) : (
          <div className="w-full max-w-6xl mx-auto">
            <ResultsView data={results} onReset={() => setResults(null)} />
          </div>
        )}
      </main>
    </div>
  );
}
