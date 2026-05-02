import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";
import { getDatabase } from "firebase/database";
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
    Stack,
    Chip,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { useAuth } from "../auth/aut.context.tsx";

interface ReservationAlarm {
    open: boolean;
    customerName: string;
    date: string;
    time: string;
    endTime?: string;
    partySize: number;
    tableName?: string;
}

const INITIAL_ALARM: ReservationAlarm = {
    open: false,
    customerName: "",
    date: "",
    time: "",
    partySize: 0,
};

// ─── Helpers
function formatDate(dateStr: string): string {
    if (!dateStr) return "-";
    const [y, m, d] = dateStr.split("-");
    return `${d}.${m}.${y}`;
}

function formatTime(time: string, endTime?: string): string {
    if (!time) return "-";
    return endTime ? `${time} – ${endTime}` : time;
}

export const GlobalReservationAlarm = () => {
    const { user } = useAuth();
    const [alarm, setAlarm] = useState<ReservationAlarm>(INITIAL_ALARM);
    const [audioReady, setAudioReady] = useState(false);

    const audioRef   = useRef<HTMLAudioElement | null>(null);
    const initRef    = useRef(false);
    const prevSigRef = useRef<string>("");

    // ── Audio init
    useEffect(() => {
        audioRef.current = new Audio("order_alarm.mp3");
        audioRef.current.loop    = true;
        audioRef.current.preload = "auto";

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        };
    }, []);

    // ── Audio unlock (browser autoplay fix)
    useEffect(() => {
        const unlock = async () => {
            if (!audioRef.current || audioReady) return;
            try {
                audioRef.current.muted = true;
                await audioRef.current.play();
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current.muted       = false;
                setAudioReady(true);
            } catch (err) {
                console.error("Audio unlock başarısız:", err);
            }
        };
        window.addEventListener("click",      unlock, { once: true });
        window.addEventListener("touchstart", unlock, { once: true });
        return () => {
            window.removeEventListener("click",      unlock);
            window.removeEventListener("touchstart", unlock);
        };
    }, [audioReady]);

    // ── Play / stop callbacks
    const playAlarm = useCallback(() => {
        if (audioRef.current && audioReady) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch((err) =>
                console.error("Rezervasyon alarm sesi çalınamadı:", err)
            );
        }
    }, [audioReady]);

    const stopAlarm = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    }, []);

    // ── Reservation listener
    useEffect(() => {
        if (!user?.isAdmin) return;

        const db   = getDatabase();
        const unsub = onValue(ref(db, "reservations"), (snap) => {
            const val = snap.val() as Record<string, {
                status: string;
                customerName?: string;
                date?: string;
                time?: string;
                endTime?: string;
                partySize?: number;
                tableId?: string;
                createdAt?: number;
            }> | null;

            if (!val) return;

            const pending = Object.entries(val)
                .filter(([, r]) => r.status === "pending")
                .sort(([, a], [, b]) => (b.createdAt || 0) - (a.createdAt || 0));

            const sig = pending.map(([id]) => id).join(",");

            if (!initRef.current) {
                prevSigRef.current = sig;
                initRef.current    = true;
                return;
            }

            if (sig === prevSigRef.current) return;
            prevSigRef.current = sig;

            if (pending.length === 0) return;

            const [, latest] = pending[0];

            setAlarm({
                open:         true,
                customerName: latest.customerName || "Müşteri",
                date:         latest.date         || "",
                time:         latest.time         || "",
                endTime:      latest.endTime,
                partySize:    latest.partySize    || 0,
                tableName:    latest.tableId,
            });

            playAlarm();
        });

        return () => unsub();
    }, [user?.isAdmin, playAlarm]);

    // ── Dismiss callbacks
    const handleDismiss = useCallback(() => {
        stopAlarm();
        setAlarm(INITIAL_ALARM);
    }, [stopAlarm]);

    const handleGoToReservations = useCallback(() => {
        stopAlarm();
        setAlarm(INITIAL_ALARM);
        window.location.href = "/admin/rezervasyonlar";
    }, [stopAlarm]);

    // ── Memoized chip data
    const chips = useMemo(() => [
        { label: alarm.customerName, color: "primary" as const },
        { label: formatDate(alarm.date) },
        { label: formatTime(alarm.time, alarm.endTime) },
        { label: `${alarm.partySize} kişi` },
    ], [alarm.customerName, alarm.date, alarm.time, alarm.endTime, alarm.partySize]);

    return (
        <Dialog open={alarm.open} maxWidth="xs" fullWidth>
            <DialogTitle>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <CalendarMonthIcon color="warning" />
                    <Typography fontWeight={700}>Yeni Rezervasyon Talebi</Typography>
                </Stack>
            </DialogTitle>
            <DialogContent>
                <Stack spacing={1.5}>
                    <Typography variant="body2" color="text.secondary">
                        Yeni bir rezervasyon talebi geldi.
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        {chips.map(({ label, color }) => (
                            <Chip
                                key={label}
                                label={label}
                                size="small"
                                color={color ?? "default"}
                            />
                        ))}
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
                <Button variant="outlined" onClick={handleDismiss}>
                    Kapat
                </Button>
                <Button variant="contained" color="warning" onClick={handleGoToReservations}>
                    Rezervasyonlara Git
                </Button>
            </DialogActions>
        </Dialog>
    );
};
