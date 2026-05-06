import { useState, useEffect } from "react";
import { FileUpload } from "@/components/ui/file-upload";
import { ResultsView } from "@/components/results-view";
import { GradeAnalysisResult } from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/language-provider";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/contexts/subscription-context";
import { Lock } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Link } from "wouter";

export default function Home() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { subscription } = useSubscription();
  
  const defaultMode = subscription?.schoolMode || "cem";
  const [schoolMode, setSchoolMode] = useState<"cem" | "lycee">(defaultMode as "cem" | "lycee");
  
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState<GradeAnalysisResult | null>(null);

  useEffect(() => {
    if (subscription?.schoolMode) {
      setSchoolMode(subscription.schoolMode as "cem" | "lycee");
    }
  }, [subscription]);

  const canUseLycee = subscription?.plan === "pro" || subscription?.plan === "max";

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch(`${import.meta.env.BASE_URL}api/grades/upload?mode=${schoolMode}`, {
        method: "POST",
        body: formData,
        credentials: "include"
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

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 flex flex-col items-center">
      
      {!results ? (
        <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("appName")}
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              {t("uploadDesc")}
            </p>

            <div className="inline-flex flex-col items-center gap-2 p-4 rounded-xl bg-card border shadow-sm w-full max-w-sm">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("mode.title")}</span>
              <ToggleGroup 
                type="single" 
                value={schoolMode} 
                onValueChange={(val) => {
                  if (val === "lycee" && !canUseLycee) return;
                  if (val) setSchoolMode(val as "cem" | "lycee");
                }}
                className="bg-muted p-1 rounded-lg w-full"
              >
                <ToggleGroupItem value="cem" className="flex-1 rounded-md" aria-label="CEM">
                  {t("mode.cem")}
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="lycee" 
                  disabled={!canUseLycee} 
                  className="flex-1 rounded-md relative overflow-hidden group" 
                  aria-label="Lycée"
                >
                  <span className={!canUseLycee ? "opacity-30" : ""}>{t("mode.lycee")}</span>
                  {!canUseLycee && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-[1px] opacity-100 transition-opacity">
                      <Link href="/pricing" className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                        <Lock className="w-3 h-3" /> {t("mode.upgradeRequired")}
                      </Link>
                    </div>
                  )}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
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
    </div>
  );
}
