export const LANGS = [
    { code: "tr", label: "Türkçe", flag: "🇹🇷" },
    { code: "de", label: "Almanca", flag: "🇩🇪" },
    { code: "en", label: "İngilizce", flag: "🇬🇧" },
    { code: "ru", label: "Rusça",    flag: "🇷🇺" },
] as const;

export type LangCode = typeof LANGS[number]["code"];
export type TitlesByLang = Record<LangCode, string>;

export const EMPTY_TITLES: TitlesByLang = { tr: "", de: "", en: "", ru: "" };
