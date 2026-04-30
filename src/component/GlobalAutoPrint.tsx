import { useEffect, useRef } from "react";
import {
    onValue,
    onChildAdded,
    ref,
    update,
    runTransaction,
    get,
    type Unsubscribe,
} from "firebase/database";
import { db } from "../firebase/firebase";

export type PrintItem = {
    title: string;
    qty: number;
    note?: string;
    lineTotal: number;
    selectedOptions?: string[];
};
type AnyOrderItem = {
    title?: string;
    productId?: string;
    qty?: number;
    unitPrice?: number;
    note?: string;
    price?: number;
    selectedOptions?: string[];
};

function normalizeItems(order: any): PrintItem[] {
    const rawItemsArr = Array.isArray(order?.itemsArr)
        ? order.itemsArr
        : order?.items && typeof order.items === "object"
            ? Object.values(order.items)
            : [];

    return (rawItemsArr as AnyOrderItem[]).map((it) => {
        const qty = Number(it?.qty ?? 1);
        const unit =
            typeof it?.unitPrice === "number"
                ? it.unitPrice
                : typeof it?.price === "number"
                    ? it.price
                    : 0;

        return {
            title: it?.title ?? it?.productId ?? "Ürün",
            qty,
            note: it?.note ?? "",
            lineTotal: unit * qty,
            selectedOptions: Array.isArray(it?.selectedOptions) ? it.selectedOptions : undefined,
        };
    });
}

async function isPrintAgentReady() {
    try {
        const res = await fetch("http://127.0.0.1:43125/health");
        const json = await res.json();
        return !!json?.ok;
    } catch {
        return false;
    }
}

async function fetchTableNameMap(): Promise<Record<string, string>> {
    try {
        const snap = await get(ref(db, "tables"));
        const val = snap.val() || {};
        const map: Record<string, string> = {};
        for (const [id, data] of Object.entries(val)) {
            const name = (data as any)?.name;
            if (name) map[id] = String(name);
        }
        return map;
    } catch {
        return {};
    }
}

export function GlobalAutoPrint() {
    const knownOrdersRef = useRef<Set<string>>(new Set());
    const tableUnsubsRef = useRef<Map<string, Unsubscribe>>(new Map());
    const tableNameMapRef = useRef<Record<string, string>>({});

    useEffect(() => {
        fetchTableNameMap().then((map) => {
            tableNameMapRef.current = map;
        });

        const rootRef = ref(db, "ordersByTable");

        const seedUnsub = onValue(
            rootRef,
            (snapshot) => {
                const data = snapshot.val() || {};

                Object.entries(data).forEach(([tableId, orders]: any) => {
                    if (!orders || typeof orders !== "object") return;

                    Object.keys(orders).forEach((orderId) => {
                        knownOrdersRef.current.add(`${tableId}__${orderId}`);
                    });
                });

                seedUnsub();

                const rootChildUnsub = onChildAdded(rootRef, (tableSnap) => {
                    const tableId = tableSnap.key;
                    if (!tableId) return;

                    if (tableUnsubsRef.current.has(tableId)) return;

                    const tableRef = ref(db, `ordersByTable/${tableId}`);

                    const tableUnsub = onChildAdded(tableRef, async (orderSnap) => {
                        const orderId = orderSnap.key;
                        if (!orderId) return;

                        const uniqueId = `${tableId}__${orderId}`;

                        if (knownOrdersRef.current.has(uniqueId)) return;
                        knownOrdersRef.current.add(uniqueId);

                        const orderRef = ref(db, `ordersByTable/${tableId}/${orderId}`);
                        const order = orderSnap.val();

                        if (!order) return;
                        if (order.printed === true) return;
                        if (order.printStarted === true) return;

                        const agentReady = await isPrintAgentReady();
                        if (!agentReady) {
                            await update(orderRef, {
                                printStarted: false,
                                printError: "Print Agent çalışmıyor",
                                printErrorAt: Date.now(),
                            });
                            return;
                        }

                        const lockResult = await runTransaction(orderRef, (current) => {
                            if (!current) return current;
                            if (current.printed === true) return current;
                            if (current.printStarted === true) return current;

                            return {
                                ...current,
                                printStarted: true,
                                printStartedAt: Date.now(),
                            };
                        });

                        if (!lockResult.committed) return;

                        const lockedOrder = lockResult.snapshot.val();
                        if (!lockedOrder) return;
                        if (lockedOrder.printed === true) return;

                        const items = normalizeItems(lockedOrder);

                        if (items.length === 0) {
                            await update(orderRef, {
                                printStarted: false,
                                printError: "Yazdırılacak ürün bulunamadı",
                                printErrorAt: Date.now(),
                            });
                            return;
                        }

                        const total = items.reduce(
                            (sum, x) => sum + (Number(x.lineTotal) || 0),
                            0
                        );

                        const tableName =
                            lockedOrder?.tableName ||
                            lockedOrder?.table ||
                            tableNameMapRef.current[tableId] ||
                            tableId;

                        try {
                            const payload = {
                                orderId,
                                tableName,
                                customerName: lockedOrder?.customerName || null,
                                customerPhone: lockedOrder?.customerPhone || null,
                                paymentMethod: lockedOrder?.paymentMethod || null,
                                items,
                                total,
                            };

                            for (let i = 0; i < 2; i++) {
                                const res = await fetch(
                                    "http://127.0.0.1:43125/print/receipt",
                                    {
                                        method: "POST",
                                        headers: {
                                            "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify(payload),
                                    }
                                );

                                const json = await res.json().catch(() => null);

                                if (!res.ok || !json?.ok) {
                                    throw new Error(
                                        `${i + 1}. çıktı yazdırılamadı: ${json?.error || "Yazdırma başarısız"}`
                                    );
                                }
                            }

                            await update(orderRef, {
                                printed: true,
                                printedAt: Date.now(),
                                printStarted: false,
                                printError: null,
                            });
                        } catch (err: any) {
                            console.error("Otomatik yazdırma hatası:", err);

                            await update(orderRef, {
                                printStarted: false,
                                printError: String(
                                    err?.message || err || "Yazdırma başarısız"
                                ),
                                printErrorAt: Date.now(),
                            });
                        }
                    });

                    tableUnsubsRef.current.set(tableId, tableUnsub);
                });

                tableUnsubsRef.current.set("__root__", rootChildUnsub);
            },
            { onlyOnce: true }
        );

        return () => {
            try {
                seedUnsub();
            } catch {
                //
            }

            tableUnsubsRef.current.forEach((unsub) => {
                try {
                    unsub();
                } catch {
                    //
                }
            });

            tableUnsubsRef.current.clear();
        };
    }, []);

    return null;
}