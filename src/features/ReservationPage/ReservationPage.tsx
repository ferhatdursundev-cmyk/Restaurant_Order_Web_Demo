import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Divider,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import { get, onValue, push, ref } from "firebase/database";
import { db } from "../../firebase/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReservationFormData {
    customerName: string;
    customerEmail: string;
    phone: string;
    date: string;
    time: string;
    endTime: string;
    partySize: string;
    tableId: string;
    note: string;
}

interface Table {
    id: string;
    name: string;
    number: number;
}

interface TableTileProps {
    table: Table;
    isBooked: boolean;
    isSelected: boolean;
    onSelect: (id: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_FORM: ReservationFormData = {
    customerName: "",
    customerEmail: "",
    phone: "",
    date: "",
    time: "",
    endTime: "",
    partySize: "2",
    tableId: "",
    note: "",
};

const PARTY_SIZES = Array.from({ length: 10 }, (_, i) => String(i + 1));

const TIME_SLOTS = [
    "11:00", "11:30",
    "12:00", "12:30",
    "13:00", "13:30",
    "14:00", "14:30",
    "17:00", "17:30",
    "18:00", "18:30",
    "19:00", "19:30",
    "20:00", "20:30",
    "21:00", "21:30",
    "22:00", "22:30",
    "23:00", "23:30",
    "00:00", "00:30",
    "01:00",
];

const LEGEND = [
    { color: "success.main", label: "Boş" },
    { color: "error.main",   label: "Dolu" },
    { color: "primary.main", label: "Seçili" },
] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

const TableTile = React.memo<TableTileProps>(({ table, isBooked, isSelected, onSelect }) => (
    <Tooltip title={isBooked ? "Bu masa dolu" : table.name}>
        <Box
            onClick={() => !isBooked && onSelect(table.id)}
            sx={{
                width: 68, height: 68, borderRadius: 2,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                cursor: isBooked ? "not-allowed" : "pointer",
                border: "2px solid", transition: "all 150ms ease",
                bgcolor: isSelected ? "primary.main" : isBooked ? "error.50" : "success.50",
                borderColor: isSelected ? "primary.main" : isBooked ? "error.light" : "success.light",
                color: isSelected ? "#fff" : isBooked ? "error.main" : "success.dark",
                opacity: isBooked ? 0.6 : 1,
                "&:hover": isBooked ? {} : { borderColor: "primary.main", transform: "scale(1.05)" },
            }}
        >
            <TableRestaurantIcon sx={{ fontSize: 22, mb: 0.25 }} />
            <Typography variant="caption" fontWeight={700} lineHeight={1}>{table.number}</Typography>
        </Box>
    </Tooltip>
));

// ─── Component ────────────────────────────────────────────────────────────────

export const ReservationPage: React.FC = () => {
    const [form, setForm]                     = useState<ReservationFormData>(INITIAL_FORM);
    const [errors, setErrors]                 = useState<Partial<ReservationFormData>>({});
    const [loading, setLoading]               = useState(false);
    const [submitted, setSubmitted]           = useState(false);
    const [submitError, setSubmitError]       = useState<string | null>(null);
    const [tables, setTables]                 = useState<Table[]>([]);
    const [bookedTableIds, setBookedTableIds] = useState<Set<string>>(new Set());
    const [loadingTables, setLoadingTables]   = useState(false);

    const today = useMemo(() => new Date().toISOString().split("T")[0], []);

    // ── Load all tables once ───────────────────────────────────────────────────

    useEffect(() => {
        const unsub = onValue(ref(db, "tables"), (snap) => {
            const val = snap.val() as Record<string, Table> | null;
            if (!val) { setTables([]); return; }
            setTables(Object.values(val).sort((a, b) => a.number - b.number));
        });
        return () => unsub();
    }, []);

    // ── End time slots ─────────────────────────────────────────────────────────

    const endTimeSlots = useMemo(() => {
        if (!form.time) return [];
        const startIdx = TIME_SLOTS.indexOf(form.time);
        return TIME_SLOTS.slice(startIdx + 1);
    }, [form.time]);

    // ── Load booked tables (overlap check) ────────────────────────────────────

    const loadBookedTables = useCallback((date: string, startTime: string, endTime: string) => {
        if (!date || !startTime || !endTime) { setBookedTableIds(new Set()); return; }
        setLoadingTables(true);
        get(ref(db, "reservations"))
            .then((snap) => {
                const val = snap.val() as Record<string, {
                    date: string; time: string; endTime?: string;
                    tableId?: string; status: string;
                }> | null;
                const booked = new Set<string>();
                if (val) {
                    Object.values(val).forEach((r) => {
                        if (r.date === date && r.status === "confirmed" && r.tableId) {
                            const rEnd     = r.endTime || r.time;
                            const overlaps = r.time < endTime && rEnd > startTime;
                            if (overlaps) booked.add(r.tableId);
                        }
                    });
                }
                setBookedTableIds(booked);
            })
            .catch(() => {})
            .finally(() => setLoadingTables(false));
    }, []);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleChange = useCallback(
        (field: keyof ReservationFormData) =>
            (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                const value = e.target.value;
                setForm((prev) => {
                    const next = { ...prev, [field]: value };
                    if (field === "date" || field === "time") { next.tableId = ""; next.endTime = ""; }
                    if (field === "endTime") next.tableId = "";
                    return next;
                });
                setErrors((prev) => ({ ...prev, [field]: undefined }));
                if (field === "date")    loadBookedTables(value, form.time, form.endTime);
                if (field === "time")    loadBookedTables(form.date, value, form.endTime);
                if (field === "endTime") loadBookedTables(form.date, form.time, value);
            },
        [form.date, form.time, form.endTime, loadBookedTables]
    );

    const handleTableSelect   = useCallback((id: string) => {
        setForm((prev) => ({ ...prev, tableId: id }));
        setErrors((prev) => ({ ...prev, tableId: undefined }));
    }, []);

    const handleTableDeselect = useCallback(() => {
        setForm((prev) => ({ ...prev, tableId: "" }));
    }, []);

    const validate = useCallback((): boolean => {
        const e: Partial<ReservationFormData> = {};
        if (!form.customerName.trim())         e.customerName  = "Ad Soyad zorunlu";
        if (!form.customerEmail.includes("@")) e.customerEmail = "Geçerli e-posta girin";
        if (!form.phone.trim())                e.phone         = "Telefon zorunlu";
        if (!form.date)                        e.date          = "Tarih seçin";
        if (!form.time)                        e.time          = "Başlangıç saati seçin";
        if (!form.endTime)                     e.endTime       = "Bitiş saati seçin";
        if (!form.tableId)                     e.tableId       = "Masa seçin";
        setErrors(e);
        return Object.keys(e).length === 0;
    }, [form]);

    const handleSubmit = useCallback(async () => {
        console.log("handleSubmit called, form:", form);
        const isValid = validate();
        console.log("isValid:", isValid, "errors:", errors);
        if (!validate()) return;
        setLoading(true);
        setSubmitError(null);
        try {
            await push(ref(db, "reservations"), {
                customerName:  form.customerName.trim(),
                customerEmail: form.customerEmail.trim().toLowerCase(),
                phone:         form.phone.trim(),
                date:          form.date,
                time:          form.time,
                endTime:       form.endTime,
                partySize:     Number(form.partySize),
                tableId:       form.tableId,
                note:          form.note.trim(),
                status:        "pending_verification",
                createdAt:     Date.now(),
            });
            setSubmitted(true);
            console.log("DB URL:", db.app.options.databaseURL);
            console.log("Ref path:", ref(db, "reservations").toString());
        } catch (err: any) {
            console.error("Reservation submit error:", err);
            setSubmitError("Rezervasyon gönderilemedi. Lütfen tekrar deneyin.");
        } finally {
            setLoading(false);
        }
    }, [form, validate]);

    const handleReset = useCallback(() => {
        setForm(INITIAL_FORM);
        setSubmitted(false);
        setBookedTableIds(new Set());
    }, []);

    // ── Memoized values ────────────────────────────────────────────────────────

    const showTablePicker   = useMemo(() => !!(form.date && form.time && form.endTime), [form.date, form.time, form.endTime]);
    const selectedTableName = useMemo(() => tables.find((t) => t.id === form.tableId)?.name, [tables, form.tableId]);

    // ── Email Verification Success Screen ──────────────────────────────────────

    if (submitted) {
        return (
            <Container maxWidth="sm" sx={{ py: 8 }}>
                <Paper elevation={0} sx={{
                    p: 5, borderRadius: 4, textAlign: "center",
                    border: "1px solid", borderColor: "divider",
                }}>
                    <MarkEmailReadIcon sx={{ fontSize: 72, color: "warning.main", mb: 2 }} />
                    <Typography variant="h5" fontWeight={700} gutterBottom>
                        Mail Kutunuzu Kontrol Edin
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                        <strong>{form.customerEmail}</strong> adresine bir doğrulama linki gönderdik.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Rezervasyonunuzun işleme alınması için lütfen mailinizde gelen
                        <strong> "Rezervasyonu Onayla"</strong> butonuna tıklayın.
                        Link <strong>24 saat</strong> geçerlidir.
                    </Typography>

                    <Paper elevation={0} sx={{
                        p: 2, mb: 3, borderRadius: 3,
                        bgcolor: "action.hover", textAlign: "left",
                    }}>
                        <Stack spacing={0.5}>
                            <Typography variant="caption" color="text.secondary">Rezervasyon Özeti</Typography>
                            <Typography variant="body2"><strong>Tarih:</strong> {form.date}</Typography>
                            <Typography variant="body2"><strong>Saat:</strong> {form.time} – {form.endTime}</Typography>
                            <Typography variant="body2"><strong>Masa:</strong> {selectedTableName}</Typography>
                            <Typography variant="body2"><strong>Kişi:</strong> {form.partySize}</Typography>
                        </Stack>
                    </Paper>

                    <Alert severity="info" sx={{ mb: 3, textAlign: "left" }}>
                        Mail gelmediyse spam/junk klasörünüzü kontrol edin.
                    </Alert>

                    <Button variant="outlined" onClick={handleReset}>Yeni Rezervasyon</Button>
                </Paper>
            </Container>
        );
    }

    // ── Form ───────────────────────────────────────────────────────────────────

    return (
        <Container maxWidth="sm" sx={{ py: 6 }}>
            <Stack spacing={1} sx={{ mb: 4 }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                    <CalendarMonthIcon color="primary" sx={{ fontSize: 32 }} />
                    <Typography variant="h4" fontWeight={800}>Rezervasyon</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                    Masanızı ayırtın, sizi bekliyoruz.
                </Typography>
            </Stack>

            <Paper elevation={0} sx={{ p: { xs: 3, sm: 4 }, borderRadius: 4, border: "1px solid", borderColor: "divider" }}>
                <Stack spacing={3}>

                    <Typography variant="overline" color="text.secondary" fontWeight={700}>Kişisel Bilgiler</Typography>

                    <TextField
                        label="Ad Soyad" fullWidth value={form.customerName}
                        onChange={handleChange("customerName")}
                        error={!!errors.customerName} helperText={errors.customerName}
                        autoComplete="name"
                    />
                    <TextField
                        label="E-posta" fullWidth type="email" value={form.customerEmail}
                        onChange={handleChange("customerEmail")}
                        error={!!errors.customerEmail}
                        helperText={errors.customerEmail || "Doğrulama linki bu adrese gönderilecek"}
                        autoComplete="email"
                    />
                    <TextField
                        label="Telefon" fullWidth type="tel" value={form.phone}
                        onChange={handleChange("phone")}
                        error={!!errors.phone} helperText={errors.phone}
                        autoComplete="tel"
                    />

                    <Divider />

                    <Typography variant="overline" color="text.secondary" fontWeight={700}>Rezervasyon Detayları</Typography>

                    <TextField
                        label="Tarih" type="date" fullWidth InputLabelProps={{ shrink: true }}
                        inputProps={{ min: today }} value={form.date}
                        onChange={handleChange("date")}
                        error={!!errors.date} helperText={errors.date}
                    />

                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                        <TextField
                            label="Başlangıç Saati" select fullWidth value={form.time}
                            onChange={handleChange("time")}
                            error={!!errors.time} helperText={errors.time}
                        >
                            <MenuItem value="">Seçin</MenuItem>
                            {TIME_SLOTS.map((t) => (
                                <MenuItem key={t} value={t}>{t}</MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            label="Bitiş Saati" select fullWidth value={form.endTime}
                            onChange={handleChange("endTime")}
                            error={!!errors.endTime} helperText={errors.endTime}
                            disabled={!form.time}
                        >
                            <MenuItem value="">Seçin</MenuItem>
                            {endTimeSlots.map((t) => (
                                <MenuItem key={t} value={t}>{t}</MenuItem>
                            ))}
                        </TextField>
                    </Stack>

                    <TextField
                        label="Kişi Sayısı" select fullWidth value={form.partySize}
                        onChange={handleChange("partySize")}
                    >
                        {PARTY_SIZES.map((s) => (
                            <MenuItem key={s} value={s}>{s} kişi</MenuItem>
                        ))}
                    </TextField>

                    <Divider />

                    {/* Masa Seçimi */}
                    {showTablePicker ? (
                        <Box>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                                <TableRestaurantIcon fontSize="small" color="action" />
                                <Typography variant="overline" color="text.secondary" fontWeight={700}>
                                    Masa Seçimi
                                </Typography>
                                {loadingTables && <CircularProgress size={14} />}
                            </Stack>

                            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                                {LEGEND.map(({ color, label }) => (
                                    <Stack key={label} direction="row" alignItems="center" spacing={0.5}>
                                        <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: color }} />
                                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                                    </Stack>
                                ))}
                            </Stack>

                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
                                {tables.map((table) => (
                                    <TableTile
                                        key={table.id}
                                        table={table}
                                        isBooked={bookedTableIds.has(table.id)}
                                        isSelected={form.tableId === table.id}
                                        onSelect={handleTableSelect}
                                    />
                                ))}
                            </Box>

                            {errors.tableId && (
                                <Typography variant="caption" color="error" sx={{ mt: 0.75, display: "block" }}>
                                    {errors.tableId}
                                </Typography>
                            )}

                            {form.tableId && (
                                <Chip
                                    label={`Seçili: ${selectedTableName}`}
                                    color="primary" size="small" sx={{ mt: 1.5 }}
                                    onDelete={handleTableDeselect}
                                />
                            )}
                        </Box>
                    ) : (
                        <Alert severity="info" icon={<TableRestaurantIcon />}>
                            Masa seçimi için önce tarih, başlangıç ve bitiş saatini seçin.
                        </Alert>
                    )}

                    <TextField
                        label="Not (opsiyonel)" fullWidth multiline rows={3}
                        placeholder="Doğum günü, özel istek vb."
                        value={form.note} onChange={handleChange("note")}
                    />

                    <Alert severity="info" icon={<MarkEmailReadIcon />}>
                        Formu gönderdikten sonra e-posta adresinize bir doğrulama linki gelecektir.
                        Linke tıkladıktan sonra rezervasyon talebiniz işleme alınacaktır.
                    </Alert>

                    {submitError && <Alert severity="error">{submitError}</Alert>}

                    <Button
                        variant="contained" size="large" fullWidth
                        onClick={handleSubmit} disabled={loading}
                        sx={{ borderRadius: 2, py: 1.5, fontWeight: 700, fontSize: "1rem" }}
                    >
                        {loading ? <CircularProgress size={24} color="inherit" /> : "Doğrulama Maili Gönder"}
                    </Button>
                </Stack>
            </Paper>
        </Container>
    );
};
