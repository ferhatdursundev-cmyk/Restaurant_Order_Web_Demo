import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Box,
    Chip,
    TextField,
    Typography,
    Autocomplete,
} from "@mui/material";
import { ConfirmDialog, TranslatedTitleField, type TitlesByLang, type LangCode  } from "../../component";
import { ImageUploadField } from "./ImageUploadField";
import { OptionsCatalogField, type OptionItem } from "./OptionsCatalogField";
import { parseCatalog } from "./utils/Optionscatalogutils";
import { db } from "../../firebase/firebase";
import { ref as rtdbRef, update, get } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useAppDispatch, show as showNotify } from "../../store";
import { useAllergenMap } from "../../utils";
import {EMPTY_TITLES} from "../../type/translatedField.constants.ts";

const VALID_ALLERGEN_CODES = new Set([
    "A","Aa","Ab","Ac","Ad","Ae","Af",
    "B","C","D","E","F","G","H","I","J","K","L","M","N","O","Q","T",
    "1","2","3","4","5","6","7","8","9","10","11","12","13","14","15",
]);

type SegKey = string;

export type EditableItem = {
    key: string;
    segKey: SegKey;
    title: string;
    price: number;
    salePrice?: number;
    image?: string;
    ingredients?: Record<string, string>;
    allergens?: string[];
    optionsCatalog?: Record<string, unknown>;
    translations?: Record<string, { title?: string; description?: string }>;
};

type Props = {
    open: boolean;
    item: EditableItem | null;
    onClose: () => void;
};

export const ItemEditDialog = ({ open, item, onClose }: Props) => {
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
    const [salePrice,      setSalePrice]       = useState("");
    const [salePriceError, setSalePriceError]  = useState("");
    const [allergens,      setAllergens]       = useState<string[]>([]);
    const [priceError,     setPriceError]      = useState("");
    const [busy,           setBusy]            = useState(false);
    const [ingredients,    setIngredients]     = useState<TitlesByLang>(EMPTY_TITLES);
    const [imageFile,      setImageFile]       = useState<File | null>(null);
    const [imagePreview,   setImagePreview]    = useState<string | null>(null);
    const [uploadProgress, setUploadProgress]  = useState<number | null>(null);
    const [optionItems,    setOptionItems]     = useState<OptionItem[]>([]);

    useEffect(() => {
        if (!item) return;
        setTitles({
            tr: item.translations?.tr?.title || item.title,
            de: item.translations?.de?.title || "",
            en: item.translations?.en?.title || "",
            ru: item.translations?.ru?.title || "",
        });
        setTitleErrors({});
        setPrice(String(item.price));
        setSalePrice(item.salePrice ? String(item.salePrice) : "");
        setSalePriceError("");
        setAllergens(item.allergens ?? []);
        setPriceError("");
        setIngredients({
            tr: item.ingredients?.tr ?? "",
            de: item.ingredients?.de ?? "",
            en: item.ingredients?.en ?? "",
            ru: item.ingredients?.ru ?? "",
        });
        setImageFile(null);
        setImagePreview(item.image ?? null);
        setUploadProgress(null);
        setOptionItems(parseCatalog(item.optionsCatalog as unknown));
    }, [item, open]);

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

    const handleSalePriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (/^\d*$/.test(val)) { setSalePrice(val); setSalePriceError(""); }
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
        if (!item) return;

        if (!titles.tr.trim()) {
            setTitleErrors((prev) => ({ ...prev, tr: "Türkçe ad zorunludur." }));
            return;
        }

        const parsedPrice = Number(price);
        if (!price || isNaN(parsedPrice) || parsedPrice <= 0) {
            setPriceError("Geçerli bir fiyat girin.");
            return;
        }

        const parsedSalePrice = salePrice ? Number(salePrice) : null;
        if (parsedSalePrice !== null && (isNaN(parsedSalePrice) || parsedSalePrice <= 0 || parsedSalePrice >= parsedPrice)) {
            setSalePriceError("İndirimli fiyat, normal fiyattan küçük olmalıdır.");
            return;
        }

        const invalidCodes = allergens.filter((code) => !VALID_ALLERGEN_CODES.has(code));
        if (invalidCodes.length > 0) {
            dispatch(showNotify({ message: `Geçersiz alerjen kodu: ${invalidCodes.join(", ")}`, severity: "error" }));
            return;
        }

        setBusy(true);
        try {
            const snap = await get(rtdbRef(db, `menu/${item.segKey}`));
            if (snap.exists()) {
                const existing = snap.val() as Record<string, { title?: string }>;
                const titleLower = titles.tr.trim().toLowerCase();
                const isDupe = Object.entries(existing).some(
                    ([k, v]) => k !== item.key && v?.title?.toLowerCase() === titleLower
                );
                if (isDupe) {
                    dispatch(showNotify({ message: "Bu isimde bir ürün zaten var.", severity: "error" }));
                    setBusy(false);
                    return;
                }
            }

            let imageUrl: string | undefined;
            if (imageFile) {
                const ext = imageFile.name.split(".").pop() ?? "jpg";
                imageUrl  = await uploadImage(imageFile, `menu/${item.segKey}/${item.key}.${ext}`);
            }

            const ingredientsMap: Record<string, string | null> = {
                "ingredients/tr": ingredients.tr.trim() || null,
                "ingredients/de": ingredients.de.trim() || null,
                "ingredients/en": ingredients.en.trim() || null,
                "ingredients/ru": ingredients.ru.trim() || null,
            };

            const payload: Record<string, unknown> = {
                title:     titles.tr.trim(),
                price:     parsedPrice,
                salePrice: parsedSalePrice,
                allergens: allergens.length > 0 ? allergens : [],
                ...ingredientsMap,
                "translations/tr/title": titles.tr.trim(),
                "translations/de/title": titles.de.trim(),
                "translations/en/title": titles.en.trim(),
                "translations/ru/title": titles.ru.trim(),
            };
            if (imageUrl) payload.image = imageUrl;
            if (optionItems.length > 0) payload.optionsCatalog = optionItems;

            await update(rtdbRef(db, `menu/${item.segKey}/${item.key}`), payload);
            dispatch(showNotify({ message: "Ürün güncellendi.", severity: "success" }));
            onClose();
        } catch {
            dispatch(showNotify({ message: "Güncellenemedi. Yetki hatası.", severity: "error" }));
        } finally {
            setBusy(false);
            setUploadProgress(null);
        }
    }, [item, titles.tr, titles.de, titles.en, titles.ru, price, salePrice, allergens, dispatch, imageFile, ingredients.tr, ingredients.de, ingredients.en, ingredients.ru, optionItems, onClose, uploadImage]);

    const handleClose = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);

    return (
        <ConfirmDialog
            open={open}
            maxWidth="sm"
            title="Ürünü Düzenle"
            confirmText={busy ? "Kaydediliyor..." : "Kaydet"}
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

                <TextField
                    label="İndirimli Fiyat (TL) — opsiyonel"
                    value={salePrice}
                    onChange={handleSalePriceChange}
                    fullWidth
                    disabled={busy}
                    error={!!salePriceError}
                    helperText={salePriceError || "Boş bırakılırsa indirim uygulanmaz"}
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
