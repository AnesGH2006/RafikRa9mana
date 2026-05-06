import { createContext, useContext, useEffect, useState } from "react";
import { translations } from "../i18n";

export type Language = "en" | "ar" | "fr";

type LanguageProviderState = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations) => string;
  dir: "ltr" | "rtl";
};

const initialState: LanguageProviderState = {
  language: "en",
  setLanguage: () => null,
  t: () => "",
  dir: "ltr",
};

const LanguageProviderContext = createContext<LanguageProviderState>(initialState);

export function LanguageProvider({
  children,
  defaultLang = "en",
  storageKey = "ui-language",
}: {
  children: React.ReactNode;
  defaultLang?: Language;
  storageKey?: string;
}) {
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem(storageKey) as Language) || defaultLang
  );

  const dir: "ltr" | "rtl" = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute("dir", dir);
    root.setAttribute("lang", language);
  }, [language, dir]);

  const t = (key: keyof typeof translations): string => {
    if (!translations[key]) return String(key);
    return translations[key][language];
  };

  const value = {
    language,
    setLanguage: (lang: Language) => {
      localStorage.setItem(storageKey, lang);
      setLanguage(lang);
    },
    t,
    dir,
  };

  return (
    <LanguageProviderContext.Provider value={value}>
      {children}
    </LanguageProviderContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageProviderContext);
  if (context === undefined)
    throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
};
