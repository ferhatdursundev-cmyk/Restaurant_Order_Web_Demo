import { useAuth } from "../auth/aut.context.tsx";
import { useEffect, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "../firebase/firebase.ts";
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
} from "@mui/material";

// ── Tipler ───────────────────────────────────────────────────────────────────

type AlarmMode = "order" | "waiterCall";

interface AlarmState {
    open:    boolean;
    mode:    AlarmMode;
    message: string;
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

function isOrderNode(val: unknown): boolean {
    if (!val || typeof val !== "object") return false;
    const obj = val as Record<string, unknown>;
    return (
        "items"       in obj ||
        "total"       in obj ||
        "status"      in obj ||
        "createdAtMs" in obj ||
        "createdAt"   in obj
    );
}

function fmtTime(ms: number) {
    return new Date(ms).toLocaleTimeString("tr-TR", {
        hour:   "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

// ── Component ────────────────────────────────────────────────────────────────

export const GlobalOrderAlarm = () => {
    const { user } = useAuth();

    const [alarm, setAlarm] = useState<AlarmState>({
        open:    false,
        mode:    "order",
        message: "",
    });
    const [audioReady, setAudioReady] = useState(false);

    const previousOrderSigRef  = useRef<string>("");
    const previousWaiterSigRef = useRef<string>("");
    const orderInitRef         = useRef(false);
    const waiterInitRef        = useRef(false);
    const audioRef             = useRef<HTMLAudioElement | null>(null);

    // ── Audio init ───────────────────────────────────────────────────────────
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

    // ── Audio unlock (browser autoplay fix) ──────────────────────────────────
    useEffect(() => {
        const unlockAudio = async () => {
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

        window.addEventListener("click",      unlockAudio, { once: true });
        window.addEventListener("touchstart", unlockAudio, { once: true });

        return () => {
            window.removeEventListener("click",      unlockAudio);
            window.removeEventListener("touchstart", unlockAudio);
        };
    }, [audioReady]);

    // ── Ses çal yardımcısı ───────────────────────────────────────────────────
    const playAlarm = () => {
        if (audioRef.current && audioReady) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch((err) =>
                console.error("Alarm sesi çalınamadı:", err)
            );
        } else {
            console.warn("Audio hazır değil");
        }
    };

    // ── ORDER listener ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!user?.isAdmin) return;

        const unsub = onValue(
            ref(db, "ordersByTable"),
            (snap) => {
                const val = snap.val() ?? {};
                const signatures: string[] = [];

                Object.entries(val).forEach(([tableId, tableVal]) => {
                    if (!tableVal || typeof tableVal !== "object") return;

                    const tableObj = tableVal as Record<string, unknown>;

                    Object.entries(tableObj).forEach(([childKey, childVal]) => {
                        if (!childVal || typeof childVal !== "object") return;

                        if (isOrderNode(childVal)) {
                            signatures.push(`${tableId}/${childKey}`);
                            return;
                        }

                        const nestedObj = childVal as Record<string, unknown>;
                        Object.entries(nestedObj).forEach(([orderId, orderVal]) => {
                            if (isOrderNode(orderVal)) {
                                signatures.push(`${tableId}/${childKey}/${orderId}`);
                            }
                        });
                    });
                });

                signatures.sort();
                const nextSig  = signatures.join("|");
                const prevList = previousOrderSigRef.current
                    ? previousOrderSigRef.current.split("|").filter(Boolean)
                    : [];

                if (!orderInitRef.current) {
                    previousOrderSigRef.current = nextSig;
                    orderInitRef.current        = true;
                    return;
                }

                if (signatures.length > prevList.length) {
                    const newOnes = signatures.filter((x) => !prevList.includes(x));
                    const masa    = newOnes[0]?.split("/")[0] ?? "";

                    setAlarm({
                        open:    true,
                        mode:    "order",
                        message: masa
                            ? `Yeni sipariş geldi. Masa: ${masa}`
                            : "Yeni sipariş geldi.",
                    });
                    playAlarm();
                }

                previousOrderSigRef.current = nextSig;
            },
            (err) => console.error("ordersByTable read error:", err)
        );

        return () => unsub();
    }, [user?.isAdmin, audioReady]);

    // ── WAITER CALL listener ─────────────────────────────────────────────────
    useEffect(() => {
        if (!user?.isAdmin) return;

        const unsub = onValue(
            ref(db, "waiterCalls"),
            (snap) => {
                const val = snap.val() as Record<
                    string,
                    { type: string; requestedAt: number; tableName: string }
                > | null;

                const keys = val ? Object.keys(val).sort() : [];
                const nextSig = keys.join("|");

                if (!waiterInitRef.current) {
                    previousWaiterSigRef.current = nextSig;
                    waiterInitRef.current        = true;
                    return;
                }

                const prevKeys = previousWaiterSigRef.current
                    ? previousWaiterSigRef.current.split("|").filter(Boolean)
                    : [];

                const newKeys = keys.filter((k) => !prevKeys.includes(k));

                if (newKeys.length > 0 && val) {
                    const firstKey  = newKeys[0];
                    const call      = val[firstKey];
                    const typeLabel = call.type === "hesap" ? "Hesap" : "Garson";
                    const saat      = fmtTime(call.requestedAt);

                    setAlarm({
                        open:    true,
                        mode:    "waiterCall",
                        message: `${call.tableName} — ${typeLabel} çağrısı\n${saat}`,
                    });
                    playAlarm();
                }

                previousWaiterSigRef.current = nextSig;
            },
            (err) => console.error("waiterCalls read error:", err)
        );

        return () => unsub();
    }, [user?.isAdmin, audioReady]);

    // ── Kapat ────────────────────────────────────────────────────────────────
    const handleClose = () => {
        setAlarm((prev) => ({ ...prev, open: false }));
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────
    const title = alarm.mode === "waiterCall" ? "Garson Çağrısı" : "Yeni Sipariş";

    return (
        <Dialog open={alarm.open} onClose={() => {}} maxWidth="xs" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <Typography sx={{ whiteSpace: "pre-line" }}>
                    {alarm.message}
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button variant="contained" onClick={handleClose}>
                    Kapat
                </Button>
            </DialogActions>
        </Dialog>
    );
};