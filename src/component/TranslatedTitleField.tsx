import React, { useCallback } from "react";
import { Box, TextField, Typography } from "@mui/material";
import { LANGS, type LangCode, type TitlesByLang } from "../type/translatedField.constants";

export type { LangCode, TitlesByLang };

type Props = {
    values: TitlesByLang;
    onChange: (lang: LangCode, value: string) => void;
    disabled?: boolean;
    errors?: Partial<Record<LangCode, string>>;
    label?: string;
    multiline?: boolean;
    minRows?: number;
    placeholder?: string;
};

export const TranslatedTitleField = ({
                                         values,
                                         onChange,
                                         disabled = false,
                                         errors,
                                         label = "Ürün Adı",
                                         multiline = false,
                                         minRows,
                                         placeholder,
                                     }: Props) => {
    const handleChange = useCallback(
        (lang: LangCode) => (e: React.ChangeEvent<HTMLInputElement>) =>
            onChange(lang, e.target.value),
        [onChange]
    );

    return (
        <Box sx={{ display: "grid", gap: 1.25 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, color: "text.secondary" }}>
                {label}
            </Typography>
            {LANGS.map(({ code, label: langLabel, flag }) => (
                <TextField
                    key={code}
                    label={`${flag} ${langLabel}`}
                    value={values[code]}
                    onChange={handleChange(code)}
                    fullWidth
                    disabled={disabled}
                    error={!!errors?.[code]}
                    helperText={errors?.[code]}
                    inputProps={{ maxLength: multiline ? undefined : 80 }}
                    size="small"
                    multiline={multiline}
                    minRows={multiline ? (minRows ?? 2) : undefined}
                    placeholder={placeholder}
                />
            ))}
        </Box>
    );
};
