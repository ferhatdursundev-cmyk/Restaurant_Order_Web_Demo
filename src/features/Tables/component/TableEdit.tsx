import { Box, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { get, onValue, ref, remove, set } from "firebase/database";
import { db } from "../../../firebase/firebase.ts";
import { ConfirmDialog } from "../../../component";
import { TableQrCode } from "./TableQrCode.tsx";

type Props = {
    open: boolean;
    tableId: string;
    tableName: string;
    onClose: () => void;
    onSuccess: () => void;
};

export const TableEdit = ({ open, tableId, tableName, onClose, onSuccess }: Props) => {
    const currentNumber = tableId.replace(/^\D+/, "");

    const [newNumber, setNewNumber] = useState(currentNumber);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [savedQrKey, setSavedQrKey] = useState<string | null>(null);
    const [hasOrders, setHasOrders] = useState(false);
    const [ordersLoading, setOrdersLoading] = useState(true);

    useEffect(() => {
        if (!open) return;
        setOrdersLoading(true);

        const unsub = onValue(
            ref(db, `ordersByTable/${tableId}`),
            (snap) => {
                setHasOrders(snap.exists());
                setOrdersLoading(false);
            },
            () => {
                setHasOrders(false);
                setOrdersLoading(false);
            }
        );

        return () => unsub();
    }, [open, tableId]);

    const handleClose = useCallback(() => {
        if (loading) return;
        setError(null);
        setSuccess(null);
        setSavedQrKey(null);
        setNewNumber(currentNumber);
        onClose();
    }, [loading, currentNumber, onClose]);

    const handleSave = useCallback(async () => {
        const trimmed = newNumber.trim();

        if (!trimmed || !/^\d+$/.test(trimmed)) {
            setError("Lütfen geçerli bir masa numarası girin (sadece rakam).");
            return;
        }

        if (trimmed === currentNumber) {
            setError("Yeni numara mevcut numarayla aynı.");
            return;
        }

        const oldTableId = tableId;
        const newTableId = `t${trimmed}`;

        setLoading(true);
        setError(null);
        setSuccess(null);
        setSavedQrKey(null);

        try {
            // Yeni key zaten var mı?
            const existsSnap = await get(ref(db, `tables/${newTableId}`));
            if (existsSnap.exists()) {
                setError(`Masa ${trimmed} zaten mevcut. Farklı bir numara girin.`);
                return;
            }

            // Eski qrKey'i oku
            const secretSnap = await get(ref(db, `tableSecrets/${oldTableId}`));
            const oldQrKey: string = secretSnap.exists()
                ? (secretSnap.val()?.qrKey ?? "")
                : "";

            // qrKey prefix güncelle: "t1_k_xxx" → "t12_k_xxx"
            const updatedQrKey = oldQrKey.replace(/^t\d+_k_/, `${newTableId}_k_`);

            const now = new Date().toISOString();
            const numberAsInt = parseInt(trimmed, 10);

            // Yeni tables yaz
            await set(ref(db, `tables/${newTableId}`), {
                createdAt: now,
                id: newTableId,
                isOpen: false,
                name: `Masa ${trimmed}`,
                number: numberAsInt,
                updatedAt: now,
            });

            // Yeni tableSecrets yaz
            await set(ref(db, `tableSecrets/${newTableId}`), {
                qrKey: updatedQrKey,
            });

            // Eskileri sil
            await remove(ref(db, `tables/${oldTableId}`));
            await remove(ref(db, `tableSecrets/${oldTableId}`));

            setSavedQrKey(updatedQrKey);
            setSuccess(`Masa ${currentNumber} → Masa ${trimmed} olarak güncellendi.`);
            onSuccess();
        } catch (err: any) {
            console.log("ERROR CODE:", err?.code);
            console.log("ERROR MESSAGE:", err?.message);
            console.log("FULL ERROR:", err);

            const code = err?.code ?? "";
            if (code === "PERMISSION_DENIED" || code?.includes("permission")) {
                setError("Bu işlem için yetkiniz yok.");
            } else if (code === "NETWORK_ERROR" || err?.message?.includes("network")) {
                setError("Bağlantı hatası. İnternet bağlantınızı kontrol edin.");
            } else {
                setError("Güncelleme başarısız. Lütfen tekrar deneyin.");
            }
        } finally {
            setLoading(false);
        }
    }, [newNumber, currentNumber, tableId, onSuccess]);

    return (
        <ConfirmDialog
            open={open}
            onClose={handleClose}
            onConfirm={handleSave}
            title={`Masa Düzenle — ${tableName}`}
            confirmText={loading ? "Güncelleniyor…" : "Güncelle"}
            cancelText={success ? "Kapat" : "İptal"}
            confirmDisabled={!newNumber || !!success || hasOrders || ordersLoading}
            busy={loading}
            maxWidth="xs"
        >
            {/* Sipariş uyarısı */}
            {hasOrders && !ordersLoading && (
                <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: "rgba(229,57,53,0.08)", border: "1px solid rgba(229,57,53,0.30)" }}>
                    <Typography sx={{ fontSize: 13, color: "error.main", fontWeight: 700 }}>
                        Bu masada aktif sipariş var. Masa numarası değiştirilemez.
                    </Typography>
                </Box>
            )}

            <TextField
                label="Yeni Masa Numarası"
                placeholder={`Mevcut: ${currentNumber}`}
                value={newNumber}
                onChange={(e) => {
                    setNewNumber(e.target.value.replace(/\D/g, ""));
                    setError(null);
                    setSuccess(null);
                }}
                disabled={loading || hasOrders}
                inputProps={{ inputMode: "numeric", maxLength: 6 }}
                fullWidth
                size="small"
                sx={{
                    "& .MuiOutlinedInput-root": {
                        bgcolor: "rgba(0,0,0,0.04)",
                        "& fieldset": { borderColor: "divider" },
                        "&:hover fieldset": { borderColor: "text.secondary" },
                        "&.Mui-focused fieldset": { borderColor: "#FF7A00" },
                    },
                    "& .MuiInputLabel-root.Mui-focused": { color: "#FF7A00" },
                    input: { color: "text.primary" },
                }}
            />

            {/* Hata */}
            {error && (
                <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: "rgba(229,57,53,0.08)", border: "1px solid rgba(229,57,53,0.30)" }}>
                    <Typography sx={{ fontSize: 13, color: "error.main" }}>{error}</Typography>
                </Box>
            )}

            {/* Başarı */}
            {success && (
                <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.30)" }}>
                    <Typography sx={{ fontSize: 13, color: "success.main" }}>
                        {success}
                    </Typography>
                    {savedQrKey && (
                        <TableQrCode
                            tableId={`t${newNumber}`}
                            trimmed={newNumber}
                            qrKey={savedQrKey}
                        />
                    )}
                </Box>
            )}
        </ConfirmDialog>
    );
};
