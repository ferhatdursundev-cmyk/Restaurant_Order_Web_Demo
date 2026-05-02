import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import FilterListIcon from "@mui/icons-material/FilterList";
import BlockIcon from "@mui/icons-material/Block";
import { getDatabase, onValue, ref } from "firebase/database";
import { getFunctions, httpsCallable } from "firebase/functions";
import { ConfirmDialog } from "../../component";

type ReservationStatus = "pending" | "confirmed" | "rejected" | "cancelled" | "pending_verification";

interface Reservation {
    id: string;
    customerName: string;
    customerEmail: string;
    phone: string;
    date: string;
    time: string;
    endTime?: string;
    partySize: number;
    tableId?: string;
    note?: string;
    status: ReservationStatus;
    createdAt: number;
}

interface TableInfo {
    name: string;
    number: number;
}

interface DetailDialogProps {
    reservation: Reservation | null;
    tableName?: string;
    onClose: () => void;
    onConfirmClick: (r: Reservation) => void;
    onRejectClick: (r: Reservation) => void;
    onCancelClick: (r: Reservation) => void;
}

type ConfirmAction = {
    type: "confirm" | "reject" | "cancel";
    reservationId: string;
    customerName: string;
} | null;

const STATUS_CONFIG: Record<
    ReservationStatus,
    { label: string; color: "warning" | "success" | "error" | "default" }
> = {
    pending:   { label: "Beklemede",    color: "warning" },
    confirmed: { label: "Onaylandı",    color: "success" },
    rejected:  { label: "Reddedildi",   color: "error"   },
    cancelled: { label: "İptal Edildi", color: "default"  },
    pending_verification: { label: "Pending Verification", color: "warning" },
};

const ACTION_CONFIG = {
    confirm: {
        title: "Rezervasyonu Onayla",
        description: (name: string) => `${name} adlı müşterinin rezervasyonunu onaylamak istiyor musunuz? Onay maili gönderilecek.`,
        confirmText: "Evet, Onayla",
    },
    reject: {
        title: "Rezervasyonu Reddet",
        description: (name: string) => `${name} adlı müşterinin rezervasyonunu reddetmek istiyor musunuz? Red maili gönderilecek.`,
        confirmText: "Evet, Reddet",
    },
    cancel: {
        title: "Rezervasyonu İptal Et",
        description: (name: string) => `${name} adlı müşterinin onaylanmış rezervasyonunu iptal etmek istiyor musunuz? İptal maili gönderilecek.`,
        confirmText: "Evet, İptal Et",
    },
};

//Helpers
function formatDate(dateStr: string): string {
    if (!dateStr) return "-";
    const [y, m, d] = dateStr.split("-");
    return `${d}.${m}.${y}`;
}

function formatTime(time: string, endTime?: string): string {
    if (!time) return "-";
    return endTime ? `${time} – ${endTime}` : time;
}

//Sub-components
const DetailRow = React.memo<{ label: string; value: string }>(({ label, value }) => (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Typography variant="body2" color="text.secondary" flexShrink={0}>{label}</Typography>
        <Typography variant="body2" fontWeight={500} textAlign="right">{value}</Typography>
    </Stack>
));

const DetailDialog = React.memo<DetailDialogProps>(({
                                                        reservation, tableName, onClose, onConfirmClick, onRejectClick, onCancelClick,
                                                    }) => {
    if (!reservation) return null;
    const st = STATUS_CONFIG[reservation.status];

    return (
        <Dialog open={!!reservation} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontWeight={700}>Rezervasyon Detayı</Typography>
                    <IconButton size="small" onClick={onClose}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Stack>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={1.5}>
                    <DetailRow label="Ad Soyad" value={reservation.customerName} />
                    <DetailRow label="E-posta" value={reservation.customerEmail} />
                    <DetailRow label="Telefon" value={reservation.phone} />
                    <Divider />
                    <DetailRow label="Tarih" value={formatDate(reservation.date)} />
                    <DetailRow label="Saat" value={formatTime(reservation.time, reservation.endTime)} />
                    <DetailRow label="Kişi Sayısı" value={`${reservation.partySize} kişi`} />
                    {reservation.tableId && (
                        <DetailRow label="Masa" value={tableName || reservation.tableId} />
                    )}
                    {reservation.note && <DetailRow label="Not" value={reservation.note} />}
                    <Divider />
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" color="text.secondary">Durum</Typography>
                        <Chip label={st.label} color={st.color} size="small" />
                    </Stack>

                    {reservation.status === "pending" && (
                        <Stack direction="row" spacing={1} pt={1}>
                            <Button
                                variant="outlined" color="error" startIcon={<CloseIcon />}
                                onClick={() => onRejectClick(reservation)} fullWidth
                            >
                                Reddet
                            </Button>
                            <Button
                                variant="contained" color="success" startIcon={<CheckIcon />}
                                onClick={() => onConfirmClick(reservation)} fullWidth
                            >
                                Onayla
                            </Button>
                        </Stack>
                    )}

                    {reservation.status === "confirmed" && (
                        <Button
                            variant="outlined" color="error" startIcon={<BlockIcon />}
                            onClick={() => onCancelClick(reservation)} fullWidth sx={{ mt: 1 }}
                        >
                            Rezervasyonu İptal Et
                        </Button>
                    )}
                </Stack>
            </DialogContent>
        </Dialog>
    );
});

// ─── Main Component ────────────────────────────────────────────────────────────

export const ReservationAdminPanel: React.FC = () => {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [tables, setTables] = useState<Record<string, TableInfo>>({});
    const [loadingList, setLoadingList] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [selected, setSelected] = useState<Reservation | null>(null);
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
    const [rejectNote, setRejectNote] = useState("");
    const [filterDate, setFilterDate] = useState("");
    const [filterStatus, setFilterStatus] = useState<ReservationStatus | "">("");
    const [actionError, setActionError] = useState<string | null>(null);

    // ── Firebase listeners ─────────────────────────────────────────────────────

    useEffect(() => {
        const db = getDatabase();
        const unsub = onValue(ref(db, "tables"), (snap) => {
            setTables(snap.val() as Record<string, TableInfo> || {});
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const db = getDatabase();
        const unsub = onValue(
            ref(db, "reservations"),
            (snap) => {
                const val = snap.val() as Record<string, Omit<Reservation, "id">> | null;
                if (!val) {
                    setReservations([]);
                } else {
                    const list: Reservation[] = Object.entries(val)
                        .map(([id, r]) => ({ id, ...r }))
                        .sort((a, b) => {
                            if (a.status === "pending" && b.status !== "pending") return -1;
                            if (a.status !== "pending" && b.status === "pending") return 1;
                            return (b.createdAt || 0) - (a.createdAt || 0);
                        });
                    setReservations(list);
                }
                setLoadingList(false);
            },
            (error) => {
                console.error("RTDB reservations read error:", error);
                setLoadingList(false);
            }
        );
        return () => unsub();
    }, []);

    // ── Memoized values
    const filtered = useMemo(() => {
        return reservations.filter((r) => {
            if (r.status === "pending_verification") return false; // ← ekle
            if (filterDate && r.date !== filterDate) return false;
            if (filterStatus && r.status !== filterStatus) return false;
            return true;
        });
    }, [reservations, filterDate, filterStatus]);

    const pendingCount = useMemo(
        () => reservations.filter((r) => r.status === "pending").length,
        [reservations]
    );

    const selectedTableName = useMemo(() => {
        if (!selected?.tableId) return undefined;
        return tables[selected.tableId]?.name || selected.tableId;
    }, [selected, tables]);

    const confirmDialogConfig = useMemo(() => {
        if (!confirmAction) return null;
        return ACTION_CONFIG[confirmAction.type];
    }, [confirmAction]);

    // ── Callbacks ──────────────────────────────────────────────────────────────

    const getTableName = useCallback(
        (tableId?: string) => {
            if (!tableId) return "-";
            return tables[tableId]?.name || tableId;
        },
        [tables]
    );

    const updateStatus = useCallback(async (
        id: string,
        status: ReservationStatus,
        note?: string
    ) => {
        setActionLoading(true);
        setActionError(null);
        try {
            const functions = getFunctions(undefined, "europe-west1");
            const fn = httpsCallable(functions, "updateReservationStatus");
            await fn({ reservationId: id, status, rejectNote: note || "" });
            setSelected(null);
            setConfirmAction(null);
            setRejectNote("");
        } catch (err: any) {
            setActionError(err?.message || JSON.stringify(err));
            console.error("updateReservationStatus error:", err);
        } finally {
            setActionLoading(false);
        }
    }, []);

    const handleConfirmAction = useCallback(() => {
        if (!confirmAction) return;
        const statusMap = {
            confirm: "confirmed",
            reject:  "rejected",
            cancel:  "cancelled",
        } as const;
        updateStatus(
            confirmAction.reservationId,
            statusMap[confirmAction.type],
            confirmAction.type === "reject" ? rejectNote : undefined
        );
    }, [confirmAction, updateStatus, rejectNote]);

    const handleConfirmClick = useCallback((r: Reservation) => {
        setSelected(null);
        setConfirmAction({ type: "confirm", reservationId: r.id, customerName: r.customerName });
    }, []);

    const handleRejectClick = useCallback((r: Reservation) => {
        setSelected(null);
        setRejectNote("");
        setConfirmAction({ type: "reject", reservationId: r.id, customerName: r.customerName });
    }, []);

    const handleCancelClick = useCallback((r: Reservation) => {
        setSelected(null);
        setConfirmAction({ type: "cancel", reservationId: r.id, customerName: r.customerName });
    }, []);

    const handleCloseConfirm = useCallback(() => {
        setConfirmAction(null);
        setRejectNote("");
    }, []);

    const handleSelect       = useCallback((r: Reservation) => setSelected(r), []);
    const handleCloseDetail  = useCallback(() => setSelected(null), []);
    const handleCloseError   = useCallback(() => setActionError(null), []);
    const handleClearFilters = useCallback(() => { setFilterDate(""); setFilterStatus(""); }, []);

    const handleQuickConfirm = useCallback((r: Reservation) => {
        setConfirmAction({ type: "confirm", reservationId: r.id, customerName: r.customerName });
    }, []);
    const handleQuickReject = useCallback((r: Reservation) => {
        setRejectNote("");
        setConfirmAction({ type: "reject", reservationId: r.id, customerName: r.customerName });
    }, []);
    const handleQuickCancel = useCallback((r: Reservation) => {
        setConfirmAction({ type: "cancel", reservationId: r.id, customerName: r.customerName });
    }, []);

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Typography variant="h5" fontWeight={800}>Rezervasyonlar</Typography>
                    {pendingCount > 0 && (
                        <Chip label={`${pendingCount} bekliyor`} color="warning" size="small" />
                    )}
                </Stack>
            </Stack>

            {actionError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={handleCloseError}>
                    {actionError}
                </Alert>
            )}

            {/* Filters */}
            <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                    <FilterListIcon color="action" />
                    <TextField
                        label="Tarihe Göre Filtrele" type="date" size="small"
                        InputLabelProps={{ shrink: true }}
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        sx={{ minWidth: 180 }}
                    />
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        {(["", "pending", "confirmed", "rejected", "cancelled"] as const).map((s) => (
                            <Chip
                                key={s || "all"}
                                label={s ? STATUS_CONFIG[s].label : "Tümü"}
                                color={s ? STATUS_CONFIG[s].color : "default"}
                                variant={filterStatus === s ? "filled" : "outlined"}
                                onClick={() => setFilterStatus(s)}
                                size="small"
                                sx={{ cursor: "pointer" }}
                            />
                        ))}
                    </Stack>
                    {(filterDate || filterStatus) && (
                        <Button size="small" onClick={handleClearFilters}>Temizle</Button>
                    )}
                </Stack>
            </Paper>

            {/* Table */}
            {loadingList ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                    <CircularProgress />
                </Box>
            ) : filtered.length === 0 ? (
                <Box sx={{ py: 8, textAlign: "center" }}>
                    <Typography color="text.secondary">Rezervasyon bulunamadı.</Typography>
                </Box>
            ) : (
                <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover" } }}>
                                <TableCell>Ad Soyad</TableCell>
                                <TableCell>Tarih</TableCell>
                                <TableCell>Saat</TableCell>
                                <TableCell align="center">Kişi</TableCell>
                                <TableCell>Masa</TableCell>
                                <TableCell>Durum</TableCell>
                                <TableCell align="center">İşlem</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filtered.map((r) => {
                                const st = STATUS_CONFIG[r.status];
                                return (
                                    <TableRow
                                        key={r.id} hover
                                        sx={{ bgcolor: r.status === "pending" ? "warning.50" : undefined }}
                                    >
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={600}>{r.customerName}</Typography>
                                            <Typography variant="caption" color="text.secondary">{r.phone}</Typography>
                                        </TableCell>
                                        <TableCell>{formatDate(r.date)}</TableCell>
                                        <TableCell>{formatTime(r.time, r.endTime)}</TableCell>
                                        <TableCell align="center">{r.partySize}</TableCell>
                                        <TableCell>{getTableName(r.tableId)}</TableCell>
                                        <TableCell>
                                            <Chip label={st.label} color={st.color} size="small" />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Stack direction="row" spacing={0.5} justifyContent="center">
                                                <Tooltip title="Detay">
                                                    <IconButton size="small" onClick={() => handleSelect(r)}>
                                                        <InfoOutlinedIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                {r.status === "pending" && (
                                                    <>
                                                        <Tooltip title="Onayla">
                                                            <IconButton size="small" color="success" onClick={() => handleQuickConfirm(r)}>
                                                                <CheckIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Reddet">
                                                            <IconButton size="small" color="error" onClick={() => handleQuickReject(r)}>
                                                                <CloseIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </>
                                                )}
                                                {r.status === "confirmed" && (
                                                    <Tooltip title="İptal Et">
                                                        <IconButton size="small" color="error" onClick={() => handleQuickCancel(r)}>
                                                            <BlockIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Detail Dialog */}
            <DetailDialog
                reservation={selected}
                tableName={selectedTableName}
                onClose={handleCloseDetail}
                onConfirmClick={handleConfirmClick}
                onRejectClick={handleRejectClick}
                onCancelClick={handleCancelClick}
            />

            {/* Confirm Dialog */}
            {confirmDialogConfig && confirmAction && (
                <ConfirmDialog
                    open={!!confirmAction}
                    title={confirmDialogConfig.title}
                    description={confirmDialogConfig.description(confirmAction.customerName)}
                    confirmText={confirmDialogConfig.confirmText}
                    cancelText="Vazgeç"
                    onConfirm={handleConfirmAction}
                    onClose={handleCloseConfirm}
                    busy={actionLoading}
                >
                    {confirmAction.type === "reject" && (
                        <TextField
                            label="Müşteriye mesaj (opsiyonel)"
                            placeholder="Örn: Belirtilen tarihte kapasitemiz dolu."
                            multiline rows={3} fullWidth
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            sx={{ mt: 2 }}
                        />
                    )}
                </ConfirmDialog>
            )}
        </Box>
    );
};
