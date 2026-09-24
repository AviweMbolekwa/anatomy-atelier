/** Script group decides which font pair loads. Every current locale is Latin
 *  script; the type stays so a new script only needs a font pair added. */
export type ScriptGroup = "latin";

export type LocaleConfig = {
  code: string;
  /** Endonym — what speakers call the language, shown in the switcher. */
  nativeName: string;
  englishName: string;
  country: string;
  dir: "ltr" | "rtl";
  script: ScriptGroup;
  /** BCP-47 tag for Intl formatting and og:locale. */
  intl: string;
};

export const locales: LocaleConfig[] = [
  { code: "en", nativeName: "English",   englishName: "English",   country: "United States", dir: "ltr", script: "latin", intl: "en_US" },
  { code: "xh", nativeName: "isiXhosa",  englishName: "Xhosa",     country: "South Africa", dir: "ltr", script: "latin", intl: "xh_ZA" },
  { code: "zu", nativeName: "isiZulu",   englishName: "Zulu",      country: "South Africa", dir: "ltr", script: "latin", intl: "zu_ZA" },
  { code: "af", nativeName: "Afrikaans", englishName: "Afrikaans", country: "South Africa", dir: "ltr", script: "latin", intl: "af_ZA" },
];

export const defaultLocale = "en";
export const localeCodes = locales.map((locale) => locale.code);

export function getLocale(code: string): LocaleConfig {
  return locales.find((locale) => locale.code === code) ?? locales[0];
}

export function isLocale(code: string): boolean {
  return localeCodes.includes(code);
}
