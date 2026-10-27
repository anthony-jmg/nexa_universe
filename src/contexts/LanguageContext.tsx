import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translate, Language, PUBLIC_LANGUAGES, DEFAULT_LANGUAGE } from '../i18n/translations';
import { setActiveLanguage } from '../lib/locale';

export type { Language } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Langue mémorisée : seules les langues publiques sont reprises (une ancienne
// préférence PT/ES revient au français tant qu'elles sont masquées).
const readSavedLanguage = (): Language => {
  try {
    const saved = localStorage.getItem('language') as Language | null;
    return saved && PUBLIC_LANGUAGES.includes(saved) ? saved : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => {
    const initial = readSavedLanguage();
    setActiveLanguage(initial);
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem('language', language);
    } catch {
      // Stockage indisponible (navigation privée) : la langue reste active pour la session.
    }
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    // Formats (dates, montants) basculés avant le rendu suivant.
    setActiveLanguage(lang);
    setLanguageState(lang);
  };

  const t = (key: string, params?: Record<string, string | number>): string => translate(language, key, params);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
