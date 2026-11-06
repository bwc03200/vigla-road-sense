import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./locales/fr.json";
import en from "./locales/en.json";
import nl from "./locales/nl.json";

import { initialLanguage, LANGUAGE_POLICY_VERSION, SUPPORTED_LANGS, type Lang } from "./language-policy";
export { SUPPORTED_LANGS, type Lang } from "./language-policy";

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      nl: { translation: nl },
    },
    lng: "fr",
    fallbackLng: "fr",
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
  });
}

export function setLanguage(lang: Lang) {
  void i18n.changeLanguage(lang);
  if (typeof window !== "undefined") {
    document.documentElement.lang = lang;
    try {
      window.localStorage.setItem("vigla:lang", lang);
      window.localStorage.setItem("vigla:lang:policy", LANGUAGE_POLICY_VERSION);
    } catch {
      /* ignore */
    }
  }
}

/** Called after hydration: the browser's locale never overrides the app default. */
export function syncClientLocale() {
  if (typeof window === "undefined") return;
  let lang: Lang = "fr";
  try {
    lang = initialLanguage(localStorage.getItem("vigla:lang"), localStorage.getItem("vigla:lang:policy"));
  } catch { /* French remains available when storage is blocked. */ }
  setLanguage(lang);
  console.log("🟢 [i18n] Langue de l’interface", { locale: lang });
}

export function currentLang(): Lang {
  const l = (i18n.language || "fr").slice(0, 2).toLowerCase();
  return (SUPPORTED_LANGS as readonly string[]).includes(l) ? (l as Lang) : "fr";
}

export default i18n;
