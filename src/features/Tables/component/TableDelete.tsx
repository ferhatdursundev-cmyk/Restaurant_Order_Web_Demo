import { Box, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { onValue, ref, remove } from "firebase/database";
import { db } from "../../../firebase/firebase.ts";
import { ConfirmDialog } from "../../../component";

type Props = {
    open: boolean;
    tableId: string;
    tableName: string;
    onClose: () => void;
    onSuccess: () => void;
};

export const TableDelete = ({ open, tableId, tableName, onClose, onSuccess }: Props) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
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
        onClose();
    }, [loading, onClose]);

    const handleDelete = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            await remove(ref(db, `tables/${tableId}`));
            await remove(ref(db, `tableSecrets/${tableId}`));
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
                setError("Silme başarısız. Lütfen tekrar deneyin.");
            }
        } finally {
            setLoading(false);
        }
    }, [tableId, onSuccess]);

    return (
        <ConfirmDialog
            open={open}
            onClose={handleClose}
            onConfirm={handleDelete}
            title="Masayı Sil"
            confirmText={loading ? "Siliniyor…" : "Evet, Sil"}
            cancelText="İptal"
            confirmDisabled={hasOrders || ordersLoading}
            busy={loading}
            maxWidth="xs"
        >
            {/* Sipariş uyarısı */}
            {hasOrders && !ordersLoading && (
                <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: "rgba(229,57,53,0.08)", border: "1px solid rgba(229,57,53,0.30)" }}>
                    <Typography sx={{ fontSize: 13, color: "error.main", fontWeight: 700 }}>
                        Bu masada aktif sipariş var. Masa silinemez.
                    </Typography>
                </Box>
            )}

            <Typography sx={{ fontSize: 14 }}>
                <b>{tableName}</b> masasını silmek istediğinize emin misiniz?
            </Typography>
            <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 1 }}>
                Bu işlem geri alınamaz. Masa ve QR bilgileri kalıcı olarak silinecek.
            </Typography>

            {error && (
                <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: "rgba(229,57,53,0.08)", border: "1px solid rgba(229,57,53,0.30)" }}>
                    <Typography sx={{ fontSize: 13, color: "error.main" }}>{error}</Typography>
                </Box>
            )}
        </ConfirmDialog>
    );
};
