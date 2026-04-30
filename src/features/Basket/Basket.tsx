import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Box,
    Button,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem as MuiMenuItem,
    IconButton,
    Chip,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
    updateNote,
    removeItem,
    useAppDispatch,
    useAppSelector,
    show as showNotify,
} from "../../store";
import { useAuth } from "../../auth/aut.context";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { db } from "../../firebase/firebase";
import { onValue, ref } from "firebase/database";
import { ConfirmDialog, DarkTextField, PremiumSwitch } from "../../component";
import { useProximityCheck, useTableSession } from "../../hooks";
import { useLanguage } from "../../i18n";
import { Radio, RadioGroup, FormControlLabel as MuiFormControlLabel } from "@mui/material";
import { useOrderSender } from "./hook/useOrderSender.ts";
import { useBasketForm } from "./hook/useBasketForm";

type TableRow = { id: string; name?: string };
const LOCAL_ONLY_TABLES = ["t1001", "t1002", "t1003"];

function asBool(v: unknown) {
    return v === true || v === "true" || v === 1 || v === "1";
}

export const Basket = () => {
    const { t } = useLanguage();
    const b = t.basket;

    const dispatch = useAppDispatch();
    const { user } = useAuth();
    const { isExpired, tableId: qrTableId } = useTableSession();
    const { status: proximityStatus } = useProximityCheck();

    const items = useAppSelector((s) => s.cart.items);
    const liveTableItems = useAppSelector((s) => s.tableLiveCart.items);
    const isOrder = useAppSelector((s) => s.orderSettings.isOrder);

    const isLoggedIn = !!user;

    const isToGoAdmin = useMemo(
        () => (user as any)?.userType === "garson" && asBool((user as any)?.isToGoAdmin),
        [user]
    );

    const isLocalOnlyTable = useMemo(
        () => LOCAL_ONLY_TABLES.includes(qrTableId ?? ""),
        [qrTableId]
    );

    const canChooseTable = useMemo(
        () =>
            Boolean(
                isLoggedIn &&
                !isToGoAdmin &&
                (asBool((user as any)?.isAdmin) || (user as any)?.userType === "garson")
            ),
        [isLoggedIn, isToGoAdmin, user]
    );

    const isProximityOk = useMemo(
        () => (user as any)?.isAdmin || proximityStatus === "allowed",
        [user, proximityStatus]
    );

    // ─── Masalar
    const [tables, setTables] = useState<TableRow[]>([]);
    const [selectedTableId, setSelectedTableId] = useState<string>("");

    useEffect(() => {
        const r = ref(db, "tables");
        const unsub = onValue(r, (snap) => {
            const val = snap.val() || {};
            const arr: TableRow[] = Object.entries(val).map(([id, data]) => {
                const tableData = data as { name?: string };
                return { id, name: tableData.name };
            });
            arr.sort((a, b) => a.id.localeCompare(b.id, "de"));
            setTables(arr);
            if (!selectedTableId && arr.length > 0 && canChooseTable) {
                setSelectedTableId(arr[0]!.id);
            }
        });
        return () => unsub();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canChooseTable]);

    const handleTableChange = useCallback(
        (e: any) => canChooseTable && setSelectedTableId(e.target.value),
        [canChooseTable]
    );

    // ─── Sipariş için hesaplanan masa ID
    const tableIdToUse = useMemo(
        () =>
            isToGoAdmin
                ? "t999"
                : canChooseTable
                    ? selectedTableId
                    : qrTableId,
        [isToGoAdmin, canChooseTable, selectedTableId, qrTableId]
    );

    const shouldRequireToken = useMemo(
        () => !isLoggedIn && !isToGoAdmin && !canChooseTable,
        [isLoggedIn, isToGoAdmin, canChooseTable]
    );

    // ─── Birleşik ürünler & toplam
    const mergedItems = useMemo(() => [...items, ...liveTableItems], [items, liveTableItems]);

    const total = useMemo(
        () => mergedItems.reduce((sum, i) => sum + (i.unitPrice ?? 0) * (i.qty ?? 1), 0),
        [mergedItems]
    );

    // ─── Form state (custom hook)
    const {
        customerEmail,
        customerFirstName,
        customerLastName,
        customerPhone,
        paymentMethod,
        isValidEmail,
        isValidFirstName,
        isValidLastName,
        isValidPhone,
        handleEmailChange,
        handleFirstNameChange,
        handleLastNameChange,
        handlePhoneChange,
        handlePaymentMethodChange,
    } = useBasketForm();

    // ─── Item options (flat)
    // Record<cartId, Record<optionId, boolean>>
    const [itemOptions, setItemOptions] = useState<Record<string, Record<number, boolean>>>({});

    const toggleOption = useCallback((cartId: string, id: number) => {
        setItemOptions((prev) => {
            const cur = prev[cartId] ?? {};
            return { ...prev, [cartId]: { ...cur, [id]: !cur[id] } };
        });
    }, []);

    // ─── Accordion
    const [expanded, setExpanded] = useState<string | false>(
        items.length > 0 ? items[0].cartId : false
    );

    const handleAccordionChange = useCallback(
        (cartId: string) => () =>
            setExpanded((prev) => (prev === cartId ? false : cartId)),
        []
    );

    // ─── Ürün silme
    const handleRemoveItem = useCallback(
        (cartId: string, title: string) => (e: React.MouseEvent) => {
            e.stopPropagation();
            dispatch(removeItem(cartId));
            dispatch(showNotify({ message: b.removedFromCart(title), severity: "success" }));
        },
        [dispatch, b]
    );

    // ─── Not güncelleme
    const handleNoteChange = useCallback(
        (cartId: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
            dispatch(updateNote({ cartId, note: e.target.value })),
        [dispatch]
    );

    // ─── sendOrder (custom hook)
    const { sendOrder } = useOrderSender({
        mergedItems,
        total,
        itemOptions,
        tableIdToUse,
        selectedTableId,
        tables,
        isToGoAdmin,
        isLocalOnlyTable,
        canChooseTable,
        isValidEmail,
        isValidFirstName,
        isValidLastName,
        isValidPhone,
        customerEmail,
        customerFirstName,
        customerLastName,
        customerPhone,
        paymentMethod,
        shouldRequireToken,
    });

    // ─── Confirm dialog
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmBusy, setConfirmBusy] = useState(false);
    const confirmBusyRef = useRef(confirmBusy); // stale closure için
    confirmBusyRef.current = confirmBusy;

    const handleConfirmOpen = useCallback(() => setConfirmOpen(true), []);
    const handleConfirmClose = useCallback(() => setConfirmOpen(false), []);

    const handleConfirm = useCallback(async () => {
        setConfirmBusy(true);
        try {
            await sendOrder();
            setConfirmOpen(false);
        } finally {
            setConfirmBusy(false);
        }
    }, [sendOrder]);

    // ─── Gönder butonu disabled kontrolü
    const isSendDisabled = useMemo(
        () =>
            isExpired ||
            !isOrder ||
            mergedItems.length === 0 ||
            (canChooseTable && !selectedTableId) ||
            (isLocalOnlyTable && (!isValidFirstName || !isValidLastName || !isValidPhone)),
        [
            isExpired,
            isOrder,
            mergedItems.length,
            canChooseTable,
            selectedTableId,
            isLocalOnlyTable,
            isValidFirstName,
            isValidLastName,
            isValidPhone,
        ]
    );

    // ─── Confirm dialog title
    const confirmTitle = useMemo(() => {
        if (isLocalOnlyTable) return b.localConfirmTitle;
        const highlight = b.confirmTitleHighlight;
        const parts = b.confirmTitle.split(highlight);
        return (
            <>
                {parts[0]}
                <Box component="span" sx={{ color: "error.main", fontSize: "1.3em", fontWeight: 900 }}>
                    {highlight}
                </Box>
                {parts[1]}
            </>
        );
    }, [isLocalOnlyTable, b]);

    // ─── Masa seçici içerik ───────────────────────────────────────────────────
    const tableMenuItems = useMemo(() => {
        if (canChooseTable) {
            return tables.map((t) => (
                <MuiMenuItem key={t.id} value={t.id}>
                    {t.name ?? t.id}
                </MuiMenuItem>
            ));
        }
        if (qrTableId) {
            const found = tables.find((t) => t.id === qrTableId);
            const label = found?.name ?? qrTableId;
            return [<MuiMenuItem key={qrTableId} value={qrTableId}>{label}</MuiMenuItem>];
        }
        return [<MuiMenuItem key="" value="">{b.tableNotFound}</MuiMenuItem>];
    }, [canChooseTable, tables, qrTableId, b]);

    // ─── JSX ─────────────────────────────────────────────────────────────────
    return (
        <Box sx={{ maxWidth: 800, mx: "auto", px: 2, py: 4 }}>
            <Typography sx={{ fontWeight: 900, fontSize: 24, mb: 3 }}>{b.title}</Typography>

            {items.length > 0 && (
                <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 1.5 }}>
                    {b.yourItems}
                </Typography>
            )}

            {/* ─── Kendi ürünleri ─── */}
            {items.map((item) => {
                const allOptions: { id: number; key?: string; label: string; price?: number | null }[] =
                    Array.isArray(item.optionsCatalog) ? item.optionsCatalog : [];
                const opts = itemOptions[item.cartId] ?? {};
                const selectedChips = allOptions.filter((o) => !!opts[o.id]);
                const hasSelectedChips = selectedChips.length > 0;

                return (
                    <Accordion
                        key={item.cartId}
                        expanded={expanded === item.cartId}
                        onChange={handleAccordionChange(item.cartId)}
                        sx={{
                            borderRadius: 3,
                            mb: 2,
                            overflow: "hidden",
                            border: "1px solid",
                            borderColor: "divider",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                        }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2, width: "100%" }} component="span">
                                <IconButton
                                    component="span"
                                    onClick={handleRemoveItem(item.cartId, item.title)}
                                    sx={{
                                        color: "#e53935",
                                        bgcolor: "rgba(229,57,53,0.08)",
                                        "&:hover": { bgcolor: "rgba(229,57,53,0.15)" },
                                    }}
                                >
                                    <DeleteOutlineIcon />
                                </IconButton>

                                {item.image && (
                                    <Box
                                        component="img"
                                        src={item.image}
                                        alt={item.title}
                                        sx={{ width: 60, height: 60, objectFit: "cover", borderRadius: 2, flexShrink: 0 }}
                                    />
                                )}

                                <Box sx={{ flex: 1 }}>
                                    <Typography sx={{ fontWeight: 800 }}>{item.title}</Typography>
                                    <Typography sx={{ fontSize: 13, opacity: 0.7 }}>
                                        {`${item.unitPrice} TL`} • x{item.qty ?? 1}
                                    </Typography>
                                </Box>
                            </Box>
                        </AccordionSummary>

                        <AccordionDetails sx={{ bgcolor: "rgba(17,24,39,0.92)" }}>
                            {/* SEÇENEKLER */}
                            {allOptions.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography sx={{ fontWeight: 700, fontSize: 12, color: "rgba(255,255,255,0.55)", letterSpacing: 1, textTransform: "uppercase", mb: 1 }}>
                                        Seçenekler
                                    </Typography>
                                    {allOptions.map((o) => (
                                        <Box
                                            key={o.id}
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                py: 0.5,
                                                borderBottom: "1px solid rgba(255,255,255,0.07)",
                                            }}
                                        >
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                <Typography sx={{ fontSize: 13, color: "white" }}>{o.label}</Typography>
                                                {(o.price ?? 0) > 0 && (
                                                    <Typography sx={{ fontSize: 11, color: "#FF7A00" }}>
                                                        +{o.price} TL
                                                    </Typography>
                                                )}
                                            </Box>
                                            <PremiumSwitch
                                                checked={!!opts[o.id]}
                                                onChange={() => toggleOption(item.cartId, o.id)}
                                            />
                                        </Box>
                                    ))}
                                </Box>
                            )}

                            {/* SEÇİLEN SEÇENEKLER CHIP ÖZETİ */}
                            {hasSelectedChips && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography sx={{ fontWeight: 700, fontSize: 12, color: "rgba(255,255,255,0.55)", letterSpacing: 1, textTransform: "uppercase", mb: 1 }}>
                                        Seçilenler
                                    </Typography>
                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                                        {selectedChips.map((o) => (
                                            <Chip
                                                key={o.id}
                                                label={(o.price ?? 0) > 0 ? `${o.label} +${o.price}TL` : o.label}
                                                size="small"
                                                onDelete={() => toggleOption(item.cartId, o.id)}
                                                sx={{
                                                    bgcolor: "rgba(255,255,255,0.10)",
                                                    color: "white",
                                                    fontWeight: 600,
                                                    fontSize: 12,
                                                    borderRadius: 999,
                                                    border: "1px solid rgba(255,255,255,0.18)",
                                                    "& .MuiChip-deleteIcon": {
                                                        color: "rgba(255,255,255,0.5)",
                                                        "&:hover": { color: "#e53935" },
                                                    },
                                                }}
                                            />
                                        ))}
                                    </Box>
                                </Box>
                            )}

                            {/* NOT */}
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                                <Typography sx={{ fontWeight: 700, minWidth: 50, color: "white" }}>{b.note}</Typography>
                                <DarkTextField
                                    placeholder={b.notePlaceholder}
                                    value={item.note ?? ""}
                                    onChange={handleNoteChange(item.cartId)}
                                    sx={{ mb: 0 }}
                                />
                            </Box>
                        </AccordionDetails>
                    </Accordion>
                );
            })}

            {/* ─── Masadaki diğer kişilerin ürünleri ─── */}
            {liveTableItems.length > 0 && (
                <>
                    <Typography sx={{ fontWeight: 800, fontSize: 16, mt: 3, mb: 1.5 }}>
                        {b.othersItems}
                    </Typography>

                    {liveTableItems.map((item) => (
                        <Accordion
                            key={`live-${item.cartId}`}
                            disabled
                            sx={{
                                borderRadius: 3,
                                mb: 2,
                                overflow: "hidden",
                                border: "1px solid",
                                borderColor: "divider",
                                boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
                                opacity: 0.9,
                            }}
                        >
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 2, width: "100%" }} component="span">
                                    {item.image && (
                                        <Box
                                            component="img"
                                            src={item.image}
                                            alt={item.title}
                                            sx={{ width: 60, height: 60, objectFit: "cover", borderRadius: 2, flexShrink: 0 }}
                                        />
                                    )}
                                    <Box sx={{ flex: 1 }}>
                                        <Typography sx={{ fontWeight: 800 }}>{item.title}</Typography>
                                        <Typography sx={{ fontSize: 13, opacity: 0.7 }}>
                                            {`${item.unitPrice} TL`} • x{item.qty ?? 1}
                                        </Typography>
                                    </Box>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography sx={{ opacity: 0.75 }}>
                                    {item.note ? `${b.note} ${item.note}` : b.noNote}
                                </Typography>
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </>
            )}

            {/* ─── Alt panel: toplam + form + sipariş ─── */}
            <Box
                sx={{
                    mt: 3,
                    p: 2,
                    borderRadius: 3,
                    bgcolor: "rgba(17,24,39,0.92)",
                    color: "white",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    backdropFilter: "blur(18px)",
                }}
            >
                <Typography sx={{ fontSize: 12.5, opacity: 0.75, mb: 1 }}>
                    {b.total}: {`${total} TL`}
                </Typography>

                {isLocalOnlyTable && (
                    <>
                        <DarkTextField
                            label={b.firstName}
                            placeholder={b.firstNamePlaceholder}
                            value={customerFirstName}
                            onChange={handleFirstNameChange}
                            hasError={customerFirstName.length > 0 && !isValidFirstName}
                            helperText={customerFirstName.length > 0 && !isValidFirstName ? b.firstNameError : ""}
                        />
                        <DarkTextField
                            label={b.lastName}
                            placeholder={b.lastNamePlaceholder}
                            value={customerLastName}
                            onChange={handleLastNameChange}
                            hasError={customerLastName.length > 0 && !isValidLastName}
                            helperText={customerLastName.length > 0 && !isValidLastName ? b.lastNameError : ""}
                        />
                        <DarkTextField
                            label={b.phoneNumber}
                            placeholder={b.phoneNumberPlaceholder}
                            value={customerPhone}
                            onChange={handlePhoneChange}
                            hasError={customerPhone.length > 0 && !isValidPhone}
                            helperText={customerPhone.length > 0 && !isValidPhone ? b.phoneNumberError : ""}
                            inputProps={{ inputMode: "tel" }}
                        />
                        <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.75)", mb: 0.5 }}>
                            {b.paymentMethod}
                        </Typography>
                        <RadioGroup
                            row
                            value={paymentMethod}
                            onChange={handlePaymentMethodChange}
                            sx={{ mb: 1 }}
                        >
                            <MuiFormControlLabel
                                value="cash"
                                control={<Radio size="small" sx={{ color: "rgba(255,255,255,0.6)", "&.Mui-checked": { color: "#FF7A00" } }} />}
                                label={<Typography sx={{ fontSize: 13, color: "white", fontWeight: 600 }}>{b.paymentCashAtDoor}</Typography>}
                            />
                            <MuiFormControlLabel
                                value="card"
                                control={<Radio size="small" sx={{ color: "rgba(255,255,255,0.6)", "&.Mui-checked": { color: "#FF7A00" } }} />}
                                label={<Typography sx={{ fontSize: 13, color: "white", fontWeight: 600 }}>{b.paymentCardAtDoor}</Typography>}
                            />
                        </RadioGroup>
                    </>
                )}

                {isToGoAdmin && (
                    <DarkTextField
                        label={b.email}
                        placeholder={b.emailPlaceholder}
                        value={customerEmail}
                        onChange={handleEmailChange}
                        hasError={customerEmail.length > 0 && !isValidEmail}
                        helperText={customerEmail.length > 0 && !isValidEmail ? b.emailError : b.emailHelper}
                    />
                )}

                <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                    <InputLabel sx={{ color: "rgba(255,255,255,0.75)" }}>{b.table}</InputLabel>
                    <Select
                        value={canChooseTable ? selectedTableId : (qrTableId ?? "")}
                        label={b.table}
                        disabled={!canChooseTable}
                        onChange={handleTableChange}
                        sx={{
                            borderRadius: 2.5,
                            color: "white",
                            "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
                            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.30)" },
                            "& .MuiSvgIcon-root": { color: "rgba(255,255,255,0.8)" },
                            "& .MuiSelect-select.Mui-disabled": { color: "white !important", WebkitTextFillColor: "white !important" },
                        }}
                        MenuProps={{ PaperProps: { sx: { borderRadius: 2, mt: 1 } } }}
                    >
                        {tableMenuItems}
                    </Select>
                </FormControl>

                {!isProximityOk && proximityStatus === "denied" && (
                    <Typography sx={{ fontSize: 12, color: "#ffb4b4", mb: 1, textAlign: "center" }}>
                        {b.locationWarning}
                    </Typography>
                )}

                <Button
                    fullWidth
                    variant="contained"
                    disableElevation
                    disabled={isSendDisabled}
                    onClick={handleConfirmOpen}
                    sx={{
                        borderRadius: 999,
                        textTransform: "none",
                        fontWeight: 900,
                        py: 1.15,
                        bgcolor: "#FF7A00",
                        boxShadow: "0 14px 40px rgba(255,122,0,0.35)",
                        "&:hover": { bgcolor: "#ff8c1a", boxShadow: "0 18px 52px rgba(255,122,0,0.42)" },
                        "&.Mui-disabled": {
                            bgcolor: "rgba(255,122,0,0.25)",
                            color: "rgba(255,255,255,0.65)",
                        },
                    }}
                >
                    {b.sendOrder}
                </Button>
            </Box>

            {/* ─── Confirm dialog ─── */}
            <ConfirmDialog
                open={confirmOpen}
                title={confirmTitle}
                description={b.confirmDesc(total)}
                confirmText={b.confirmYes}
                cancelText={b.confirmNo}
                busy={confirmBusy}
                onClose={handleConfirmClose}
                onConfirm={handleConfirm}
            >
                <Box sx={{ mt: 1.5 }}>
                    {mergedItems.map((item, index) => (
                        <Box
                            key={index}
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                py: 0.6,
                                borderBottom: "1px solid",
                                borderColor: "divider",
                                "&:last-child": { borderBottom: "none" },
                            }}
                        >
                            <Typography sx={{ fontSize: 13.5, color: "primary.main" }}>
                                {item.title}
                                {(item.qty ?? 1) > 1 && (
                                    <Box component="span" sx={{ opacity: 0.55, fontSize: 12, ml: 0.5 }}>
                                        x{item.qty}
                                    </Box>
                                )}
                            </Typography>
                            <Typography sx={{ fontSize: 13.5, fontWeight: 700, ml: 2, whiteSpace: "nowrap" }}>
                                {item.unitPrice * (item.qty ?? 1)} TL
                            </Typography>
                        </Box>
                    ))}
                </Box>

                <Typography variant="caption" sx={{ color: "text.secondary", mt: 2, display: "block", lineHeight: 1.6 }}>
                    Siparişi onaylayarak{" "}
                    <Box component="a" href="/kullanim-kosullari" target="_blank" sx={{ color: "primary.main", textDecoration: "underline" }}>
                        Kullanım Koşulları
                    </Box>
                    'nı ve{" "}
                    <Box component="a" href="/gizlilik-politikasi" target="_blank" sx={{ color: "primary.main", textDecoration: "underline" }}>
                        Gizlilik Politikası
                    </Box>
                    'nı kabul etmiş sayılırsınız.
                </Typography>
            </ConfirmDialog>
        </Box>
    );
};