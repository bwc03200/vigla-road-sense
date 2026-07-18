import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import fr from "./locales/fr.json";
import en from "./locales/en.json";

export const SUPPORTED_LANGS = ["fr", "en"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

const isBrowser = typeof window !== "undefined";

if (!i18n.isInitialized) {
  const chain = isBrowser
    ? i18n.use(LanguageDetector).use(initReactI18next)
    : i18n.use(initReactI18next);

  chain.init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: isBrowser ? undefined : "fr",
    fallbackLng: "fr",
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "vigla:lang",
      caches: ["localStorage"],
    },
  });
}

export function setLanguage(lang: Lang) {
  i18n.changeLanguage(lang);
  if (isBrowser) {
    try {
      window.localStorage.setItem("vigla:lang", lang);
    } catch {
      /* ignore */
    }
  }
}

export function currentLang(): Lang {
  const l = (i18n.language || "fr").slice(0, 2).toLowerCase();
  return (SUPPORTED_LANGS as readonly string[]).includes(l) ? (l as Lang) : "fr";
}

export default i18n;
