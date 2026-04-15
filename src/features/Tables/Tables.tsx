import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
    Alert,
    Box,
    Card,
    CardActionArea,
    CardContent,
    Skeleton,
    Stack,
    Typography,
} from "@mui/material";
import { db } from "../../firebase/firebase";
import { ref, get, onValue } from "firebase/database";
import { TableOrdersDialog } from "./TableOrdersDialog";
import type { OrdersMap, SelectedTable } from "./utils";
import { TablesChange } from "./component/TablesChange.tsx";

type TableEntity = {
    id?: string;
    name?: string;
    number?: number;
    isOpen?: boolean;
    seats?: number;
    activeOrderId?: string;
    updatedAt?: string;
};

type TablesMap = Record<string, TableEntity>;

function asBool(v: unknown): boolean {
    return v === true || v === "true" || v === 1;
}

export const Tables = () => {
    const [data, setData] = useState<TablesMap | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const TABLES_PATH = "tables";

    // Orders dialog state
    const [ordersOpen, setOrdersOpen] = useState(false);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [ordersError, setOrdersError] = useState<string | null>(null);
    const [selectedTable, setSelectedTable] = useState<SelectedTable>(null);
    const [orders, setOrders] = useState<OrdersMap | null>(null);

    const [totalsByTable, setTotalsByTable] = useState<Record<string, number>>({});
    const [totalsLoading, setTotalsLoading] = useState(false);

    function sumTableTotalsFromNode(node: unknown): number {
        let sum = 0;

        const walk = (v: unknown) => {
            if (!v || typeof v !== "object") return;
            const obj = v as Record<string, unknown>;

            if (obj.total != null) {
                const n =
                    typeof obj.total === "number"
                        ? obj.total
                        : typeof obj.total === "string"
                            ? Number(obj.total)
                            : NaN;
                if (!Number.isNaN(n)) sum += n;
            }

            for (const child of Object.values(obj)) {
                if (child && typeof child === "object") walk(child);
            }
        };

        walk(node);
        return sum;
    }

    /**
     * TABLES realtime
     */
    useEffect(() => {
        setLoading(true);
        setError(null);

        const tablesRef = ref(db, TABLES_PATH);
        const unsub = onValue(
            tablesRef,
            (snap) => {
                const val = (snap.exists() ? snap.val() : null) as TablesMap | null;
                setData(val);
                setLoading(false);
            },
            () => {
                setError("Masalar okunamadı");
                setLoading(false);
            }
        );

        return () => unsub();
    }, []);

    const list = useMemo(() => {
        const arr = Object.entries(data ?? {}).map(([key, t]) => ({
            key,
            ...t,
            id: t.id ?? key,
            number:
                typeof t.number === "number"
                    ? t.number
                    : Number(String(t.number ?? "").replace(/\D/g, "")) || undefined,
            name: t.name ?? (t.number ? `Masa ${t.number}` : `Masa ${key}`),
            isOpen: asBool(t.isOpen),
        }));

        return arr.sort((a, b) => (a.number ?? 9999) - (b.number ?? 9999));
    }, [data]);

    /**
     * TOTALS realtime (her masa için)
     */
    const totalsUnsubsRef = useRef<Array<() => void>>([]);

    useEffect(() => {
        totalsUnsubsRef.current.forEach((u) => u());
        totalsUnsubsRef.current = [];

        if (list.length === 0) {
            setTotalsByTable({});
            setTotalsLoading(false);
            return;
        }

        setTotalsLoading(true);
        const remainingFirst = new Set(list.map((t) => String(t.id)));

        for (const t of list) {
            const tableId = String(t.id);
            const r = ref(db, `ordersByTable/${tableId}`);

            let gotFirst = false;

            const unsub = onValue(
                r,
                (snap) => {
                    const node = snap.exists() ? snap.val() : null;
                    const sum = sumTableTotalsFromNode(node);

                    setTotalsByTable((prev) => {
                        if (prev[tableId] === sum) return prev;
                        return { ...prev, [tableId]: sum };
                    });

                    if (!gotFirst) {
                        gotFirst = true;
                        remainingFirst.delete(tableId);
                        if (remainingFirst.size === 0) setTotalsLoading(false);
                    }
                },
                () => {
                    setTotalsByTable((prev) => ({ ...prev, [tableId]: 0 }));
                    if (!gotFirst) {
                        gotFirst = true;
                        remainingFirst.delete(tableId);
                        if (remainingFirst.size === 0) setTotalsLoading(false);
                    }
                }
            );

            totalsUnsubsRef.current.push(unsub);
        }

        return () => {
            totalsUnsubsRef.current.forEach((u) => u());
            totalsUnsubsRef.current = [];
        };
    }, [list]);

    /**
     * Dialog açınca ilk veriyi hızlı çek (mevcut mantık)
     */
    const openTableOrders = useCallback(async (tableId: string, tableName: string) => {
        setSelectedTable({ id: tableId, name: tableName });
        setOrdersOpen(true);
        setOrders(null);
        setOrdersError(null);
        setOrdersLoading(true);

        try {
            const snap = await get(ref(db, `ordersByTable/${tableId}`));
            const val = (snap.exists() ? snap.val() : null) as OrdersMap | null;
            setOrders(val);
        } catch {
            setOrdersError("Siparişler okunamadı");
        } finally {
            setOrdersLoading(false);
        }
    }, []);

    /**
     *  Dialog açıkken siparişleri canlı dinle
     */
    useEffect(() => {
        // dialog kapalıysa veya table seçili değilse dinleme yok
        if (!ordersOpen || !selectedTable?.id) return;

        const tableId = String(selectedTable.id);
        const ordersRef = ref(db, `ordersByTable/${tableId}`);

        // İlk realtime snapshot gelene kadar (get sonrası) loading’i tekrar yakma:
        let gotFirst = false;

        const unsub = onValue(
            ordersRef,
            (snap) => {
                gotFirst = true;
                const val = (snap.exists() ? snap.val() : null) as OrdersMap | null;
                setOrders(val);
                // dialog açıkken permission yok vs durumlarında error’u temizlemek iyi olur
                setOrdersError(null);
            },
            () => {
                // permission / network vb.
                setOrdersError("Siparişler okunamadı");
                // orders’u sıfırlamıyoruz; kullanıcı son gördüğünü görmeye devam etsin
            }
        );

        // Eğer dialog açıldı ama realtime daha gelmediyse (çok kısa) loading’i koru
        const t = setTimeout(() => {
            if (!gotFirst) setOrdersLoading((prev) => prev); // dokunmuyoruz; openTableOrders zaten set etti
        }, 0);

        return () => {
            clearTimeout(t);
            unsub();
        };
    }, [ordersOpen, selectedTable?.id]);

    async function handleCloseOrdersDialog() {
        setOrdersOpen(false);
    }

    async function handleTablesChangeAfterClose() {
        // tables realtime
    }

    return (
        <Box sx={{ pb: 4 }}>
            <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, md: 3 }, pt: 2 }}>
                {error && <Alert severity="error">Hata: {error}</Alert>}

                {!error && !loading && list.length === 0 && (
                    <Alert severity="info">
                        Henüz masa yok. RTDB’de <b>{TABLES_PATH}</b> altında masaları ekleyebilirsin.
                    </Alert>
                )}

                <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ mt: 1.5, alignItems: { sm: "center" }, justifyContent: "space-between" }}
                >
                    <TablesChange loading={loading} list={list} onAfterClose={handleTablesChangeAfterClose} />
                </Stack>

                <Box
                    sx={{
                        mt: 2,
                        display: "grid",
                        gap: 2,
                        gridTemplateColumns: {
                            xs: "repeat(2, minmax(0, 1fr))",
                            sm: "repeat(3, minmax(0, 1fr))",
                            md: "repeat(4, minmax(0, 1fr))",
                            lg: "repeat(5, minmax(0, 1fr))",
                            xl: "repeat(6, minmax(0, 1fr))",
                        },
                    }}
                >
                    {loading
                        ? Array.from({ length: 12 }).map((_, i) => (
                            <Card key={i} sx={{ borderRadius: 4, overflow: "hidden" }}>
                                <CardContent>
                                    <Skeleton width="60%" />
                                    <Skeleton width="40%" />
                                    <Skeleton width="70%" />
                                </CardContent>
                            </Card>
                        ))
                        : list.map((t) => {
                            const total = totalsByTable[String(t.id)] ?? 0;
                            const hasTotal = total > 0;

                            return (
                                <Card
                                    key={t.key}
                                    sx={{
                                        minHeight: 120,
                                        borderRadius: 4,
                                        border: "2px solid",
                                        borderColor: hasTotal ? "error.main" : "success.main",
                                        overflow: "hidden",
                                        background: hasTotal
                                            ? "linear-gradient(180deg, rgba(244,67,54,0.10), rgba(244,67,54,0.03))"
                                            : "linear-gradient(180deg, rgba(76,175,80,0.10), rgba(76,175,80,0.03))",
                                        transition: "transform 140ms ease, box-shadow 140ms ease",
                                        "&:hover": {
                                            transform: "translateY(-3px)",
                                            boxShadow: "0 18px 60px rgba(0,0,0,0.12)",
                                        },
                                    }}
                                >
                                    <CardActionArea
                                        onClick={() => openTableOrders(String(t.id), String(t.name))}
                                        sx={{
                                            p: 0,
                                            height: "100%",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <CardContent
                                            sx={{
                                                width: "100%",
                                                textAlign: "center",
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                gap: 0.75,
                                                minHeight: 120,
                                            }}
                                        >
                                            <Typography sx={{ fontWeight: 950, fontSize: 20, lineHeight: 1.1 }}>
                                                {t.name}
                                            </Typography>

                                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                                ID: {t.id}
                                            </Typography>

                                            <Typography
                                                variant="caption"
                                                sx={{
                                                    color: hasTotal ? "error.main" : "success.main",
                                                    fontWeight: 800,
                                                }}
                                            >
                                                TOPLAM: {totalsLoading ? "…" : `${(total)} TL`}
                                            </Typography>
                                        </CardContent>
                                    </CardActionArea>
                                </Card>
                            );
                        })}
                </Box>
            </Box>

            <TableOrdersDialog
                open={ordersOpen}
                onClose={handleCloseOrdersDialog}
                table={selectedTable}
                loading={ordersLoading}
                error={ordersError}
                orders={orders}
            />
        </Box>
    );
};