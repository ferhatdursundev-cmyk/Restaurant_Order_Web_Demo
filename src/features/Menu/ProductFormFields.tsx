import React, { useMemo } from "react";
import {
    Box,
    Chip,
    TextField,
    Typography,
    Autocomplete,
} from "@mui/material";
import { TranslatedTitleField, type TitlesByLang, type LangCode } from "../../component";
import { ImageUploadField } from "./ImageUploadField";
import { OptionsCatalogField, type OptionItem } from "./OptionsCatalogField";
import { useAllergenMap } from "../../utils";

export const VALID_ALLERGEN_CODES = new Set([
    "A","Aa","Ab","Ac","Ad","Ae","Af",
    "B","C","D","E","F","G","H","I","J","K","L","M","N","O","Q","T",
    "1","2","3","4","5","6","7","8","9","10","11","12","13","14","15",
]);

export type ProductFormState = {
    titles:         TitlesByLang;
    titleErrors:    Partial<Record<LangCode, string>>;
    price:          string;
    priceError:     string;
    salePrice:      string;
    salePriceError: string;
    allergens:      string[];
    ingredients:    TitlesByLang;
    optionItems:    OptionItem[];
    imageFile:      File | null;
    imagePreview:   string | null;
    uploadProgress: number | null;
};

export type ProductFormHandlers = {
    onTitleChange:       (lang: LangCode, value: string) => void;
    onPriceChange:       (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSalePriceChange:   (e: React.ChangeEvent<HTMLInputElement>) => void;
    onIngredientsChange: (lang: LangCode, value: string) => void;
    onAllergenChange:    (_: unknown, newVal: { code: string; label: string }[]) => void;
    onAllergenDelete:    (code: string) => void;
    onOptionItemsChange: (items: OptionItem[]) => void;
    onFile:              (file: File) => void;
};

type Props = {
    state:    ProductFormState;
    handlers: ProductFormHandlers;
    disabled: boolean;
};

export const ProductFormFields = ({ state, handlers, disabled }: Props) => {
    const allergenMap = useAllergenMap();

    const allergenOptions = useMemo(
        () =>
            Object.entries(allergenMap)
                .filter(([code]) => VALID_ALLERGEN_CODES.has(code))
                .map(([code, label]) => ({ code, label })),
        [allergenMap]
    );

    const selectedAllergenObjects = useMemo(
        () => allergenOptions.filter((opt) => state.allergens.includes(opt.code)),
        [allergenOptions, state.allergens]
    );

    return (
        <Box sx={{ display: "grid", gap: 2, pt: 1 }}>
            <ImageUploadField
                preview={state.imagePreview}
                uploadProgress={state.uploadProgress}
                disabled={disabled}
                onFile={handlers.onFile}
            />

            <TranslatedTitleField
                values={state.titles}
                onChange={handlers.onTitleChange}
                disabled={disabled}
                errors={state.titleErrors}
            />

            <TextField
                label="Fiyat (TL)"
                value={state.price}
                onChange={handlers.onPriceChange}
                fullWidth
                disabled={disabled}
                error={!!state.priceError}
                helperText={state.priceError}
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
            />

            {/*
            <TextField
                label="İndirimli Fiyat (TL) — opsiyonel"
                value={state.salePrice}
                onChange={handlers.onSalePriceChange}
                fullWidth
                disabled={disabled}
                error={!!state.salePriceError}
                helperText={state.salePriceError || "Boş bırakılırsa indirim uygulanmaz"}
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
            />
        */}
            <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1, color: "text.secondary" }}>
                    İçindekiler
                </Typography>
                <TranslatedTitleField
                    values={state.ingredients}
                    onChange={handlers.onIngredientsChange}
                    disabled={disabled}
                    multiline
                    minRows={2}
                    placeholder="Örn: un, su, tuz, maya, zeytinyağı..."
                />
            </Box>

            <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1, color: "text.secondary" }}>
                    Alerjenler
                </Typography>
                <Autocomplete
                    multiple
                    options={allergenOptions}
                    getOptionLabel={(opt) => opt.label}
                    value={selectedAllergenObjects}
                    onChange={handlers.onAllergenChange}
                    disabled={disabled}
                    isOptionEqualToValue={(opt, val) => opt.code === val.code}
                    renderTags={(value, getTagProps) =>
                        value.map((opt, index) => (
                            <Chip
                                {...getTagProps({ index })}
                                key={opt.code}
                                label={opt.label}
                                size="small"
                                sx={{ borderRadius: 999, fontWeight: 600 }}
                            />
                        ))
                    }
                    renderInput={(params) => (
                        <TextField {...params} placeholder="Alerjen seç..." size="small" />
                    )}
                />
            </Box>

            {state.allergens.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                    {state.allergens.map((code) => (
                        <Chip
                            key={code}
                            label={allergenMap[code] ?? code}
                            size="small"
                            variant="outlined"
                            onDelete={() => handlers.onAllergenDelete(code)}
                            sx={{ borderRadius: 999, fontWeight: 600, fontSize: 12 }}
                        />
                    ))}
                </Box>
            )}

            <OptionsCatalogField
                items={state.optionItems}
                onChange={handlers.onOptionItemsChange}
                disabled={disabled}
            />
        </Box>
    );
};
