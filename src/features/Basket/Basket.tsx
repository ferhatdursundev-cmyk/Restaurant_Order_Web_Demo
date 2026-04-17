import { useEffect, useMemo, useState } from "react";
import {
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Box,
    Button,
    TextField,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem as MuiMenuItem,
    IconButton,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
    updateNote,
    removeItem,
    clearCart,
    useAppDispatch,
    useAppSelector,
    show as showNotify,
} from "../../store";
import { useAuth } from "../../auth/aut.context";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { db } from "../../firebase/firebase";
import { onValue, ref, push, set, serverTimestamp, runTransaction, remove, update } from "firebase/database";
import { useNavigate } from "react-router-dom";
import { ConfirmDialog } from "../../component";
import { getAuth } from "firebase/auth";
import { clearTableLiveItems } from "../../store";
import { useProximityCheck, useTableSession } from "../../hooks";
import { useLanguage } from "../../i18n";

type TableRow = { id: string; name?: string };

function storageKeyForTable(tableId: string) {
    return `tableToken:${tableId}`;
}

function asBool(v: unknown) {
    return v === true || v === "true" || v === 1 || v === "1";
}

function dateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export const Basket = () => {
    const { t } = useLanguage();
    const b = t.basket;

    const dispatch = useAppDispatch();
    const { user } = useAuth();
    const auth = getAuth();
    const { isExpired, tableId: qrTableId } = useTableSession();
    const { status: proximityStatus } = useProximityCheck();
    const isProximityOk = (user as any)?.isAdmin || proximityStatus === "allowed";
    const items = useAppSelector((s) => s.cart.items);
    const liveTableItems = useAppSelector((s) => s.tableLiveCart.items);
    const navigate = useNavigate();

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [customerEmail, setCustomerEmail] = useState("");

    const [expanded, setExpanded] = useState<string | false>(items.length > 0 ? items[0].cartId : false);

    const isLoggedIn = !!user;

    const isToGoAdmin = (user as any)?.userType === "garson" && asBool((user as any)?.isToGoAdmin);

    const canChooseTable = Boolean(
        isLoggedIn && !isToGoAdmin && (asBool((user as any)?.isAdmin) || (user as any)?.userType === "garson")
    );

    const [tables, setTables] = useState<TableRow[]>([]);
    const [selectedTableId, setSelectedTableId] = useState<string>("");

    const isOrder = useAppSelector((s) => s.orderSettings.isOrder);

    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim());

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

    const mergedItems = useMemo(() => {
        return [...items, ...liveTableItems];
    }, [items, liveTableItems]);

    const total = useMemo(() => {
        return mergedItems.reduce((sum: number, i) => sum + (i.unitPrice ?? 0) * (i.qty ?? 1), 0);
    }, [mergedItems]);

    const sendOrder = async () => {
        if (isToGoAdmin && !isValidEmail) {
            dispatch(showNotify({ message: b.emailError, severity: "error" }));
            return;
        }

        if (canChooseTable && !selectedTableId) {
            alert(b.noTableSelected);
            return;
        }

        const tableIdToUse = isToGoAdmin ? "t999" : canChooseTable ? selectedTableId : qrTableId;

        if (!tableIdToUse) {
            dispatch(showNotify({ message: b.qrExpired, severity: "error" }));
            return;
        }

        if (mergedItems.length === 0) return;

        const shouldRequireToken = !isLoggedIn && !isToGoAdmin && !canChooseTable;

        const tokenKey = storageKeyForTable(tableIdToUse);
        const token = sessionStorage.getItem(tokenKey);
        const expStr = sessionStorage.getItem(`tableTokenExp:${tableIdToUse}`);
        const exp = expStr ? Number(expStr) : null;

        if (shouldRequireToken && (!exp || Date.now() >= exp)) {
            dispatch(showNotify({ message: b.tokenExpired, severity: "error" }));
            return;
        }

        if (shouldRequireToken && !token) {
            dispatch(showNotify({ message: b.tokenMissing, severity: "error" }));
            return;
        }

        const path = `ordersByTable/${tableIdToUse}`;

        let nextNo: number | undefined = undefined;

        if (isToGoAdmin) {
            const day = dateKey();
            const counterRef = ref(db, `publicOrderNo/${day}/counter`);

            const counterRes = await runTransaction(counterRef, (cur) => {
                const n = typeof cur === "number" ? cur : 0;
                return n + 1;
            });

            if (!counterRes.committed) {
                dispatch(showNotify({ message: b.counterError, severity: "error" }));
                return;
            }

            nextNo = counterRes.snapshot.val() as number;
        }

        const orderRef = push(ref(db, path));

        const author =
            (user as any)?.name ??
            auth.currentUser?.displayName ??
            (auth.currentUser?.email ? auth.currentUser.email.split("@")[0] : null) ??
            "Müşteri";

        const now = Date.now();

        const payload: any = {
            author: author + " " + ((user as any)?.userType ?? ""),
            customerEmail: customerEmail.trim(),
            status: isToGoAdmin ? "preparing" : "new",
            createdAt: serverTimestamp(),
            createdAtMs: now,
            source: isToGoAdmin ? "togo" : "basket",
            tableId: tableIdToUse,
            tableToken: shouldRequireToken ? token : null,
            printed: false,
            printStarted: false,
            items: mergedItems.map((i) => ({
                cartId: i.cartId,
                productId: i.productId,
                title: i.title,
                unitPrice: i.unitPrice,
                qty: i.qty ?? 1,
                note: i.note ?? "",
                image: i.image ?? "",
            })),
            total,
        };

        if (typeof nextNo === "number") {
            payload.publicOrderNo = nextNo;
        }

        try {
            await set(orderRef, payload);

            if (!isToGoAdmin && !canChooseTable) {
                await remove(ref(db, `liveCartByTable/${tableIdToUse}`));
                await update(ref(db, `tableCartSignals/${tableIdToUse}`), {
                    lastSubmittedAt: Date.now(),
                    lastResetAt: Date.now(), // Diger kullanicilari tetikler ve onlarin local sepetlerini siler.
                });
            }

            dispatch(showNotify({
                message: isToGoAdmin ? b.orderSentEmail : b.orderSent,
                severity: "success",
            }));
        } catch (e) {
            console.error("sendOrder error:", e);
            dispatch(showNotify({ message: b.orderError, severity: "error" }));
            return;
        }

        dispatch(clearCart());
        dispatch(clearTableLiveItems());
        navigate("/");
    };

    return (
        <Box sx={{ maxWidth: 800, mx: "auto", px: 2, py: 4 }}>
            <Typography sx={{ fontWeight: 900, fontSize: 24, mb: 3 }}>{b.title}</Typography>

            {items.length > 0 && (
                <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 1.5 }}>
                    {b.yourItems}
                </Typography>
            )}

            {items.map((item) => (
                <Accordion
                    key={item.cartId}
                    expanded={expanded === item.cartId}
                    onChange={() => setExpanded(expanded === item.cartId ? false : item.cartId)}
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
                                onClick={(e) => {
                                    e.stopPropagation();
                                    dispatch(removeItem(item.cartId));
                                    dispatch(showNotify({ message: b.removedFromCart(item.title), severity: "success" }));
                                }}
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
                                    {`${(item.unitPrice)} TL`} • x{item.qty ?? 1}
                                </Typography>
                            </Box>
                        </Box>
                    </AccordionSummary>

                    <AccordionDetails>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                            <Typography sx={{ fontWeight: 700, minWidth: 50 }}>{b.note}</Typography>
                            <TextField
                                placeholder={b.notePlaceholder}
                                fullWidth
                                value={item.note ?? ""}
                                onChange={(e) =>
                                    dispatch(updateNote({ cartId: item.cartId, note: e.target.value }))
                                }
                                size="small"
                                sx={{ bgcolor: "background.paper", borderRadius: 2 }}
                            />
                        </Box>
                    </AccordionDetails>
                </Accordion>
            ))}

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
                                            {`${(item.unitPrice)} TL`} • x{item.qty ?? 1}
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
                    {b.total}: {`${(total)} TL`}
                </Typography>

                {isToGoAdmin && (
                    <TextField
                        fullWidth
                        size="small"
                        label={b.email}
                        placeholder={b.emailPlaceholder}
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        error={customerEmail.length > 0 && !isValidEmail}
                        helperText={
                            customerEmail.length > 0 && !isValidEmail
                                ? b.emailError
                                : b.emailHelper
                        }
                        sx={{
                            mb: 1.5,
                            "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.75)" },
                            "& .MuiFormHelperText-root": {
                                color: customerEmail.length > 0 && !isValidEmail ? "#ffb4b4" : "rgba(255,255,255,0.65)",
                                mx: 0.5,
                            },
                            "& .MuiOutlinedInput-root": {
                                borderRadius: 2.5,
                                color: "white",
                                bgcolor: "rgba(255,255,255,0.04)",
                                "& .MuiOutlinedInput-notchedOutline": {
                                    borderColor: customerEmail.length > 0 && !isValidEmail
                                        ? "rgba(255,120,120,0.9)"
                                        : "rgba(255,255,255,0.18)",
                                },
                                "&:hover .MuiOutlinedInput-notchedOutline": {
                                    borderColor: customerEmail.length > 0 && !isValidEmail
                                        ? "rgba(255,120,120,1)"
                                        : "rgba(255,255,255,0.30)",
                                },
                            },
                        }}
                    />
                )}

                <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                    <InputLabel sx={{ color: "rgba(255,255,255,0.75)" }}>{b.table}</InputLabel>
                    <Select
                        value={canChooseTable ? selectedTableId : (qrTableId ?? "")}
                        label={b.table}
                        disabled={!canChooseTable}
                        onChange={(e) => canChooseTable && setSelectedTableId(e.target.value)}
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
                        {canChooseTable
                            ? tables.map((t) => (
                                <MuiMenuItem key={t.id} value={t.id}>
                                    {t.name ? `${t.name} (${t.id})` : t.id}
                                </MuiMenuItem>
                            ))
                            : qrTableId
                                ? (() => {
                                    const found = tables.find((t) => t.id === qrTableId);
                                    const label = found?.name ? `${found.name} (${qrTableId})` : qrTableId;
                                    return [<MuiMenuItem key={qrTableId} value={qrTableId}>{label}</MuiMenuItem>];
                                })()
                                : [<MuiMenuItem key="" value="">{b.tableNotFound}</MuiMenuItem>]
                        }
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
                    disabled={isExpired || !isOrder || mergedItems.length === 0 || (canChooseTable && !selectedTableId)}
                    onClick={() => setConfirmOpen(true)}
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

            <ConfirmDialog
                open={confirmOpen}
                title={(() => {
                    const highlight = b.confirmTitleHighlight;
                    const parts = b.confirmTitle.split(highlight);
                    return (
                        <>
                            {parts[0]}
                            <Box
                                component="span"
                                sx={{ color: "error.main", fontSize: "1.3em", fontWeight: 900 }}
                            >
                                {highlight}
                            </Box>
                            {parts[1]}
                        </>
                    );
                })()}
                description={b.confirmDesc(total)}
                confirmText={b.confirmYes}
                cancelText={b.confirmNo}
                busy={confirmBusy}
                onClose={() => setConfirmOpen(false)}
                onConfirm={async () => {
                    setConfirmBusy(true);
                    try {
                        await sendOrder();
                        setConfirmOpen(false);
                    } finally {
                        setConfirmBusy(false);
                    }
                }}
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
                                {(item.unitPrice * (item.qty ?? 1))} TL
                            </Typography>
                        </Box>
                    ))}
                </Box>
            </ConfirmDialog>
        </Box>
    );
};