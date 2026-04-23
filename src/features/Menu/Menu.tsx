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
    TextField,
    Typography,
} from "@mui/material";
import { db } from "../../firebase/firebase";
import { ref, onValue, update } from "firebase/database";
import { useAuth } from "../../auth/aut.context";
import { ConfirmDialog, PremiumSwitch, Loading } from "../../component";
import { useAppDispatch, addItem, useAppSelector, show as showNotify } from "../../store";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { CustomSegment, useAllergenMap } from "../../utils";
import { useProximityCheck, useTableSession } from "../../hooks";
import EditIcon from "@mui/icons-material/Edit";
import { useLanguage, getLocalizedField } from "../../i18n";

type SegKey =
    | "corbalar"
    | "lahmacun"
    | "pide"
    | "tatlilar"
    | "icecekler";

type ItemTranslations = {
    title?: string;
    description?: string;
};

type MenuItem = {
    id: number;
    isAvailable: boolean;
    keyTitle: string;
    title: string;
    type: string;
    price: number;
    image?: string;
    description?: string;
    allergens?: string[];
    optionsCatalog?: Record<string, unknown>;
    translations?: Record<string, ItemTranslations>;
};

type MenuMap = Record<string, MenuItem>;
type AllMenuData = Partial<Record<SegKey, MenuMap>>;

const INITIAL_LOAD_COUNT = 3;
// İlk yüklemede skeleton göstermek için bekleme süresi (ms)
// Bu süreden uzun sürerse Loading spinner devreye girer
const LOADING_DELAY_MS = 600;

function formatPriceTRY(value: number) {
    const formatted = new Intl.NumberFormat("tr-TR", {
        style: "decimal",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
    return `${formatted} ₺`;
}

export const Menu = () => {
    const { lang, t } = useLanguage();
    const m = t.menu;
    const allergenMap = useAllergenMap();
    const { isExpired } = useTableSession();
    const isOrder = useAppSelector((s) => s.orderSettings.isOrder);

    const items = useMemo(
        () => [
            { key: "corbalar", label: m.categories.corbalar },
            { key: "lahmacun", label: m.categories.lahmacun },
            { key: "pide", label: m.categories.pide },
            { key: "tatlilar", label: m.categories.tatlilar },
            { key: "icecekler", label: m.categories.icecekler },
        ],
        [m]
    );

    const { user } = useAuth();
    console.log("user", user);
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const functions = getFunctions(undefined, "europe-west1");

    const [priceDialogOpen, setPriceDialogOpen] = useState(false);
    const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
    const [selectedItemSeg, setSelectedItemSeg] = useState<SegKey | null>(null);
    const [newPrice, setNewPrice] = useState("");
    const [priceError, setPriceError] = useState("");
    const [priceUpdating, setPriceUpdating] = useState(false);

    const [activeSeg, setActiveSeg] = useState<SegKey>("corbalar");

    const [allData, setAllData] = useState<AllMenuData>({});
    const [loadedKeys, setLoadedKeys] = useState<Set<SegKey>>(new Set());
    const [error, setError] = useState<string | null>(null);

    const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD_COUNT);

    // İlk yükleme gecikmesi — LOADING_DELAY_MS sonra hâlâ veri gelmediyse
    // tam ekran Loading göster
    const [showInitialLoading, setShowInitialLoading] = useState(false);
    // Yeni kategori yüklenirken (lazy load) alt kısımda Loading göster
    const [pendingKeys, setPendingKeys] = useState<Set<SegKey>>(new Set());

    const [allergenDialogOpen, setAllergenDialogOpen] = useState(false);
    const [selectedAllergen, setSelectedAllergen] = useState<string>("");
    const cartItems = useAppSelector((s) => s.cart.items);

    const { tableId: tableIdFromPath } = useParams<{ tableId: string }>();
    const location = useLocation();
    const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

    const tableIdFromQuery = useMemo(
        () => queryParams.get("table") || queryParams.get("t") || queryParams.get("masa"),
        [queryParams]
    );
    const qrKey = useMemo(() => queryParams.get("k"), [queryParams]);
    const tableId = tableIdFromPath || tableIdFromQuery;
    const { status: proximityStatus, distance } = useProximityCheck();
    console.log("distance", distance);

    const sectionRefs = useRef<Partial<Record<SegKey, HTMLDivElement | null>>>({});
    const isScrollingToRef = useRef(false);

    const visibleItems = useMemo(
        () => items.slice(0, visibleCount),
        [items, visibleCount]
    );

    // İlk yükleme gecikme timer'ı
    useEffect(() => {
        const timer = setTimeout(() => {
            if (loadedKeys.size === 0) setShowInitialLoading(true);
        }, LOADING_DELAY_MS);
        return () => clearTimeout(timer);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // İlk veri gelince Loading'i kapat
    useEffect(() => {
        if (loadedKeys.size > 0) setShowInitialLoading(false);
    }, [loadedKeys.size]);

    // ── Firebase: visibleCount değişince yeni kategoriyi çek ──────────────
    useEffect(() => {
        const keysToLoad = items.slice(0, visibleCount).map((i) => i.key as SegKey);
        const unsubs: (() => void)[] = [];

        keysToLoad.forEach((key) => {
            if (loadedKeys.has(key)) return;

            // Bu key için pending durumunu işaretle
            setPendingKeys((prev) => new Set(prev).add(key));

            const r = ref(db, `menu/${key}`);
            const unsub = onValue(
                r,
                (snap) => {
                    const val = (snap.exists() ? snap.val() : null) as MenuMap | null;
                    setAllData((prev) => ({ ...prev, [key]: val ?? {} }));
                    setLoadedKeys((prev) => new Set(prev).add(key));
                    setPendingKeys((prev) => {
                        const next = new Set(prev);
                        next.delete(key);
                        return next;
                    });
                },
                () => {
                    setError("Menü okunamadı");
                    setLoadedKeys((prev) => new Set(prev).add(key));
                    setPendingKeys((prev) => {
                        const next = new Set(prev);
                        next.delete(key);
                        return next;
                    });
                }
            );
            unsubs.push(unsub);
        });

        return () => unsubs.forEach((u) => u());
    }, [visibleCount]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── IntersectionObserver ──────────────────────────────────────────────
    useEffect(() => {
        const observers: IntersectionObserver[] = [];

        visibleItems.forEach(({ key }, index) => {
            const el = sectionRefs.current[key as SegKey];
            if (!el) return;

            const obs = new IntersectionObserver(
                ([entry]) => {
                    if (!entry.isIntersecting) return;

                    if (!isScrollingToRef.current) {
                        setActiveSeg(key as SegKey);
                    }

                    const isSecondToLast = index === visibleItems.length - 2;
                    const hasMore = visibleCount < items.length;
                    if (isSecondToLast && hasMore) {
                        setVisibleCount((prev) => Math.min(prev + 1, items.length));
                    }
                },
                { rootMargin: "-40% 0px -40% 0px", threshold: 0 }
            );
            obs.observe(el);
            observers.push(obs);
        });

        return () => observers.forEach((o) => o.disconnect());
    }, [visibleItems, visibleCount, items.length]);

    // ── Segment tıklanınca scroll ─────────────────────────────────────────
    const handleSegmentClick = useCallback((key: string) => {
        const segKey = key as SegKey;
        const targetIndex = items.findIndex((i) => i.key === key);

        if (targetIndex >= visibleCount) {
            setVisibleCount(targetIndex + 1);
            setTimeout(() => {
                sectionRefs.current[segKey]?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 150);
        } else {
            sectionRefs.current[segKey]?.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        setActiveSeg(segKey);
        isScrollingToRef.current = true;
        setTimeout(() => { isScrollingToRef.current = false; }, 900);
    }, [items, visibleCount]);

    // ── QR / mintTableSession ─────────────────────────────────────────────
    useEffect(() => {
        if (!tableId || !qrKey) return;
        let cancelled = false;

        const run = async () => {
            console.log("tableId:", tableId, "qrKey:", qrKey);
            try {
                const existingToken = sessionStorage.getItem(`tableToken:${tableId}`);
                const existingExp = Number(sessionStorage.getItem(`tableTokenExp:${tableId}`) || 0);

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
                const res = await mintTableSession({ tableId, qrKey });
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
                dispatch(
                    showNotify({
                        message: "QR oturumu oluşturulamadı. Lütfen bu sayfayi kapatin ve QR kodu tekrar okutun.",
                        severity: "error",
                    })
                );
            }
        };

        void run();
        return () => { cancelled = true; };
    }, [dispatch, functions, navigate, qrKey, tableId]);

    const cartCount = cartItems.length;
    const cartTotal = cartItems.reduce(
        (sum, item) => sum + (item.unitPrice ?? 0) * (item.qty ?? 1),
        0
    );

    // ── Helpers ──────────────────────────────────────────────────────────
    const getSortedList = (segKey: SegKey) => {
        const data = allData[segKey] ?? {};
        return Object.entries(data)
            .filter(([, v]) => v && typeof v === "object")
            .map(([key, item]) => ({ key, ...(item as MenuItem) }))
            .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", "de"));
    };

    const toggleAvailability = async (segKey: SegKey, itemKey: string, next: boolean) => {
        try {
            await update(ref(db, `menu/${segKey}/${itemKey}`), { isAvailable: next });
        } catch {
            setError("Yetki yok: Menü güncellenemedi (rules reddetti).");
        }
    };

    const handleOpenPriceDialog = (segKey: SegKey, itemKey: string, currentPrice: number) => {
        setSelectedItemSeg(segKey);
        setSelectedItemKey(itemKey);
        setNewPrice(String(currentPrice));
        setPriceError("");
        setPriceDialogOpen(true);
    };

    const handleClosePriceDialog = () => {
        setPriceDialogOpen(false);
        setSelectedItemKey(null);
        setSelectedItemSeg(null);
        setNewPrice("");
        setPriceError("");
    };

    const handlePriceUpdate = async () => {
        const parsed = Number(newPrice);
        if (!newPrice || isNaN(parsed) || parsed <= 0) {
            setPriceError("Geçerli bir fiyat girin.");
            return;
        }
        if (!selectedItemKey || !selectedItemSeg) return;
        setPriceUpdating(true);
        try {
            await update(ref(db, `menu/${selectedItemSeg}/${selectedItemKey}`), { price: parsed });
            dispatch(showNotify({ message: "Fiyat güncellendi.", severity: "success" }));
            handleClosePriceDialog();
        } catch {
            setPriceError("Fiyat güncellenemedi. Yetki hatası.");
        } finally {
            setPriceUpdating(false);
        }
    };

    const handleAllergenClick = (code: string) => {
        setSelectedAllergen(code);
        setAllergenDialogOpen(true);
    };

    // ── Render ───────────────────────────────────────────────────────────
    return (
        <Box sx={{ pb: 4 }}>
            {/* İlk yükleme gecikmesi — tam ekran Loading */}
            {showInitialLoading && <Loading fullScreen message="Menü yükleniyor..." />}

            {/* Sticky segment bar */}
            <Box
                sx={{
                    position: "sticky",
                    top: 48,
                    zIndex: (t) => t.zIndex.appBar + 1,
                    bgcolor: "background.paper",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                    maxWidth: 1150,
                    mx: "auto",
                    px: { xs: 2, md: 3 },
                    pt: 0.75,
                    pb: 0.5,
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <CustomSegment
                            value={activeSeg}
                            onChange={handleSegmentClick}
                            items={items}
                        />
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

                {/* İlk yükleme skeleton'ı (gecikme yoksa göster, Loading devreye girmeden önce) */}
                {loadedKeys.size === 0 && !showInitialLoading && (
                    <Box
                        sx={{
                            mt: 2,
                            display: "grid",
                            gap: 2,
                            gridTemplateColumns: {
                                xs: "1fr",
                                sm: "repeat(2, minmax(0, 1fr))",
                                lg: "repeat(3, minmax(0, 1fr))",
                                xl: "repeat(4, minmax(0, 1fr))",
                            },
                        }}
                    >
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Card key={i} sx={{ borderRadius: 4, overflow: "hidden" }}>
                                <Skeleton variant="rectangular" height={190} />
                                <CardContent>
                                    <Skeleton width="70%" />
                                    <Skeleton width="40%" />
                                    <Skeleton width="90%" />
                                </CardContent>
                            </Card>
                        ))}
                    </Box>
                )}

                {/* Render edilen kategoriler */}
                {visibleItems.map(({ key, label }) => {
                    const segKey = key as SegKey;
                    const loaded = loadedKeys.has(segKey);
                    const isPending = pendingKeys.has(segKey);
                    const list = loaded ? getSortedList(segKey) : [];

                    return (
                        <Box
                            key={segKey}
                            ref={(el: HTMLDivElement | null) => { sectionRefs.current[segKey] = el; }}
                            sx={{ mt: 4, scrollMarginTop: "110px" }}
                        >
                            <Typography
                                variant="h6"
                                sx={{
                                    fontWeight: 900,
                                    fontSize: { xs: 18, md: 20 },
                                    mb: 1.5,
                                    pb: 0.75,
                                    borderBottom: "2px solid",
                                    borderColor: "divider",
                                }}
                            >
                                {label}
                            </Typography>

                            {/* Yükleniyor — gecikme varsa Loading, yoksa Skeleton */}
                            {isPending && (
                                <Loading message={`${label} yükleniyor...`} minHeight={160} />
                            )}

                            {!loaded && !isPending && (
                                <Box
                                    sx={{
                                        display: "grid",
                                        gap: 2,
                                        gridTemplateColumns: {
                                            xs: "1fr",
                                            sm: "repeat(2, minmax(0, 1fr))",
                                            lg: "repeat(3, minmax(0, 1fr))",
                                            xl: "repeat(4, minmax(0, 1fr))",
                                        },
                                    }}
                                >
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <Card key={i} sx={{ borderRadius: 4, overflow: "hidden" }}>
                                            <Skeleton variant="rectangular" height={190} />
                                            <CardContent>
                                                <Skeleton width="70%" />
                                                <Skeleton width="40%" />
                                                <Skeleton width="90%" />
                                            </CardContent>
                                        </Card>
                                    ))}
                                </Box>
                            )}

                            {loaded && list.length === 0 && (
                                <Alert severity="info">{m.noItems}</Alert>
                            )}

                            {loaded && list.length > 0 && (
                                <Box
                                    sx={{
                                        display: "grid",
                                        gap: 2,
                                        gridTemplateColumns: {
                                            xs: "1fr",
                                            sm: "repeat(2, minmax(0, 1fr))",
                                            lg: "repeat(3, minmax(0, 1fr))",
                                            xl: "repeat(4, minmax(0, 1fr))",
                                        },
                                    }}
                                >
                                    {list.map((item) => {
                                        const localTitle = getLocalizedField(item, "title", lang) || item.title;

                                        return (
                                            <Card
                                                key={item.key}
                                                sx={{
                                                    borderRadius: 4,
                                                    overflow: "hidden",
                                                    position: "relative",
                                                    border: "1px solid",
                                                    borderColor: "divider",
                                                    background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.02))",
                                                    transition: "transform 140ms ease, box-shadow 140ms ease",
                                                    "&:hover": {
                                                        transform: "translateY(-3px)",
                                                        boxShadow: "0 18px 60px rgba(0,0,0,0.12)",
                                                    },
                                                }}
                                            >
                                                <Box sx={{ position: "relative", height: 200, bgcolor: "action.hover" }}>
                                                    <Box
                                                        component="img"
                                                        src={item.image || ""}
                                                        alt={localTitle}
                                                        loading="lazy"
                                                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = ""; }}
                                                        sx={{
                                                            width: "100%",
                                                            height: "100%",
                                                            objectFit: "cover",
                                                            display: item.image ? "block" : "none",
                                                        }}
                                                    />
                                                    {!item.image && (
                                                        <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "text.secondary", fontWeight: 800, fontSize: 13 }}>
                                                            {m.noImage}
                                                        </Box>
                                                    )}
                                                    {!item.isAvailable && (
                                                        <Box sx={{ position: "absolute", left: 12, top: 12, px: 1.05, py: 0.55, borderRadius: 999, bgcolor: "rgba(229, 57, 53, 0.92)", color: "white", fontWeight: 900, fontSize: 12 }}>
                                                            {m.outOfStock}
                                                        </Box>
                                                    )}
                                                    <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.00) 40%, rgba(0,0,0,0.22) 100%)", pointerEvents: "none" }} />
                                                </Box>

                                                <CardContent sx={{ display: "grid", gap: 1.1 }}>
                                                    <Box sx={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 1 }}>
                                                        <Typography sx={{ fontWeight: 950, lineHeight: 1.15, fontSize: 16 }}>
                                                            {localTitle}
                                                        </Typography>
                                                        <Box sx={{ px: 1.2, py: 0.6, borderRadius: 999, bgcolor: "rgba(17, 24, 39, 0.80)", color: "white", fontWeight: 900, fontSize: 15, letterSpacing: 0.2, backdropFilter: "blur(10px)", whiteSpace: "nowrap" }}>
                                                            {formatPriceTRY(item.price)}
                                                        </Box>
                                                    </Box>

                                                    {user?.isAdmin && (
                                                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                            <IconButton size="small" onClick={() => handleOpenPriceDialog(segKey, item.key, item.price)} sx={{ color: "#FF7A00" }}>
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                            <PremiumSwitch
                                                                size="small"
                                                                checked={item.isAvailable}
                                                                onChange={(e) => {
                                                                    const checked = e.target.checked;
                                                                    toggleAvailability(segKey, item.key, checked);
                                                                    dispatch(showNotify({
                                                                        message: `${localTitle} ${checked ? "mevcut" : "tükendi"}`,
                                                                        severity: checked ? "success" : "error",
                                                                    }));
                                                                }}
                                                            />
                                                        </Box>
                                                    )}

                                                    <Box sx={{ display: "flex", flexDirection: "column", mt: 0.5, gap: 1 }}>
                                                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ alignItems: "center" }}>
                                                            <span>{m.allergyInfo}:</span>
                                                            {item.allergens?.length ? (
                                                                item.allergens.map((a) => (
                                                                    <Chip
                                                                        key={a}
                                                                        size="small"
                                                                        label={allergenMap[a] ?? a}
                                                                        variant="outlined"
                                                                        clickable
                                                                        onClick={() => handleAllergenClick(a)}
                                                                        sx={{ borderRadius: 999, fontWeight: 600, fontSize: 12, maxWidth: "100%", cursor: "pointer" }}
                                                                    />
                                                                ))
                                                            ) : (
                                                                <Chip size="small" label={m.noAllergen} variant="outlined" sx={{ borderRadius: 999, opacity: 0.6 }} />
                                                            )}
                                                        </Stack>

                                                        <Button
                                                            fullWidth
                                                            size="small"
                                                            variant="contained"
                                                            disableElevation
                                                            disabled={!item.isAvailable || isExpired || !isOrder}
                                                            onClick={() => {
                                                                dispatch(addItem({
                                                                    productId: String(item.id),
                                                                    title: item.title,
                                                                    unitPrice: item.price,
                                                                    image: item.image ?? "",
                                                                }));
                                                                dispatch(showNotify({
                                                                    message: m.addedToCart(localTitle),
                                                                    severity: "success",
                                                                }));
                                                            }}
                                                            sx={{
                                                                borderRadius: 999,
                                                                textTransform: "none",
                                                                fontWeight: 900,
                                                                py: 0.85,
                                                                lineHeight: 1,
                                                                bgcolor: "rgba(17, 24, 39, 0.92)",
                                                                color: "white",
                                                                boxShadow: "0 10px 30px rgba(0,0,0,0.20)",
                                                                backdropFilter: "blur(10px)",
                                                                border: "1px solid rgba(255,255,255,0.18)",
                                                                "&:hover": { bgcolor: "rgba(17, 24, 39, 1)", boxShadow: "0 14px 40px rgba(0,0,0,0.28)", transform: "translateY(-1px)" },
                                                                "&:active": { transform: "translateY(0px)", boxShadow: "0 10px 26px rgba(0,0,0,0.22)" },
                                                                "&.Mui-disabled": { bgcolor: "rgba(17, 24, 39, 0.25)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.10)" },
                                                            }}
                                                        >
                                                            <Box component="span" sx={{ display: "inline-grid", placeItems: "center", width: 22, height: 22, mr: 0.9, borderRadius: 999, bgcolor: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.18)", fontSize: 16, fontWeight: 900 }}>
                                                                +
                                                            </Box>
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

            {/* Sepet floating bar */}
            {cartCount >= 0 && (
                <Box sx={{ position: "fixed", bottom: 16, left: 0, right: 0, zIndex: 2000, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
                    <Box sx={{ pointerEvents: "auto", width: "100%", maxWidth: 720, mx: 2, borderRadius: 999, px: 2, py: 0.1, display: "flex", alignItems: "center", justifyContent: "space-between", bgcolor: "rgba(17,24,39,0.92)", backdropFilter: "blur(18px)", color: "white", boxShadow: "0 18px 50px rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.12)" }}>
                        <Box>
                            <Typography sx={{ fontWeight: 900, fontSize: 14 }}>{m.cartCount(cartCount)}</Typography>
                            <Typography sx={{ fontSize: 13, opacity: 0.85 }}>{formatPriceTRY(cartTotal)}</Typography>
                        </Box>
                        <Button
                            variant="contained"
                            disabled={!isOrder || cartCount === 0}
                            sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900, px: 3, py: 1, bgcolor: "#FF7A00", boxShadow: "0 10px 30px rgba(255,122,0,0.4)", "&:hover": { bgcolor: "#ff8c1a" }, "&.Mui-disabled": { bgcolor: "rgba(255,122,0,0.35)", color: "rgba(255,255,255,0.9)", boxShadow: "none", opacity: 1, cursor: "not-allowed" } }}
                            onClick={() => cartCount !== 0 && navigate("/basket")}
                        >
                            {m.goToCart}
                        </Button>
                    </Box>
                </Box>
            )}

            {/* Fiyat güncelle dialog */}
            <ConfirmDialog
                open={priceDialogOpen}
                title="Fiyatı Güncelle"
                confirmText="Kaydet"
                cancelText="İptal"
                onClose={handleClosePriceDialog}
                onConfirm={handlePriceUpdate}
                busy={priceUpdating}
            >
                <TextField
                    autoFocus
                    fullWidth
                    label="Yeni Fiyat (₺)"
                    value={newPrice}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d*$/.test(val)) { setNewPrice(val); setPriceError(""); }
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") handlePriceUpdate(); }}
                    inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                    error={!!priceError}
                    helperText={priceError}
                    sx={{ mt: 1 }}
                />
            </ConfirmDialog>

            {/* Alerjen bilgi dialog */}
            <ConfirmDialog
                open={allergenDialogOpen}
                title={`Alerji Bilgisi: ${allergenMap[selectedAllergen] ?? selectedAllergen}`}
                description={allergenMap[selectedAllergen] || "Bu alerji için açıklama bulunamadı."}
                confirmText="Kapat"
                cancelText=""
                onClose={() => setAllergenDialogOpen(false)}
                onConfirm={() => setAllergenDialogOpen(false)}
            />
        </Box>
    );
};