import React, { useState, useCallback, useMemo } from "react";
import {
    Box,
    Chip,
    TextField,
    Typography,
    Autocomplete,
} from "@mui/material";
import { ConfirmDialog, TranslatedTitleField, type TitlesByLang, type LangCode  } from "../../component";
import { ImageUploadField } from "./ImageUploadField";
import { OptionsCatalogField, type OptionItem } from "./OptionsCatalogField.tsx";
import { db } from "../../firebase/firebase";
import { ref as rtdbRef, push, set, get } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useAppDispatch, show as showNotify } from "../../store";
import { useAllergenMap } from "../../utils";
import {EMPTY_TITLES} from "../../type/translatedField.constants.ts";

const VALID_ALLERGEN_CODES = new Set([
    "A","Aa","Ab","Ac","Ad","Ae","Af",
    "B","C","D","E","F","G","H","I","J","K","L","M","N","O","Q","T",
    "1","2","3","4","5","6","7","8","9","10","11","12","13","14","15",
]);

type Props = {
    open: boolean;
    segKey: string;
    categoryLabel: string;
    onClose: () => void;
};

export const AddProductDialog = ({ open, segKey, categoryLabel, onClose }: Props) => {
    const dispatch    = useAppDispatch();
    const allergenMap = useAllergenMap();
    const storage     = useMemo(() => getStorage(), []);

    const allergenOptions = useMemo(
        () =>
            Object.entries(allergenMap)
                .filter(([code]) => VALID_ALLERGEN_CODES.has(code))
                .map(([code, label]) => ({ code, label })),
        [allergenMap]
    );

    const [titles,         setTitles]         = useState<TitlesByLang>(EMPTY_TITLES);
    const [titleErrors,    setTitleErrors]     = useState<Partial<Record<LangCode, string>>>({});
    const [price,          setPrice]           = useState("");
    const [allergens,      setAllergens]       = useState<string[]>([]);
    const [priceError,     setPriceError]      = useState("");
    const [busy,           setBusy]            = useState(false);
    const [ingredients,    setIngredients]     = useState<TitlesByLang>(EMPTY_TITLES);
    const [optionItems,    setOptionItems]     = useState<OptionItem[]>([]);
    const [imageFile,      setImageFile]       = useState<File | null>(null);
    const [imagePreview,   setImagePreview]    = useState<string | null>(null);
    const [uploadProgress, setUploadProgress]  = useState<number | null>(null);

    const resetForm = useCallback(() => {
        setTitles(EMPTY_TITLES);
        setTitleErrors({});
        setPrice("");
        setAllergens([]);
        setPriceError("");
        setIngredients(EMPTY_TITLES);
        setImageFile(null);
        setImagePreview(null);
        setUploadProgress(null);
    }, []);

    const handleTitleChange = useCallback((lang: LangCode, value: string) => {
        setTitles((prev) => ({ ...prev, [lang]: value }));
        setTitleErrors((prev) => ({ ...prev, [lang]: undefined }));
    }, []);

    const handleIngredientsChange = useCallback((lang: LangCode, value: string) => {
        setIngredients((prev) => ({ ...prev, [lang]: value }));
    }, []);

    const handleFile = useCallback((file: File) => {
        setImageFile(file);
        const reader = new FileReader();
        reader.onload = (e) => setImagePreview(e.target?.result as string);
        reader.readAsDataURL(file);
    }, []);

    const handlePriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (/^\d*$/.test(val)) { setPrice(val); setPriceError(""); }
    }, []);

    const handleAllergenChange = useCallback(
        (_: unknown, newVal: { code: string; label: string }[]) =>
            setAllergens(newVal.map((v) => v.code)),
        []
    );

    const selectedAllergenObjects = useMemo(
        () => allergenOptions.filter((opt) => allergens.includes(opt.code)),
        [allergenOptions, allergens]
    );

    const uploadImage = useCallback(
        (file: File, path: string): Promise<string> =>
            new Promise((resolve, reject) => {
                const sRef = storageRef(storage, path);
                const task = uploadBytesResumable(sRef, file);
                task.on(
                    "state_changed",
                    (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
                    reject,
                    async () => resolve(await getDownloadURL(task.snapshot.ref))
                );
            }),
        [storage]
    );

    const handleSave = useCallback(async () => {
        if (!titles.tr.trim()) {
            setTitleErrors((prev) => ({ ...prev, tr: "Türkçe ad zorunludur." }));
            return;
        }

        const parsedPrice = Number(price);
        if (!price || isNaN(parsedPrice) || parsedPrice <= 0) {
            setPriceError("Geçerli bir fiyat girin.");
            return;
        }

        const invalidCodes = allergens.filter((code) => !VALID_ALLERGEN_CODES.has(code));
        if (invalidCodes.length > 0) {
            dispatch(showNotify({ message: `Geçersiz alerjen kodu: ${invalidCodes.join(", ")}`, severity: "error" }));
            return;
        }

        setBusy(true);
        try {
            const snap = await get(rtdbRef(db, `menu/${segKey}`));
            if (snap.exists()) {
                const existing = snap.val() as Record<string, { title?: string }>;
                const titleLower = titles.tr.trim().toLowerCase();
                const isDupe = Object.values(existing).some(
                    (v) => v?.title?.toLowerCase() === titleLower
                );
                if (isDupe) {
                    dispatch(showNotify({ message: "Bu isimde bir ürün zaten var.", severity: "error" }));
                    setBusy(false);
                    return;
                }
            }

            const newRef = push(rtdbRef(db, `menu/${segKey}`));
            const newKey = newRef.key!;

            let imageUrl = "";
            if (imageFile) {
                const ext = imageFile.name.split(".").pop() ?? "jpg";
                imageUrl  = await uploadImage(imageFile, `menu/${segKey}/${newKey}.${ext}`);
            }

            const ingredientsMap: Record<string, string> = {};
            if (ingredients.tr.trim()) ingredientsMap.tr = ingredients.tr.trim();
            if (ingredients.de.trim()) ingredientsMap.de = ingredients.de.trim();
            if (ingredients.en.trim()) ingredientsMap.en = ingredients.en.trim();
            if (ingredients.ru.trim()) ingredientsMap.ru = ingredients.ru.trim();

            await set(newRef, {
                id:          Date.now(),
                title:       titles.tr.trim(),
                price:       parsedPrice,
                isAvailable: true,
                type:        segKey,
                keyTitle:    titles.tr.trim().toLowerCase().replace(/\s+/g, "_"),
                allergens:   allergens.length > 0 ? allergens : [],
                ...(imageUrl && { image: imageUrl }),
                ...(Object.keys(ingredientsMap).length > 0 && { ingredients: ingredientsMap }),
                ...(optionItems.length > 0 && { optionsCatalog: optionItems }),
                translations: {
                    tr: { title: titles.tr.trim() },
                    ...(titles.de.trim() && { de: { title: titles.de.trim() } }),
                    ...(titles.en.trim() && { en: { title: titles.en.trim() } }),
                    ...(titles.ru.trim() && { ru: { title: titles.ru.trim() } }),
                },
            });

            dispatch(showNotify({ message: `"${titles.tr.trim()}" eklendi.`, severity: "success" }));
            resetForm();
            onClose();
        } catch {
            dispatch(showNotify({ message: "Eklenemedi. Yetki hatası.", severity: "error" }));
        } finally {
            setBusy(false);
            setUploadProgress(null);
        }
    }, [titles, price, allergens, ingredients, imageFile, optionItems, segKey, uploadImage, dispatch, resetForm, onClose]);

    const handleClose = useCallback(() => {
        if (!busy) { resetForm(); onClose(); }
    }, [busy, resetForm, onClose]);

    return (
        <ConfirmDialog
            open={open}
            maxWidth="sm"
            title={`${categoryLabel} — Yeni Ürün Ekle`}
            confirmText={busy ? "Kaydediliyor..." : "Ekle"}
            cancelText="İptal"
            busy={busy}
            onClose={handleClose}
            onConfirm={handleSave}
        >
            <Box sx={{ display: "grid", gap: 2, pt: 1 }}>
                <ImageUploadField
                    preview={imagePreview}
                    uploadProgress={uploadProgress}
                    disabled={busy}
                    onFile={handleFile}
                />

                <TranslatedTitleField
                    values={titles}
                    onChange={handleTitleChange}
                    disabled={busy}
                    errors={titleErrors}
                />

                <TextField
                    label="Fiyat (TL)"
                    value={price}
                    onChange={handlePriceChange}
                    fullWidth
                    disabled={busy}
                    error={!!priceError}
                    helperText={priceError}
                    inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                />

                <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1, color: "text.secondary" }}>
                        İçindekiler
                    </Typography>
                    <TranslatedTitleField
                        values={ingredients}
                        onChange={handleIngredientsChange}
                        disabled={busy}
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
                        onChange={handleAllergenChange}
                        disabled={busy}
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

                {allergens.length > 0 && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                        {allergens.map((code) => (
                            <Chip
                                key={code}
                                label={allergenMap[code] ?? code}
                                size="small"
                                variant="outlined"
                                onDelete={() => setAllergens((prev) => prev.filter((c) => c !== code))}
                                sx={{ borderRadius: 999, fontWeight: 600, fontSize: 12 }}
                            />
                        ))}
                    </Box>
                )}

                <OptionsCatalogField
                    items={optionItems}
                    onChange={setOptionItems}
                    disabled={busy}
                />
            </Box>
        </ConfirmDialog>
    );
};
