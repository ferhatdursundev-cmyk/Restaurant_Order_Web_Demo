import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    Skeleton,
    Stack,
    Typography,
    Pagination,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import { onValue, ref, update } from "firebase/database";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../auth/aut.context";

import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
    useDroppable,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { OrderReadyDialog } from "../../component";
import { asBool, playOrderAlarm } from "../../utils";

type RawOrder = {
    status?: string;
    createdAtMs?: number;
    statusUpdatedAtMs?: number;
    publicOrderNo?: number | string;
};

type OrdersMap = Record<string, RawOrder>;
type ColumnKey = "preparing" | "ready";

const PAGE_SIZE = 7;

function getOrderLabel(n: unknown) {
    if (n === null || n === undefined) return "—";
    const text = String(n).trim();
    return text || "—";
}

function normalizeStatus(s?: string): ColumnKey {
    return s === "ready" ? "ready" : "preparing";
}

function SortableOrderCard({
                               id,
                               label,
                               disabled,
                               highlight = false,
                           }: {
    id: string;
    label: string;
    disabled: boolean;
    highlight?: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        disabled,
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
    };

    return (
        <Card
            ref={setNodeRef}
            style={style}
            variant="outlined"
            sx={{
                borderRadius: 2.5,
                borderColor: highlight ? "success.main" : "divider",
                bgcolor: highlight ? "rgba(46,125,50,0.12)" : "background.paper",
                boxShadow: isDragging
                    ? "0 18px 50px rgba(0,0,0,0.18)"
                    : highlight
                        ? "0 0 0 2px rgba(46,125,50,0.18)"
                        : "none",
                cursor: disabled ? "default" : "grab",
                "&:active": { cursor: disabled ? "default" : "grabbing" },
                userSelect: "none",
                transition: "background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
            }}
            {...attributes}
            {...(!disabled ? listeners : {})}
        >
            <CardContent sx={{ py: 1.2, px: 1.5 }}>
                <Typography
                    sx={{
                        fontWeight: 950,
                        color: highlight ? "success.dark" : "text.primary",
                        fontSize: { xs: 28, sm: 34, md: 40 },
                        lineHeight: 1.05,
                        textAlign: "center",
                        letterSpacing: 0.6,
                    }}
                    noWrap
                >
                    {label}
                </Typography>
            </CardContent>
        </Card>
    );
}

function DroppableColumn({
                             id,
                             title,
                             loading,
                             items,
                             canEdit,
                             orders,
                             highlightedOrderId,
                             page,
                             pageCount,
                             onPageChange,
                         }: {
    id: ColumnKey;
    title: string;
    loading: boolean;
    items: string[];
    canEdit: boolean;
    orders: OrdersMap | null;
    highlightedOrderId?: string | null;

    page: number;
    pageCount: number;
    onPageChange: (nextPage: number) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({ id });

    return (
        <Card
            ref={setNodeRef}
            variant="outlined"
            sx={{
                borderRadius: 3,
                borderColor: isOver ? "#FF7A00" : "divider",
                bgcolor: isOver ? "rgba(255,122,0,0.05)" : "transparent",
                transition: "border-color 120ms ease, background 120ms ease",
                textAlign: "center",
            }}
        >
            <CardContent sx={{ display: "grid", gap: 1, minHeight: 260 }}>
                <Typography
                    sx={{
                        fontWeight: 950,
                        fontSize: { xs: 20, sm: 24 },
                        textAlign: "center",
                        letterSpacing: 0.6,
                        color: id === "ready" ? "success.main" : "warning.main",
                    }}
                >
                    {title.toUpperCase()}
                </Typography>

                <Divider />

                {loading ? (
                    <Stack spacing={1}>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton key={i} height={14} />
                        ))}
                    </Stack>
                ) : items.length === 0 ? (
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Sipariş yok.
                    </Typography>
                ) : (
                    <SortableContext items={items} strategy={verticalListSortingStrategy}>
                        <Stack spacing={1}>
                            {items.map((orderId) => {
                                const label = getOrderLabel(orders?.[orderId]?.publicOrderNo);

                                return (
                                    <SortableOrderCard
                                        key={orderId}
                                        id={orderId}
                                        label={label}
                                        disabled={!canEdit}
                                        highlight={id === "ready" && highlightedOrderId === orderId}
                                    />
                                );
                            })}
                        </Stack>
                    </SortableContext>
                )}

                {pageCount > 1 && (
                    <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
                        <Pagination
                            count={pageCount}
                            page={page}
                            onChange={(_, val) => onPageChange(val)}
                            size="small"
                            color={id === "ready" ? "primary" : "secondary"}
                            sx={{
                                "& .MuiPaginationItem-root.Mui-selected": {
                                    bgcolor: id === "ready" ? "success.main" : "warning.main",
                                    color: "common.white",
                                },
                                "& .MuiPaginationItem-root.Mui-selected:hover": {
                                    bgcolor: id === "ready" ? "success.dark" : "warning.dark",
                                },
                            }}
                        />
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}

export const ToGoPage = () => {
    const { user } = useAuth();

    const canUse =
        (user?.isAdmin === true || user?.userType === "admin" || user?.userType === "garson") &&
        !asBool((user as any)?.isToGoAdmin);

    const canEdit = canUse;

    const [orders, setOrders] = useState<OrdersMap | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const [readyDialogOpen, setReadyDialogOpen] = useState(false);
    const [readyDialogLabel, setReadyDialogLabel] = useState<string>("—");

    const [highlightedReadyOrderId, setHighlightedReadyOrderId] = useState<string | null>(null);
    const [pendingHighlightOrderId, setPendingHighlightOrderId] = useState<string | null>(null);

    const [preparingPage, setPreparingPage] = useState(1);
    const [readyPage, setReadyPage] = useState(1);

    const [autoPagingPreparing, setAutoPagingPreparing] = useState(true);
    const [autoPagingReady, setAutoPagingReady] = useState(true);

    const alarmAudioRef = useRef<HTMLAudioElement | null>(null);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    useEffect(() => {
        alarmAudioRef.current = new Audio("/order_alarm.mp3");
        alarmAudioRef.current.preload = "auto";

        return () => {
            if (alarmAudioRef.current) {
                alarmAudioRef.current.pause();
                alarmAudioRef.current.currentTime = 0;
            }
        };
    }, []);



    useEffect(() => {
        if (!canUse) return;

        const r = ref(db, "ordersByTable/t999");
        const unsub = onValue(
            r,
            (snap) => {
                const val = (snap.exists() ? snap.val() : null) as OrdersMap | null;

                setOrders(val);
                setLoading(false);
                setErr(null);

                const o = val ?? {};
                const entries = Object.entries(o)
                    .filter(([, v]) => v && typeof v === "object")
                    .map(([id, data]) => ({ id, ...(data as RawOrder) }));

                const prepCount = entries.filter((e) => normalizeStatus(e.status) === "preparing").length;
                const readyCount = entries.filter((e) => normalizeStatus(e.status) === "ready").length;

                const nextPreparingPageCount = Math.max(1, Math.ceil(prepCount / PAGE_SIZE));
                const nextReadyPageCount = Math.max(1, Math.ceil(readyCount / PAGE_SIZE));

                setPreparingPage((p) => (p > nextPreparingPageCount ? 1 : p));
                setReadyPage((p) => (p > nextReadyPageCount ? 1 : p));
            },
            () => {
                setErr("Siparişler okunamadı");
                setLoading(false);
            }
        );

        return () => unsub();
    }, [canUse]);

    const { preparingIds, readyIds } = useMemo(() => {
        const o = orders ?? {};
        const entries = Object.entries(o)
            .filter(([, v]) => v && typeof v === "object")
            .map(([id, data]) => ({ id, ...(data as RawOrder) }));

        const prep = entries
            .filter((e) => normalizeStatus(e.status) === "preparing")
            .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))
            .map((e) => e.id);

        const ready = entries
            .filter((e) => normalizeStatus(e.status) === "ready")
            .sort((a, b) => (b.statusUpdatedAtMs ?? b.createdAtMs ?? 0) - (a.statusUpdatedAtMs ?? a.createdAtMs ?? 0))
            .map((e) => e.id);

        return { preparingIds: prep, readyIds: ready };
    }, [orders]);

    const preparingPageCount = Math.max(1, Math.ceil(preparingIds.length / PAGE_SIZE));
    const readyPageCount = Math.max(1, Math.ceil(readyIds.length / PAGE_SIZE));

    useEffect(() => {
        if (!canUse) return;
        if (!autoPagingPreparing) return;
        if (preparingPageCount <= 1) return;

        const t = window.setInterval(() => {
            setPreparingPage((p) => (p >= preparingPageCount ? 1 : p + 1));
        }, 10000);

        return () => window.clearInterval(t);
    }, [canUse, autoPagingPreparing, preparingPageCount]);

    useEffect(() => {
        if (!canUse) return;
        if (!autoPagingReady) return;
        if (readyPageCount <= 1) return;

        const t = window.setInterval(() => {
            setReadyPage((p) => (p >= readyPageCount ? 1 : p + 1));
        }, 10000);

        return () => window.clearInterval(t);
    }, [canUse, autoPagingReady, readyPageCount]);

    const preparingPagedIds = useMemo(() => {
        const start = (preparingPage - 1) * PAGE_SIZE;
        return preparingIds.slice(start, start + PAGE_SIZE);
    }, [preparingIds, preparingPage]);

    const readyPagedIds = useMemo(() => {
        const start = (readyPage - 1) * PAGE_SIZE;
        return readyIds.slice(start, start + PAGE_SIZE);
    }, [readyIds, readyPage]);

    function findContainer(id: string): ColumnKey | null {
        if (id === "preparing" || id === "ready") return id;
        if (preparingIds.includes(id)) return "preparing";
        if (readyIds.includes(id)) return "ready";
        return null;
    }

    const updateStatus = async (orderId: string, next: ColumnKey) => {
        await update(ref(db, `ordersByTable/t999/${orderId}`), {
            status: next,
            statusUpdatedAtMs: Date.now(),
        });
    };

    const onDragEnd = async (event: DragEndEvent) => {
        if (!canEdit) return;

        const { active, over } = event;
        if (!over) return;

        const activeId = String(active.id);
        const overId = String(over.id);

        const from = findContainer(activeId);
        const to = findContainer(overId);

        if (!from || !to) return;
        if (from === to) return;

        try {
            await updateStatus(activeId, to);

            if (from === "preparing" && to === "ready") {
                const label = getOrderLabel(orders?.[activeId]?.publicOrderNo);

                await playOrderAlarm();

                setReadyDialogLabel(label);
                setPendingHighlightOrderId(activeId);
                setReadyDialogOpen(true);
            }
        } catch {
            // RTDB sync toparlar
        }
    };

    if (!canUse) {
        return (
            <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, md: 3 }, py: 3 }}>
                <Alert severity="warning">
                    Bu sayfaya erişim yok. (Sadece Admin/Garson ve <b>isToGoAdmin ≠ true</b>)
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, md: 3 }, py: 3 }}>
            <Stack spacing={1.2} sx={{ mb: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap">
                    <Typography sx={{ fontWeight: 950, fontSize: 22 }}>Paket</Typography>
                    <Chip size="small" label="Sürükle-bırak aktif" color="success" variant="outlined" />
                </Stack>
            </Stack>

            {err && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {err}
                </Alert>
            )}

            <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ mb: 1 }}>
                <Button
                    size="small"
                    variant={autoPagingPreparing ? "outlined" : "contained"}
                    startIcon={autoPagingPreparing ? <PauseIcon /> : <PlayArrowIcon />}
                    onClick={() => setAutoPagingPreparing((v) => !v)}
                >
                    {autoPagingPreparing ? "Hazırlanıyor Otomatik: Açık" : "Hazırlanıyor Otomatik: Kapalı"}
                </Button>

                <Button
                    size="small"
                    variant={autoPagingReady ? "outlined" : "contained"}
                    startIcon={autoPagingReady ? <PauseIcon /> : <PlayArrowIcon />}
                    onClick={() => setAutoPagingReady((v) => !v)}
                >
                    {autoPagingReady ? "Hazır Otomatik: Açık" : "Hazır Otomatik: Kapalı"}
                </Button>
            </Stack>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                        gap: 2,
                        alignItems: "start",
                    }}
                >
                    <DroppableColumn
                        id="preparing"
                        title="Hazırlanıyor"
                        loading={loading}
                        items={preparingPagedIds}
                        canEdit={canEdit}
                        orders={orders}
                        highlightedOrderId={null}
                        page={preparingPage}
                        pageCount={preparingPageCount}
                        onPageChange={(p) => {
                            setPreparingPage(p);
                            setAutoPagingPreparing(false);
                        }}
                    />

                    <DroppableColumn
                        id="ready"
                        title="Hazır"
                        loading={loading}
                        items={readyPagedIds}
                        canEdit={canEdit}
                        orders={orders}
                        highlightedOrderId={highlightedReadyOrderId}
                        page={readyPage}
                        pageCount={readyPageCount}
                        onPageChange={(p) => {
                            setReadyPage(p);
                            setAutoPagingReady(false);
                        }}
                    />
                </Box>
            </DndContext>

            <OrderReadyDialog
                open={readyDialogOpen}
                orderLabel={readyDialogLabel}
                onClose={() => {
                    setReadyDialogOpen(false);

                    if (pendingHighlightOrderId) {
                        const orderId = pendingHighlightOrderId;
                        setPendingHighlightOrderId(null);
                        setHighlightedReadyOrderId(orderId);

                        window.setTimeout(() => {
                            setHighlightedReadyOrderId((current) => (current === orderId ? null : current));
                        }, 10000);
                    }
                }}
                durationMs={7000}
            />
        </Box>
    );
};