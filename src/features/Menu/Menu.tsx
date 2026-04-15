import { useEffect, useMemo, useState } from "react";
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
import { ConfirmDialog, PremiumSwitch } from "../../component";
import { useAppDispatch, addItem, useAppSelector, show as showNotify } from "../../store";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";
import { CustomSegment, useAllergenMap } from "../../utils";
import {useProximityCheck, useTableSession} from "../../hooks";
import EditIcon from "@mui/icons-material/Edit";
import { useLanguage, getLocalizedField } from "../../i18n";

type SegKey =
    | "corbalar"
    | "baslangiclar"
    | "izgaralar"
    | "balik"
    | "lahmacun"
    | "pide"
    | "salatalar"
    | "kahvalti"
    | "hamburger"
    | "makarna"
    | "tatlilar"
    | "sutlu_tatlilar"
    | "serbetli_tatlilar"
    | "pasta"
    | "dondurma"
    | "icecekler"
    | "meyve_sulari"
    | "caylar"
    | "sicak_icecekler"
    | "vegan"
    | "vejetaryen"
    | "diyet"
    | "alkollu_icecekler";

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

function formatPriceTRY(value: number) {
    const formatted = new Intl.NumberFormat("tr-TR", { style: "decimal", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
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
            { key: "baslangiclar", label: m.categories.baslangiclar },
            { key: "izgaralar", label: m.categories.izgaralar },
            { key: "balik", label: m.categories.balik },
            { key: "lahmacun", label: m.categories.lahmacun },
            { key: "pide", label: m.categories.pide },
            { key: "vegan", label: m.categories.vegan },
            { key: "vejetaryen", label: m.categories.vejetaryen },
            { key: "diyet", label: m.categories.diyet },
            { key: "alkollu_icecekler", label: m.categories.alkollu_icecekler },
            { key: "salatalar", label: m.categories.salatalar },
            { key: "kahvalti", label: m.categories.kahvalti },
            { key: "hamburger", label: m.categories.hamburger },
            { key: "makarna", label: m.categories.makarna },
            { key: "tatlilar", label: m.categories.tatlilar },
            { key: "sutlu_tatlilar", label: m.categories.sutlu_tatlilar },
            { key: "serbetli_tatlilar", label: m.categories.serbetli_tatlilar },
            { key: "pasta", label: m.categories.pasta },
            { key: "dondurma", label: m.categories.dondurma },
            { key: "icecekler", label: m.categories.icecekler },
            { key: "meyve_sulari", label: m.categories.meyve_sulari },
            { key: "caylar", label: m.categories.caylar },
            { key: "sicak_icecekler", label: m.categories.sicak_icecekler },
        ],
        [m]
    );

    const { user } = useAuth();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const functions = getFunctions(undefined, "europe-west1");

    const [priceDialogOpen, setPriceDialogOpen] = useState(false);
    const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
    const [newPrice, setNewPrice] = useState("");
    const [priceError, setPriceError] = useState("");
    const [priceUpdating, setPriceUpdating] = useState(false);

    const [seg, setSeg] = useState<SegKey>("corbalar");
    const [data, setData] = useState<MenuMap | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [allergenDialogOpen, setAllergenDialogOpen] = useState(false);
    const [selectedAllergen, setSelectedAllergen] = useState<string>("");
    const cartItems = useAppSelector((s) => s.cart.items);

    const { tableId: tableIdFromPath } = useParams<{ tableId: string }>();
    const location = useLocation();

    const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

    const tableIdFromQuery = useMemo(() => {
        return queryParams.get("table") || queryParams.get("t") || queryParams.get("masa");
    }, [queryParams]);

    const qrKey = useMemo(() => queryParams.get("k"), [queryParams]);
    const tableId = tableIdFromPath || tableIdFromQuery;
    const { status: proximityStatus, distance } = useProximityCheck();
    const isProximityOk = user?.isAdmin || proximityStatus === "allowed";
    console.log("distance", distance);

    useEffect(() => {
        if (!tableId || !qrKey) return;

        let cancelled = false;

        const run = async () => {
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

                // Yeni QR okutulunca expired flag'i temizle
                sessionStorage.removeItem("tableSessionExpired");

                window.dispatchEvent(new Event("tableSessionReady"));
                navigate(`/t/${tableId}`, { replace: true });
            } catch (err) {
                if (tableId) {
                    sessionStorage.removeItem(`tableMinting:${tableId}`);
                }
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

    const cartCount = cartItems.length;
    const cartTotal = cartItems.reduce(
        (sum, item) => sum + (item.unitPrice ?? 0) * (item.qty ?? 1),
        0
    );

    useEffect(() => {
        const r = ref(db, `menu/${seg}`);
        const unsub = onValue(
            r,
            (snap) => {
                const val = (snap.exists() ? snap.val() : null) as MenuMap | null;
                setData(val);
                setLoading(false);
            },
            () => {
                setError("Menü okunamadı");
                setLoading(false);
            }
        );
        return () => unsub();
    }, [seg]);

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }, [seg]);

    const list = useMemo(() => {
        const arr = Object.entries(data ?? {})
            .filter(([, v]) => v && typeof v === "object")
            .map(([key, item]) => ({ key, ...(item as MenuItem) }));

        return arr.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", "de"));
    }, [data]);

    const toggleAvailability = async (itemKey: string, next: boolean) => {
        try {
            await update(ref(db, `menu/${seg}/${itemKey}`), { isAvailable: next });
        } catch {
            setError("Yetki yok: Menü güncellenemedi (rules reddetti).");
        }
    };

    const handleOpenPriceDialog = (itemKey: string, currentPrice: number) => {
        setSelectedItemKey(itemKey);
        setNewPrice(String(currentPrice));
        setPriceError("");
        setPriceDialogOpen(true);
    };

    const handleClosePriceDialog = () => {
        setPriceDialogOpen(false);
        setSelectedItemKey(null);
        setNewPrice("");
        setPriceError("");
    };

    const handlePriceUpdate = async () => {
        const parsed = Number(newPrice);
        if (!newPrice || isNaN(parsed) || parsed <= 0) {
            setPriceError("Geçerli bir fiyat girin.");
            return;
        }
        if (!selectedItemKey) return;
        setPriceUpdating(true);
        try {
            await update(ref(db, `menu/${seg}/${selectedItemKey}`), { price: parsed });
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



    return (
        <Box sx={{ pb: 4 }}>
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
                        <CustomSegment value={seg} onChange={(k) => setSeg(k as SegKey)} items={items} />
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
                {!error && !loading && list.length === 0 && (
                    <Alert severity="info">{m.noItems}</Alert>
                )}

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
                    {loading
                        ? Array.from({ length: 8 }).map((_, i) => (
                            <Card key={i} sx={{ borderRadius: 4, overflow: "hidden" }}>
                                <Skeleton variant="rectangular" height={190} />
                                <CardContent>
                                    <Skeleton width="70%" />
                                    <Skeleton width="40%" />
                                    <Skeleton width="90%" />
                                </CardContent>
                            </Card>
                        ))
                        : list.map((item) => {
                            // ── localTitle: translations'tan oku, yoksa item.title'a dön ──
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
                                                <IconButton size="small" onClick={() => handleOpenPriceDialog(item.key, item.price)} sx={{ color: "#FF7A00" }}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                                <PremiumSwitch
                                                    size="small"
                                                    checked={item.isAvailable}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        toggleAvailability(item.key, checked);
                                                        dispatch(showNotify({
                                                            message: `${localTitle} ${checked ? "mevcut" : "tükendi"}`,
                                                            severity: checked ? "success" : "error",
                                                        }));
                                                    }}
                                                />
                                            </Box>
                                        )}

                                        <Box sx={{ display: "flex", flexDirection: "column", mt: 0.5, gap: 1 }}>
                                            {/* Alerjenler */}
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

                                            {/* Sepete ekle butonu — tam genişlik */}
                                            <Button
                                                fullWidth
                                                size="small"
                                                variant="contained"
                                                disableElevation
                                                disabled={!item.isAvailable || !isProximityOk || isExpired}
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
            </Box>

            {cartCount >= 0 && (
                <Box sx={{ position: "fixed", bottom: 16, left: 0, right: 0, zIndex: 2000, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
                    <Box sx={{ pointerEvents: "auto", width: "100%", maxWidth: 720, mx: 2, borderRadius: 999, px: 2, py: 0.1, display: "flex", alignItems: "center", justifyContent: "space-between", bgcolor: "rgba(17,24,39,0.92)", backdropFilter: "blur(18px)", color: "white", boxShadow: "0 18px 50px rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.12)" }}>
                        <Box>
                            <Typography sx={{ fontWeight: 900, fontSize: 14 }}>{m.cartCount(cartCount)}</Typography>
                            <Typography sx={{ fontSize: 13, opacity: 0.85 }}>{formatPriceTRY(cartTotal)}</Typography>
                        </Box>
                        <Button
                            variant="contained"
                            disabled={!isOrder || cartCount === 0 || !isProximityOk}
                            sx={{ borderRadius: 999, textTransform: "none", fontWeight: 900, px: 3, py: 1, bgcolor: "#FF7A00", boxShadow: "0 10px 30px rgba(255,122,0,0.4)", "&:hover": { bgcolor: "#ff8c1a" }, "&.Mui-disabled": { bgcolor: "rgba(255,122,0,0.35)", color: "rgba(255,255,255,0.9)", boxShadow: "none", opacity: 1, cursor: "not-allowed" } }}
                            onClick={() => cartCount !== 0 && navigate("/basket")}
                        >
                            {m.goToCart}
                        </Button>
                    </Box>
                </Box>
            )}

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