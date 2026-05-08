import { useState, useEffect, useCallback, useMemo } from "react";
import { ConfirmDialog, type TitlesByLang, type LangCode } from "../../component";
import { type OptionItem } from "./OptionsCatalogField";
import { parseCatalog } from "./utils/Optionscatalogutils";
import { ProductFormFields, type ProductFormState, type ProductFormHandlers, VALID_ALLERGEN_CODES } from "./ProductFormFields";
import { db } from "../../firebase/firebase";
import { ref as rtdbRef, update, get } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useAppDispatch, show as showNotify } from "../../store";
import { EMPTY_TITLES } from "../../type/translatedField.constants.ts";

type SegKey = string;

export type EditableItem = {
    key:            string;
    segKey:         SegKey;
    title:          string;
    price:          number;
    salePrice?:     number;
    image?:         string;
    ingredients?:   Record<string, string>;
    allergens?:     string[];
    optionsCatalog?: Record<string, unknown>;
    translations?:  Record<string, { title?: string; description?: string }>;
};

type Props = {
    open:    boolean;
    item:    EditableItem | null;
    onClose: () => void;
};

export const ItemEditDialog = ({ open, item, onClose }: Props) => {
    const dispatch = useAppDispatch();
    const storage  = useMemo(() => getStorage(), []);

    const [titles,         setTitles]        = useState<TitlesByLang>(EMPTY_TITLES);
    const [titleErrors,    setTitleErrors]   = useState<Partial<Record<LangCode, string>>>({});
    const [price,          setPrice]         = useState("");
    const [priceError,     setPriceError]    = useState("");
    const [salePrice,      setSalePrice]     = useState("");
    const [salePriceError, setSalePriceError]= useState("");
    const [allergens,      setAllergens]     = useState<string[]>([]);
    const [busy,           setBusy]          = useState(false);
    const [ingredients,    setIngredients]   = useState<TitlesByLang>(EMPTY_TITLES);
    const [optionItems,    setOptionItems]   = useState<OptionItem[]>([]);
    const [imageFile,      setImageFile]     = useState<File | null>(null);
    const [imagePreview,   setImagePreview]  = useState<string | null>(null);
    const [uploadProgress, setUploadProgress]= useState<number | null>(null);

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
                const existing   = snap.val() as Record<string, { title?: string }>;
                const titleLower = titles.tr.trim().toLowerCase();
                const isDupe     = Object.entries(existing).some(([k, v]) => k !== item.key && v?.title?.toLowerCase() === titleLower);
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
    }, [item, titles, price, salePrice, allergens, ingredients, imageFile, optionItems, uploadImage, dispatch, onClose]);

    const handleClose = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);

    const formState: ProductFormState = {
        titles, titleErrors, price, priceError,
        salePrice, salePriceError, allergens,
        ingredients, optionItems, imageFile, imagePreview, uploadProgress,
    };

    const formHandlers: ProductFormHandlers = {
        onTitleChange:       (lang, value) => { setTitles((p) => ({ ...p, [lang]: value })); setTitleErrors((p) => ({ ...p, [lang]: undefined })); },
        onPriceChange:       (e) => { if (/^\d*$/.test(e.target.value)) { setPrice(e.target.value); setPriceError(""); } },
        onSalePriceChange:   (e) => { if (/^\d*$/.test(e.target.value)) { setSalePrice(e.target.value); setSalePriceError(""); } },
        onIngredientsChange: (lang, value) => setIngredients((p) => ({ ...p, [lang]: value })),
        onAllergenChange:    (_, newVal) => setAllergens((newVal as { code: string }[]).map((v) => v.code)),
        onAllergenDelete:    (code) => setAllergens((p) => p.filter((c) => c !== code)),
        onOptionItemsChange: setOptionItems,
        onFile:              (file) => { setImageFile(file); const r = new FileReader(); r.onload = (e) => setImagePreview(e.target?.result as string); r.readAsDataURL(file); },
    };

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
            <ProductFormFields state={formState} handlers={formHandlers} disabled={busy} />
        </ConfirmDialog>
    );
};
