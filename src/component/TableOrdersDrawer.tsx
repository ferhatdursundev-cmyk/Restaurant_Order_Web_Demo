import { useEffect, useMemo, useState } from "react";
import {
    Box,
    Divider,
    Drawer,
    IconButton,
    Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { onValue, ref } from "firebase/database";
import { useLanguage } from "../i18n";
import { db } from "../firebase/firebase.ts";

type Props = {
    open: boolean;
    onClose: () => void;
};

function formatPriceTRY(value: number) {
    return `${new Intl.NumberFormat("tr-TR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value)} ₺`;
}

function resolveTableId(): string | null {
    const storedId = localStorage.getItem("activeTableId");
    if (storedId) return storedId;

    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith("tableToken:")) {
            return key.replace("tableToken:", "");
        }
    }

    return null;
}

export function TableOrdersDrawer({ open, onClose }: Props) {
    const { t } = useLanguage();
    const h = t.header;

    const tableId = useMemo(() => {
        if (!open) return null;
        return resolveTableId();
    }, [open]);

    const [ordersByTable, setOrdersByTable] = useState<Record<string, any>>({});

    useEffect(() => {
        if (!open || !tableId) return;

        const dbRef = ref(db, `ordersByTable/${tableId}`);

        const unsub = onValue(dbRef, (snapshot) => {
            setOrdersByTable(snapshot.val() || {});
        });

        return () => unsub();
    }, [open, tableId]);

    const orders = Object.entries(ordersByTable).sort(([, a], [, b]) => {
        const aMs = a?.createdAtMs ?? a?.createdAt ?? 0;
        const bMs = b?.createdAtMs ?? b?.createdAt ?? 0;
        return bMs - aMs;
    });

    const grandTotal = orders.reduce((sum, [, orderData]) => {
        return sum + Number(orderData?.total ?? 0);
    }, 0);

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    height: "90vh",
                    maxHeight: "90vh",
                    px: 0,
                    overflowY: "auto",
                },
            }}
        >
            <Box sx={{ display: "flex", justifyContent: "center", pt: 1.25, pb: 0.5 }}>
                <Box sx={{ width: 36, height: 4, borderRadius: 999, bgcolor: "divider" }} />
            </Box>

            <Box
                sx={{
                    px: 2.5,
                    py: 1.25,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <ReceiptLongIcon sx={{ color: "#FF7A00", fontSize: 20 }} />
                    <Typography sx={{ fontWeight: 900, fontSize: 16 }}>
                        {h.sentOrders ?? "Kasaya Gönderilen Siparişler"}
                    </Typography>
                </Box>

                <IconButton size="small" onClick={onClose}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>

            <Box
                sx={{
                    mx: 2,
                    mt: 2,
                    mb: 1,
                    px: 2,
                    py: 1.5,
                    borderRadius: 3,
                    bgcolor: "rgba(255,122,0,0.08)",
                    border: "1px solid rgba(255,122,0,0.25)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                    Genel Toplam
                </Typography>
                <Typography sx={{ fontWeight: 900, fontSize: 18, color: "#FF7A00" }}>
                    {formatPriceTRY(grandTotal)}
                </Typography>
            </Box>

            <Box
                sx={{
                    px: 2,
                    py: 2,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                }}
            >
                {!tableId && (
                    <Typography sx={{ textAlign: "center", color: "text.secondary", py: 4 }}>
                        Aktif masa bulunamadı.
                    </Typography>
                )}

                {tableId && orders.length === 0 && (
                    <Typography sx={{ textAlign: "center", color: "text.secondary", py: 4 }}>
                        Bu masaya henüz sipariş gönderilmemiş.
                    </Typography>
                )}

                {orders.map(([orderId, orderData]) => (
                    <Box
                        key={orderId}
                        sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 3,
                            overflow: "hidden",
                            bgcolor: "background.paper",
                        }}
                    >
                        <Box
                            sx={{
                                px: 2,
                                py: 1.5,
                                display: "flex",
                                flexDirection: "column",
                                gap: 1,
                            }}
                        >
                            {orderData?.items?.map((item: any, index: any) => {
                                return (
                                    <Box
                                        key={index}
                                        sx={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            gap: 1,
                                        }}
                                    >
                                        <Box sx={{ flex: 1 }}>
                                            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                                                {item.title}
                                            </Typography>

                                            {!!item.note && (
                                                <Typography
                                                    sx={{
                                                        fontSize: 12,
                                                        color: "text.secondary",
                                                    }}
                                                >
                                                    {item.note}
                                                </Typography>
                                            )}
                                        </Box>

                                        <Typography
                                            sx={{
                                                fontSize: 14,
                                                fontWeight: 800,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {item.qty ?? 1} x {formatPriceTRY(item.unitPrice ?? 0)}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>

                        <Divider />

                        <Box
                            sx={{
                                px: 2,
                                py: 1,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <Typography sx={{ fontSize: 12, color: "text.secondary", fontWeight: 600 }}>
                                Toplam
                            </Typography>
                            <Typography sx={{ fontSize: 15, fontWeight: 900, color: "#FF7A00" }}>
                                {formatPriceTRY(orderData?.total ?? 0)}
                            </Typography>
                        </Box>
                    </Box>
                ))}

                <Box sx={{ height: "10vh" }} />
            </Box>
        </Drawer>
    );
}