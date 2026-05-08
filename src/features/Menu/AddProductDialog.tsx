import { useState, useCallback, useMemo } from "react";
import { ConfirmDialog, type TitlesByLang, type LangCode } from "../../component";
import { type OptionItem } from "./OptionsCatalogField.tsx";
import { ProductFormFields, type ProductFormState, type ProductFormHandlers, VALID_ALLERGEN_CODES } from "./ProductFormFields";
import { db } from "../../firebase/firebase";
import { ref as rtdbRef, push, set, get } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useAppDispatch, show as showNotify } from "../../store";
import { EMPTY_TITLES } from "../../type/translatedField.constants.ts";

type Props = {
    open:          boolean;
    segKey:        string;
    categoryLabel: string;
    onClose:       () => void;
};

export const AddProductDialog = ({ open, segKey, categoryLabel, onClose }: Props) => {
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

    const resetForm = useCallback(() => {
        setTitles(EMPTY_TITLES);
        setTitleErrors({});
        setPrice("");
        setPriceError("");
        setSalePrice("");
        setSalePriceError("");
        setAllergens([]);
        setIngredients(EMPTY_TITLES);
        setImageFile(null);
        setImagePreview(null);
        setUploadProgress(null);
    }, []);

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
            const snap = await get(rtdbRef(db, `menu/${segKey}`));
            if (snap.exists()) {
                const existing   = snap.val() as Record<string, { title?: string }>;
                const titleLower = titles.tr.trim().toLowerCase();
                const isDupe     = Object.values(existing).some((v) => v?.title?.toLowerCase() === titleLower);
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
                ...(parsedSalePrice !== null && { salePrice: parsedSalePrice }),
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
    }, [titles, price, salePrice, allergens, ingredients, imageFile, optionItems, segKey, uploadImage, dispatch, resetForm, onClose]);

    const handleClose = useCallback(() => {
        if (!busy) { resetForm(); onClose(); }
    }, [busy, resetForm, onClose]);

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
            title={`${categoryLabel} — Yeni Ürün Ekle`}
            confirmText={busy ? "Kaydediliyor..." : "Ekle"}
            cancelText="İptal"
            busy={busy}
            onClose={handleClose}
            onConfirm={handleSave}
        >
            <ProductFormFields state={formState} handlers={formHandlers} disabled={busy} />
        </ConfirmDialog>
    );
};
