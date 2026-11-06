export const SUPPORTED_LANGS = ["fr", "en", "nl"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const LANGUAGE_POLICY_VERSION = "fr-default-v1";

/** Reset old automatic locale choices once; preserve subsequent explicit choices. */
export function initialLanguage(saved: string | null, policy: string | null): Lang {
  if (policy !== LANGUAGE_POLICY_VERSION) return "fr";
  return SUPPORTED_LANGS.find(lang => lang === saved) ?? "fr";
}