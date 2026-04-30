import React, { useCallback } from "react";
import { Box, TextField, Typography } from "@mui/material";

const LANGS = [
    { code: "tr", label: "Türkçe", flag: "🇹🇷" },
    { code: "de", label: "Almanca", flag: "🇩🇪" },
    { code: "en", label: "İngilizce", flag: "🇬🇧" },
    { code: "ru", label: "Rusça",    flag: "🇷🇺" },
] as const;

export type LangCode = typeof LANGS[number]["code"];
export type TitlesByLang = Record<LangCode, string>;

type Props = {
    values: TitlesByLang;
    onChange: (lang: LangCode, value: string) => void;
    disabled?: boolean;
    errors?: Partial<Record<LangCode, string>>;
};

export const TranslatedTitleField = ({ values, onChange, disabled = false, errors }: Props) => {
    const handleChange = useCallback(
        (lang: LangCode) => (e: React.ChangeEvent<HTMLInputElement>) =>
            onChange(lang, e.target.value),
        [onChange]
    );

    return (
        <Box sx={{ display: "grid", gap: 1.25 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, color: "text.secondary" }}>
                Ürün Adı
            </Typography>
            {LANGS.map(({ code, label, flag }) => (
                <TextField
                    key={code}
                    label={`${flag} ${label}`}
                    value={values[code]}
                    onChange={handleChange(code)}
                    fullWidth
                    disabled={disabled}
                    error={!!errors?.[code]}
                    helperText={errors?.[code]}
                    inputProps={{ maxLength: 80 }}
                    size="small"
                />
            ))}
        </Box>
    );
};

export const EMPTY_TITLES: TitlesByLang = { tr: "", de: "", en: "", ru: "" };