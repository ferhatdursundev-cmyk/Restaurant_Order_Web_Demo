import { useEffect, useState } from "react";
import {
    Box,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Button,
    Divider,
    FormControl,
    FormControlLabel,
    IconButton,
    Radio,
    RadioGroup,
    Skeleton,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";
import RoomServiceOutlinedIcon from "@mui/icons-material/RoomServiceOutlined";
import PersonIcon from "@mui/icons-material/Person";
import ReceiptIcon from "@mui/icons-material/Receipt";
import { ref, set, onValue, remove } from "firebase/database";
import {db} from "../firebase/firebase.ts";
import { ConfirmDialog } from "./ConfirmDialog";
import { useAppDispatch, show as showNotify } from "../store";
import {useAuth} from "../auth/aut.context.tsx";

// ── Tipler ───────────────────────────────────────────────────────────────────

type CallType = "garson" | "hesap" | "";

type WaiterCall = {
    tableId:     string;
    type:        "garson" | "hesap";
    requestedAt: number;
    tableName:   string;
};

type Props = {
    tableId:    string;   // ör: "t3"
    tableName?: string;   // ör: "Masa 3"
};

const NOTIFY_MESSAGES: Record<Exclude<CallType, "">, string> = {
    garson: "Garson isteği başarıyla iletilmiştir.",
    hesap:  "Hesap isteği başarıyla iletilmiştir.",
};

function fmtTime(ms: number) {
    return new Date(ms).toLocaleTimeString("tr-TR", {
        hour:   "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

export const CallWaiterDialog = ({ tableId, tableName }: Props) => {
    const { user }   = useAuth();
    const dispatch   = useAppDispatch();
    const isAdmin    = user?.isAdmin === true;
    const [open, setOpen] = useState(false);
    const [calls, setCalls]       = useState<WaiterCall[]>([]);
    const [loadingCalls, setLoadingCalls] = useState(false);
    const [callType, setCallType] = useState<CallType>("");
    const [busy, setBusy]         = useState(false);

    // ── Admin: waiterCalls realtime listener
    useEffect(() => {
        if (!isAdmin || !open) return;

        setLoadingCalls(true);
        const unsub = onValue(ref(db, "waiterCalls"), (snap) => {
            const val = snap.val() as Record<string, Omit<WaiterCall, "tableId">> | null;
            if (!val) {
                setCalls([]);
            } else {
                const list: WaiterCall[] = Object.entries(val).map(([tid, v]) => ({
                    tableId: tid,
                    ...v,
                }));
                // En yeni çağrı üstte
                list.sort((a, b) => b.requestedAt - a.requestedAt);
                setCalls(list);
            }
            setLoadingCalls(false);
        });

        return () => unsub();
    }, [isAdmin, open]);

    const handleOpen  = () => setOpen(true);
    const handleClose = () => {
        if (busy) return;
        setOpen(false);
        setCallType("");
    };

    // Müşteri: çağrı gönder
    const handleConfirm = async () => {
        if (!callType || !tableId) return;
        try {
            setBusy(true);
            await set(ref(db, `waiterCalls/${tableId}`), {
                type:        callType,
                requestedAt: Date.now(),
                tableName:   tableName || tableId,
            });
            dispatch(showNotify({ message: NOTIFY_MESSAGES[callType], severity: "success" }));
            handleClose();
        } catch (err) {
            console.error("CallWaiterDialog error:", err);
            dispatch(showNotify({ message: "İstek iletilemedi. Lütfen tekrar deneyin.", severity: "error" }));
        } finally {
            setBusy(false);
        }
    };

    // Admin: çağrıyı tamamlandı olarak sil
    const handleDismiss = async (tid: string) => {
        try {
            await remove(ref(db, `waiterCalls/${tid}`));
        } catch (err) {
            console.error("handleDismiss error:", err);
        }
    };

    return (
        <>
            <Tooltip title={isAdmin ? "Garson Çağrıları" : "Garson Çağır"}>
                <span>
                    <IconButton
                        onClick={handleOpen}
                        disabled={!tableId && !isAdmin}
                        sx={{
                            width:        { xs: 25, sm: 30 },
                            height:       { xs: 25, sm: 30 },
                            borderRadius: 999,
                            bgcolor:      "action.hover",
                            color:        "#FF7A00",
                            transition:   "all 120ms ease",
                            "&:hover":    { bgcolor: "#FF7A00", color: "#fff" },
                        }}
                        aria-label={isAdmin ? "Garson çağrılarını gör" : "Garson çağır"}
                    >
                        <RoomServiceOutlinedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </span>
            </Tooltip>

            {/* ── ADMIN: çağrı listesi dialogu ── */}
            {isAdmin && (
                <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
                    <DialogTitle sx={{ fontWeight: 900 }}>
                        Garson Çağrıları
                    </DialogTitle>

                    <DialogContent dividers>
                        {loadingCalls && (
                            <Stack spacing={1}>
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={i} height={64} sx={{ borderRadius: 2 }} />
                                ))}
                            </Stack>
                        )}

                        {!loadingCalls && calls.length === 0 && (
                            <Typography
                                variant="body2"
                                sx={{ color: "text.secondary", textAlign: "center", py: 4 }}
                            >
                                Bekleyen çağrı yok.
                            </Typography>
                        )}

                        {!loadingCalls && calls.length > 0 && (
                            <Stack spacing={1}>
                                {calls.map((c) => (
                                    <Box key={c.tableId}>
                                        <Stack
                                            direction="row"
                                            alignItems="center"
                                            justifyContent="space-between"
                                            spacing={1}
                                            sx={{ py: 1 }}
                                        >
                                            {/* Sol: masa adı + saat */}
                                            <Stack spacing={0.25}>
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Typography sx={{ fontWeight: 900 }}>
                                                        {c.tableName}
                                                    </Typography>
                                                    <Chip
                                                        size="small"
                                                        icon={
                                                            c.type === "garson"
                                                                ? <PersonIcon sx={{ fontSize: 14 }} />
                                                                : <ReceiptIcon sx={{ fontSize: 14 }} />
                                                        }
                                                        label={c.type === "garson" ? "Garson" : "Hesap"}
                                                        color={c.type === "garson" ? "primary" : "warning"}
                                                        variant="outlined"
                                                        sx={{ fontWeight: 700 }}
                                                    />
                                                </Stack>
                                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                                    {fmtTime(c.requestedAt)}
                                                </Typography>
                                            </Stack>

                                            {/* Sağ: tamamlandı butonu */}
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                color="success"
                                                onClick={() => handleDismiss(c.tableId)}
                                                sx={{ borderRadius: 999, fontWeight: 700, whiteSpace: "nowrap" }}
                                            >
                                                Tamamlandı
                                            </Button>
                                        </Stack>
                                        <Divider />
                                    </Box>
                                ))}
                            </Stack>
                        )}
                    </DialogContent>

                    <DialogActions sx={{ px: 2, py: 1.5 }}>
                        <Button onClick={handleClose} variant="contained">
                            Kapat
                        </Button>
                    </DialogActions>
                </Dialog>
            )}

            {/* ── MÜŞTERİ: çağrı gönderme dialogu ── */}
            {!isAdmin && (
                <ConfirmDialog
                    open={open}
                    title="Ne çağırmak istersiniz?"
                    confirmText="Çağır"
                    cancelText="Vazgeç"
                    confirmDisabled={!callType}
                    busy={busy}
                    onClose={handleClose}
                    onConfirm={handleConfirm}
                >
                    <FormControl component="fieldset" sx={{ mt: 1 }}>
                        <RadioGroup
                            value={callType}
                            onChange={(e) => setCallType(e.target.value as CallType)}
                        >
                            <FormControlLabel
                                value="garson"
                                control={<Radio />}
                                label="Garson"
                            />
                            <FormControlLabel
                                value="hesap"
                                control={<Radio />}
                                label="Hesap"
                            />
                        </RadioGroup>
                    </FormControl>
                </ConfirmDialog>
            )}
        </>
    );
};