import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    IconButton,
    Skeleton,
    Stack,
    Typography,
} from "@mui/material";
import { db } from "../../firebase/firebase";
import { ref, onValue, update } from "firebase/database";
import { useAuth } from "../../auth/aut.context";
import { ConfirmDialog, PremiumSwitch } from "../../component";
import { getStorage, ref as storageRef, deleteObject } from "firebase/storage";
import { ref as rtdbRef, remove } from "firebase/database";
import { useAppDispatch, addItem, useAppSelector, show as showNotify } from "../../store";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { CustomSegment, useAllergenMap } from "../../utils";
import { useProximityCheck, useTableSession } from "../../hooks";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useLanguage, getLocalizedField } from "../../i18n";
import { ItemEditDialog, type EditableItem } from "./ItemEditDialog";
import { AddProductDialog } from "./AddProductDialog";
import { ManageCategoriesDialog } from "./ManageCategoriesDialog";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

type ItemTranslations = { title?: string; description?: string };

type MenuItem = {
    id: number;
    isAvailable: boolean;
    keyTitle: string;
    title: string;
    type: string;
    price: number;
    image?: string;
    description?: string;
    ingredients?: Record<string, string>;
    allergens?: string[];
    optionsCatalog?: Record<string, unknown>;
    translations?: Record<string, ItemTranslations>;
};

type MenuMap = Record<string, MenuItem>;
type AllMenuData = Record<string, MenuMap>;

type CategoryMeta = {
    labels?: { tr?: string; de?: string; en?: string; ru?: string };
    order?: number;
};

function formatPriceTRY(value: number) {
    return `${new Intl.NumberFormat("tr-TR", {
        style: "decimal",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value)} ₺`;
}

export const Menu = () => {
    const { lang, t } = useLanguage();
    const m = t.menu;
    const allergenMap = useAllergenMap();
    const { isExpired } = useTableSession();
    const isOrder = useAppSelector((s) => s.orderSettings.isOrder);
    const { user } = useAuth();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const functions = useMemo(() => getFunctions(undefined, "europe-west1"), []);

    const { tableId: tableIdFromPath } = useParams<{ tableId: string }>();
    const location = useLocation();

    const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const tableIdFromQuery = useMemo(
        () => queryParams.get("table") || queryParams.get("t") || queryParams.get("masa"),
        [queryParams]
    );
    const qrKey   = useMemo(() => queryParams.get("k"), [queryParams]);
    const tableId = tableIdFromPath || tableIdFromQuery;

    const { status: proximityStatus } = useProximityCheck();

    const [showScrollTop, setShowScrollTop]   = useState(false);
    const [activeSeg, setActiveSeg]           = useState<string>("");
    const [allData, setAllData]               = useState<AllMenuData>({});
    const [menuLoaded, setMenuLoaded]         = useState(false);
    const [error, setError]                   = useState<string | null>(null);
    const [manageCatsOpen, setManageCatsOpen] = useState(false);
    const [catMeta, setCatMeta]               = useState<Record<string, CategoryMeta>>({});

    const [allergenDialogOpen, setAllergenDialogOpen] = useState(false);
    const [selectedAllergen, setSelectedAllergen]     = useState<string>("");

    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editItem, setEditItem]             = useState<EditableItem | null>(null);

    const [addDialogOpen, setAddDialogOpen]       = useState(false);
    const [addSegKey, setAddSegKey]               = useState<string>("");
    const [addCategoryLabel, setAddCategoryLabel] = useState("");

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget]         = useState<{ segKey: string; itemKey: string; title: string; image?: string } | null>(null);
    const [deleteBusy, setDeleteBusy]             = useState(false);

    const sectionRefs      = useRef<Record<string, HTMLDivElement | null>>({});
    const isScrollingToRef = useRef(false);

    const cartItems = useAppSelector((s) => s.cart.items);
    const cartCount = useMemo(() => cartItems.length, [cartItems]);
    const cartTotal = useMemo(
        () => cartItems.reduce((sum, i) => sum + (i.unitPrice ?? 0) * (i.qty ?? 1), 0),
        [cartItems]
    );

    // menu node'unu tek seferde dinle — tüm kategoriler buradan gelir
    useEffect(() => {
        const unsub = onValue(
            ref(db, "menu"),
            (snap) => {
                if (!snap.exists()) { setAllData({}); setMenuLoaded(true); return; }
                const raw = snap.val() as Record<string, Record<string, unknown>>;
                const parsed: AllMenuData = {};
                for (const [key, val] of Object.entries(raw)) {
                    if (val && typeof val === "object") {
                        parsed[key] = val as MenuMap;
                    }
                }
                setAllData(parsed);
                setMenuLoaded(true);
            },
            () => { setError("Menü okunamadı"); setMenuLoaded(true); }
        );
        return () => unsub();
    }, []);

    // menuCategories: label ve sıra bilgisi
    useEffect(() => {
        const unsub = onValue(ref(db, "menuCategoryTranslations"), (snap) => {
            setCatMeta(snap.exists() ? snap.val() : {});
        });
        return () => unsub();
    }, []);

    // Kategoriler: menu node'undaki key'ler, catMeta'dan sıralanmış
    const categories = useMemo(() => {
        const keys = Object.keys(allData);
        return keys
            .map((key) => ({
                key,
                label:
                    catMeta[key]?.labels?.[lang as "tr" | "de" | "en" | "ru"] ||
                    catMeta[key]?.labels?.tr ||
                    key,
                order: catMeta[key]?.order ?? 999,
            }))
            .sort((a, b) => a.order - b.order);
    }, [allData, catMeta, lang]);

    // activeSeg: categories degisince gecersiz kalirsa ilk kategoriye don
    useEffect(() => {
        if (categories.length === 0) return;
        if (!activeSeg || !categories.find((c) => c.key === activeSeg)) {
            setActiveSeg(categories[0]!.key);
        }
    }, [categories]);

    useEffect(() => {
        const handleScroll = () => setShowScrollTop(window.scrollY > 400);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // IntersectionObserver
    useEffect(() => {
        if (!menuLoaded || categories.length === 0) return;
        const observers = categories.map(({ key }) => {
            const el = sectionRefs.current[key];
            if (!el) return null;
            const obs = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting && !isScrollingToRef.current) setActiveSeg(key);
                },
                { rootMargin: "-40% 0px -40% 0px", threshold: 0 }
            );
            obs.observe(el);
            return obs;
        });
        return () => observers.forEach((o) => o?.disconnect());
    }, [menuLoaded, categories]);

    const handleSegmentClick = useCallback((key: string) => {
        const el = sectionRefs.current[key];
        if (!el) return;
        setActiveSeg(key);
        isScrollingToRef.current = true;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => { isScrollingToRef.current = false; }, 900);
    }, []);

    const handleScrollTop = useCallback(() => window.scrollTo({ top: 0, behavior: "smooth" }), []);
    const handleGoToCart  = useCallback(() => { if (cartCount !== 0) navigate("/basket"); }, [cartCount, navigate]);

    useEffect(() => {
        if (!tableId || !qrKey) return;
        let cancelled = false;
        const run = async () => {
            try {
                const existingToken = sessionStorage.getItem(`tableToken:${tableId}`);
                const existingExp   = Number(sessionStorage.getItem(`tableTokenExp:${tableId}`) || 0);
                if (existingToken && existingExp > Date.now()) {
                    window.dispatchEvent(new Event("tableSessionReady"));
                    navigate(`/t/${tableId}`, { replace: true });
                    return;
                }
                if (existingToken && existingExp <= Date.now()) {
                    navigate(`/t/${tableId}`, { replace: true });
                    return;
                }
                sessionStorage.setItem(`tableMinting:${tableId}`, "1");
                window.dispatchEvent(new Event("storage"));
                const mintTableSession = httpsCallable(functions, "mintTableSession");
                const res  = await mintTableSession({ tableId, qrKey });
                const data = res.data as { sessionToken: string; exp: number };
                if (cancelled) return;
                sessionStorage.setItem(`tableToken:${tableId}`, data.sessionToken);
                sessionStorage.setItem(`tableTokenExp:${tableId}`, String(data.exp));
                localStorage.setItem("activeTableId", tableId);
                localStorage.setItem("activeTableId_ts", String(Date.now()));
                sessionStorage.removeItem(`tableMinting:${tableId}`);
                sessionStorage.removeItem("tableSessionExpired");
                window.dispatchEvent(new Event("tableSessionReady"));
                navigate(`/t/${tableId}`, { replace: true });
            } catch (err) {
                if (tableId) sessionStorage.removeItem(`tableMinting:${tableId}`);
                console.error("mintTableSession error:", err);
                dispatch(showNotify({
                    message: "QR oturumu oluşturulamadı. Lütfen bu sayfayi kapatin ve QR kodu tekrar okutun.",
                    severity: "error",
                }));
            }
        };
        void run();
        return () => { cancelled = true; };
    }, [dispatch, functions, navigate, qrKey, tableId]);

    const getSortedList = useCallback((segKey: string) => {
        const data = allData[segKey] ?? {};
        return Object.entries(data)
            .filter(([, v]) => v && typeof v === "object")
            .map(([key, item]) => ({ key, ...(item as MenuItem) }))
            .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", "de"));
    }, [allData]);

    const toggleAvailability = useCallback(async (segKey: string, itemKey: string, next: boolean) => {
        try {
            await update(ref(db, `menu/${segKey}/${itemKey}`), { isAvailable: next });
        } catch {
            setError("Yetki yok: Menü güncellenemedi.");
        }
    }, []);

    const handleOpenEditDialog = useCallback((
        segKey: string,
        item: { key: string; title: string; price: number; image?: string; ingredients?: Record<string, string>; allergens?: string[]; translations?: Record<string, { title?: string; description?: string }> }
    ) => {
        setEditItem({ key: item.key, segKey, title: item.title, price: item.price, image: item.image, ingredients: item.ingredients, allergens: item.allergens, translations: item.translations });
        setEditDialogOpen(true);
    }, []);

    const handleCloseEditDialog = useCallback(() => { setEditDialogOpen(false); setEditItem(null); }, []);

    const handleOpenAddDialog = useCallback((segKey: string, label: string) => {
        setAddSegKey(segKey);
        setAddCategoryLabel(label);
        setAddDialogOpen(true);
    }, []);

    const handleCloseAddDialog = useCallback(() => setAddDialogOpen(false), []);

    const handleOpenDeleteDialog = useCallback((segKey: string, itemKey: string, title: string, image?: string) => {
        setDeleteTarget({ segKey, itemKey, title, image });
        setDeleteDialogOpen(true);
    }, []);

    const handleCloseDeleteDialog = useCallback(() => {
        if (!deleteBusy) { setDeleteDialogOpen(false); setDeleteTarget(null); }
    }, [deleteBusy]);

    const handleConfirmDelete = useCallback(async () => {
        if (!deleteTarget) return;
        setDeleteBusy(true);
        try {
            await remove(rtdbRef(db, `menu/${deleteTarget.segKey}/${deleteTarget.itemKey}`));
            if (deleteTarget.image) {
                try {
                    const storage  = getStorage();
                    const imageRef = storageRef(storage, deleteTarget.image);
                    await deleteObject(imageRef);
                } catch {
                    console.log("ERROR in deleteTarget.image")
                }
            }
            dispatch(showNotify({ message: `"${deleteTarget.title}" silindi.`, severity: "success" }));
            setDeleteDialogOpen(false);
            setDeleteTarget(null);
        } catch {
            dispatch(showNotify({ message: "Silinemedi. Yetki hatasi.", severity: "error" }));
        } finally {
            setDeleteBusy(false);
        }
    }, [deleteTarget, dispatch]);

    const handleAllergenClick = useCallback((code: string) => { setSelectedAllergen(code); setAllergenDialogOpen(true); }, []);
    const handleAllergenClose = useCallback(() => setAllergenDialogOpen(false), []);

    return (
        <Box sx={{ pb: 4 }}>
            <Box
                sx={{
                    position: "sticky", top: 48, zIndex: (t) => t.zIndex.appBar + 1,
                    bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.06)", maxWidth: 1150, mx: "auto",
                    px: { xs: 2, md: 3 }, pt: 0.75, pb: 0.5,
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {/*
                     {user?.isAdmin && (
                        <Box
                            onClick={() => setManageCatsOpen(true)}
                            sx={{
                                width: 28, height: 28, borderRadius: "50%", bgcolor: "#4caf50",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: "pointer", flexShrink: 0, boxShadow: "0 4px 12px rgba(76,175,80,0.4)",
                                transition: "transform 150ms ease, box-shadow 150ms ease",
                                "&:hover": { transform: "scale(1.12)", boxShadow: "0 6px 18px rgba(76,175,80,0.5)" },
                            }}
                        >
                        <Typography sx={{ color: "white", fontWeight: 900, fontSize: 20, lineHeight: 1 }}>+</Typography>
                        </Box>
                    )}
                    */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        {categories.length > 0 && activeSeg && (
                            <CustomSegment value={activeSeg} onChange={handleSegmentClick} items={categories} />
                        )}
                    </Box>
                </Box>
            </Box>

            <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, md: 3 }, pt: 2 }}>
                {!user?.isAdmin && proximityStatus === "checking" && (
                    <Alert severity="info" sx={{ mb: 2 }}>Konum kontrol ediliyor...</Alert>
                )}
                {!user?.isAdmin && proximityStatus === "location_error" && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        Sipariş verebilmek için konum iznine ihtiyaç var. Lütfen tarayıcı ayarlarından konum iznini verin.
                    </Alert>
                )}
                {!user?.isAdmin && proximityStatus === "denied" && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        Sipariş verebilmek için QR kodu okuttuğunuz masada olmanız gerekmektedir!
                    </Alert>
                )}
                {error && <Alert severity="error">Hata: {error}</Alert>}

                {/* Yükleniyor */}
                {!menuLoaded && (
                    <Box sx={{ mt: 2, display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" } }}>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Card key={i} sx={{ borderRadius: 4, overflow: "hidden" }}>
                                <Skeleton variant="rectangular" height={190} />
                                <CardContent>
                                    <Skeleton width="70%" /><Skeleton width="40%" /><Skeleton width="90%" />
                                </CardContent>
                            </Card>
                        ))}
                    </Box>
                )}

                {/* Kategori yok */}
                {menuLoaded && categories.length === 0 && (
                    <Alert severity="info" sx={{ mt: 2 }}>Henüz kategori yok.</Alert>
                )}

                {/* Kategoriler */}
                {menuLoaded && categories.map(({ key, label }) => {
                    const list = getSortedList(key);
                    return (
                        <Box
                            key={key}
                            ref={(el: HTMLDivElement | null) => { sectionRefs.current[key] = el; }}
                            sx={{ mt: 4, scrollMarginTop: "110px" }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, pb: 0.75, borderBottom: "2px solid", borderColor: "divider" }}>
                                <Typography variant="h6" sx={{ fontWeight: 900, fontSize: { xs: 18, md: 20 } }}>
                                    {label}
                                </Typography>
                                {/* {user?.isAdmin && (
                                    <Box
                                        onClick={() => handleOpenAddDialog(key, label)}
                                        sx={{
                                            width: 30, height: 30, borderRadius: "50%", bgcolor: "#FF7A00",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            cursor: "pointer", flexShrink: 0, boxShadow: "0 4px 12px rgba(255,122,0,0.4)",
                                            transition: "transform 150ms ease, box-shadow 150ms ease",
                                            "&:hover": { transform: "scale(1.12)", boxShadow: "0 6px 18px rgba(255,122,0,0.5)" },
                                        }}
                                    >
                                        <Typography sx={{ color: "white", fontWeight: 900, fontSize: 20, lineHeight: 1 }}>+</Typography>
                                    </Box>
                                )}
                              */}
                            </Box>

                            {list.length === 0 && <Alert severity="info">{m.noItems}</Alert>}

                            {list.length > 0 && (
                                <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" } }}>
                                    {list.map((item) => {
                                        const localTitle = getLocalizedField(item, "title", lang) || item.title;
                                        const localIngredients = item.ingredients?.[lang] || item.ingredients?.tr || null;
                                        return (
                                            <Card
                                                key={item.key}
                                                sx={{
                                                    borderRadius: 4, overflow: "hidden", position: "relative",
                                                    border: "1px solid", borderColor: "divider",
                                                    background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.02))",
                                                    transition: "transform 140ms ease, box-shadow 140ms ease",
                                                    "&:hover": { transform: "translateY(-3px)", boxShadow: "0 18px 60px rgba(0,0,0,0.12)" },
                                                }}
                                            >
                                                <Box sx={{ position: "relative", height: 200, bgcolor: "action.hover" }}>
                                                    <Box
                                                        component="img" src={item.image || undefined} alt={localTitle} loading="lazy"
                                                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = ""; }}
                                                        sx={{ width: "100%", height: "100%", objectFit: "cover", display: item.image ? "block" : "none" }}
                                                    />
                                                    {!item.image && (
                                                        <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "text.secondary", fontWeight: 800, fontSize: 13 }}>
                                                            {m.noImage}
                                                        </Box>
                                                    )}
                                                    {!item.isAvailable && (
                                                        <Box sx={{ position: "absolute", left: 12, top: 12, px: 1.05, py: 0.55, borderRadius: 999, bgcolor: "rgba(229,57,53,0.92)", color: "white", fontWeight: 900, fontSize: 12 }}>
                                                            {m.outOfStock}
                                                        </Box>
                                                    )}
                                                    <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.00) 40%, rgba(0,0,0,0.22) 100%)", pointerEvents: "none" }} />
                                                </Box>

                                                <CardContent sx={{ display: "grid", gap: 1.1 }}>
                                                    <Box sx={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 1 }}>
                                                        <Typography sx={{ fontWeight: 950, lineHeight: 1.15, fontSize: 16 }}>{localTitle}</Typography>
                                                        <Box sx={{ px: 1.2, py: 0.6, borderRadius: 999, bgcolor: "rgba(17,24,39,0.80)", color: "white", fontWeight: 900, fontSize: 15, letterSpacing: 0.2, backdropFilter: "blur(10px)", whiteSpace: "nowrap" }}>
                                                            {formatPriceTRY(item.price)}
                                                        </Box>
                                                    </Box>

                                                    {user?.isAdmin && (
                                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                            <Box sx={{ display: "flex", gap: 0.5 }}>
                                                                <IconButton size="small" onClick={() => handleOpenEditDialog(key, { key: item.key, title: item.title, price: item.price, image: item.image, ingredients: item.ingredients, allergens: item.allergens, translations: item.translations })} sx={{ color: "#FF7A00" }}>
                                                                    <EditIcon fontSize="small" />
                                                                </IconButton>
                                                                <IconButton size="small" onClick={() => handleOpenDeleteDialog(key, item.key, item.title, item.image)} sx={{ color: "error.main" }}>
                                                                    <DeleteOutlineIcon fontSize="small" />
                                                                </IconButton>
                                                            </Box>
                                                            <PremiumSwitch
                                                                size="small"
                                                                checked={item.isAvailable}
                                                                onChange={(e) => {
                                                                    const checked = e.target.checked;
                                                                    toggleAvailability(key, item.key, checked);
                                                                    dispatch(showNotify({ message: `${localTitle} ${checked ? "mevcut" : "tükendi"}`, severity: checked ? "success" : "error" }));
                                                                }}
                                                            />
                                                        </Box>
                                                    )}

                                                    <Box sx={{ display: "flex", flexDirection: "column", mt: 0.5, gap: 1 }}>
                                                        {localIngredients && (
                                                            <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.5 }}>
                                                                <Box component="span" sx={{ fontWeight: 700 }}><span>{m.ingredients}:</span></Box>
                                                                {localIngredients}
                                                            </Typography>
                                                        )}

                                                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ alignItems: "center" }}>
                                                            <span>{m.allergyInfo}:</span>
                                                            {item.allergens?.length ? (
                                                                item.allergens.map((a) => (
                                                                    <Chip key={a} size="small" label={allergenMap[a] ?? a} variant="outlined" clickable onClick={() => handleAllergenClick(a)} sx={{ borderRadius: 999, fontWeight: 600, fontSize: 12, maxWidth: "100%", cursor: "pointer" }} />
                                                                ))
                                                            ) : (
                                                                <Chip size="small" label={m.noAllergen} variant="outlined" sx={{ borderRadius: 999, opacity: 0.6 }} />
                                                            )}
                                                        </Stack>

                                                        <Button
                                                            fullWidth size="small" variant="contained" disableElevation
                                                            disabled={!item.isAvailable || isExpired || !isOrder}
                                                            onClick={() => {
                                                                dispatch(addItem({ productId: String(item.id), title: item.title, unitPrice: item.price, image: item.image ?? "", optionsCatalog: item.optionsCatalog ?? undefined }));
                                                                dispatch(showNotify({ message: m.addedToCart(localTitle), severity: "success" }));
                                                            }}
                                                            sx={{
                                                                borderRadius: 999, textTransform: "none", fontWeight: 900, py: 0.85, lineHeight: 1,
                                                                bgcolor: "rgba(17,24,39,0.92)", color: "white",
                                                                boxShadow: "0 10px 30px rgba(0,0,0,0.20)", backdropFilter: "blur(10px)",
                                                                border: "1px solid rgba(255,255,255,0.18)",
                                                                "&:hover": { bgcolor: "rgba(17,24,39,1)", boxShadow: "0 14px 40px rgba(0,0,0,0.28)", transform: "translateY(-1px)" },
                                                                "&:active": { transform: "translateY(0px)", boxShadow: "0 10px 26px rgba(0,0,0,0.22)" },
                                                                "&.Mui-disabled": { bgcolor: "rgba(17,24,39,0.25)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.10)" },
                                                            }}
                                                        >
                                                            <Box component="span" sx={{ display: "inline-grid", placeItems: "center", width: 22, height: 22, mr: 0.9, borderRadius: 999, bgcolor: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.18)", fontSize: 16, fontWeight: 900 }}>+</Box>
                                                            {m.addToCart}
                                                        </Button>
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </Box>
                            )}
                        </Box>
                    );
                })}
            </Box>

            {cartCount >= 0 && (
                <Box sx={{ position: "fixed", bottom: 16, left: 0, right: 0, zIndex: 2000, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
                    <Box sx={{ pointerEvents: "auto", width: "100%", maxWidth: 720, mx: 2, borderRadius: 999, px: 2, py: 0.1, display: "flex", alignItems: "center", justifyContent: "space-between", bgcolor: "rgba(17,24,39,0.92)", backdropFilter: "blur(18px)", color: "white", boxShadow: "0 18px 50px rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.12)" }}>
                        <Box>
                            <Typography sx={{ fontWeight: 900, fontSize: 14 }}>{m.cartCount(cartCount)}</Typography>
                            <Typography sx={{ fontSize: 13, opacity: 0.85 }}>{formatPriceTRY(cartTotal)}</Typography>
                        </Box>
                        <Button
                            variant="contained" disabled={!isOrder || cartCount === 0}
                            sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900, px: 3, py: 1, bgcolor: "#FF7A00", boxShadow: "0 10px 30px rgba(255,122,0,0.4)", "&:hover": { bgcolor: "#ff8c1a" }, "&.Mui-disabled": { bgcolor: "rgba(255,122,0,0.35)", color: "rgba(255,255,255,0.9)", boxShadow: "none", opacity: 1, cursor: "not-allowed" } }}
                            onClick={handleGoToCart}
                        >
                            {m.goToCart}
                        </Button>
                    </Box>
                </Box>
            )}

            {showScrollTop && (
                <IconButton onClick={handleScrollTop} sx={{ position: "fixed", bottom: 80, right: 20, zIndex: 2100, bgcolor: "rgba(255,122,0,0.88)", backdropFilter: "blur(12px)", color: "white", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 8px 24px rgba(0,0,0,0.3)", "&:hover": { bgcolor: "rgba(255,122,0,1)" } }}>
                    <KeyboardArrowUpIcon />
                </IconButton>
            )}

            <ConfirmDialog open={deleteDialogOpen} title="Ürünü Sil" description={deleteTarget ? `"${deleteTarget.title}" ürününü silmek istediginizden emin misiniz? Bu islem geri alinamaz.` : ""} confirmText={deleteBusy ? "Siliniyor..." : "Evet, Sil"} cancelText="Vazgeç" busy={deleteBusy} onClose={handleCloseDeleteDialog} onConfirm={handleConfirmDelete} />
            <ManageCategoriesDialog open={manageCatsOpen} onClose={() => setManageCatsOpen(false)} onSaved={() => {}} />
            <AddProductDialog open={addDialogOpen} segKey={addSegKey} categoryLabel={addCategoryLabel} onClose={handleCloseAddDialog} />
            <ItemEditDialog open={editDialogOpen} item={editItem} onClose={handleCloseEditDialog} />
            <ConfirmDialog open={allergenDialogOpen} title={`Alerji Bilgisi: ${allergenMap[selectedAllergen] ?? selectedAllergen}`} description={allergenMap[selectedAllergen] || "Bu alerji için açıklama bulunamadı."} confirmText="Kapat" cancelText="" onClose={handleAllergenClose} onConfirm={handleAllergenClose} />
        </Box>
    );
};
