import type React from "react";
import type { OrdersMap, SelectedTable } from "./orderTypes";

import { getFunctions, httpsCallable } from "firebase/functions";
import { v4 as uuid } from "uuid";

type OrderItem = {
    cartId?: string;
    productId?: string;
    title?: string;
    qty?: number;
    unitPrice?: number;
    image?: string;
    note?: string;
};

type OrderEntity = {
    createdAtMs?: number;
    status?: string;
    source?: string;
    total?: number;
    items?: Record<string, OrderItem> | OrderItem[];
};

function toItemsArray(items?: OrderEntity["items"]): OrderItem[] {
    if (!items) return [];
    if (Array.isArray(items)) return items.filter(Boolean);
    return Object.values(items).filter(Boolean);
}

function calcTotalFromItems(items: OrderItem[]) {
    return items.reduce((sum, it) => {
        const qty = it?.qty ?? 1;
        const p = typeof it?.unitPrice === "number" ? it.unitPrice : 0;
        return sum + qty * p;
    }, 0);
}

// RTDB’de items alanı bazen array bazen object ise: tipini koruyarak yaz
function normalizeItemsForWrite(nextArr: OrderItem[], orig?: OrderEntity["items"]) {
    if (!orig) return nextArr;
    if (Array.isArray(orig)) return nextArr;

    const keys = Object.keys(orig);
    const out: Record<string, OrderItem> = {};
    nextArr.forEach((it, idx) => {
        const k = keys[idx] ?? String(idx);
        out[k] = it;
    });
    return out;
}

type PaySelectedArgs = {
    table: SelectedTable;
    selected: Record<string, true>;
    localOrders: OrdersMap | null;

    setLocalOrders: React.Dispatch<React.SetStateAction<OrdersMap | null>>;
    setSelected: React.Dispatch<React.SetStateAction<Record<string, true>>>;
};

type PaySelectionResult = Readonly<{
    ok: boolean;
    already?: boolean;
    removedOrders?: string[];
    updatedOrders?: Array<{
        orderId: string;
        total: number;
        items: unknown;
    }>;
}>;

export const handlePaySelected = async ({
                                            table,
                                            selected,
                                            localOrders,
                                            setLocalOrders,
                                            setSelected,
                                        }: PaySelectedArgs) => {
    if (!table?.id) return;

    // 1) seçilen order'ları topla (orderId bazlı)
    const selectedOrderIds = new Set<string>();
    Object.keys(selected).forEach((k) => {
        if (k.startsWith("order:")) selectedOrderIds.add(k.slice("order:".length));
    });

    // 2) item seçimlerini orderId -> cartId set olarak topla
    const selectedItemsByOrder = new Map<string, Set<string>>();
    Object.keys(selected).forEach((k) => {
        if (!k.startsWith("item:")) return;
        // item:orderId:cartId
        const parts = k.split(":");
        if (parts.length !== 3) return;
        const orderId = parts[1];
        const cartId = parts[2];
        if (!selectedItemsByOrder.has(orderId)) selectedItemsByOrder.set(orderId, new Set<string>());
        selectedItemsByOrder.get(orderId)!.add(cartId);
    });

    // hiçbir seçim yoksa çık
    if (selectedOrderIds.size === 0 && selectedItemsByOrder.size === 0) return;

    // Bu blok: senin eski 4. adımındaki hesap mantığını KORUMAK için.
    // (localOrders kullanılmaya devam eder, TS/ESLint uyarısı da gider.)
    // Function zaten DB'yi güncelliyor olacak; biz burada aynı sonucu UI'a uygulamak için "beklenen" update'leri hesaplıyoruz.
    const expectedRemovedOrders = new Set<string>(selectedOrderIds);
    const expectedUpdates = new Map<
        string,
        { nextItemsForWrite: Record<string, OrderItem> | OrderItem[]; nextTotal: number }
    >();

    for (const [orderId, cartIds] of selectedItemsByOrder.entries()) {
        if (selectedOrderIds.has(orderId)) continue; // zaten komple silinecek

        const cur = localOrders?.[orderId] as OrderEntity | undefined;
        if (!cur) continue;

        const curArr = toItemsArray(cur.items);
        const nextArr = curArr.filter((it) => (it.cartId ? !cartIds.has(it.cartId) : true));

        if (nextArr.length === 0) {
            expectedRemovedOrders.add(orderId);
            continue;
        }

        const nextTotal = calcTotalFromItems(nextArr);
        const nextItemsForWrite = normalizeItemsForWrite(nextArr, cur.items);
        expectedUpdates.set(orderId, { nextItemsForWrite, nextTotal });
    }

    // Cloud Function çağrısı: DB mutation + report save
    const paySelectionFn = httpsCallable<
        {
            tableId: string;
            selectedOrderIds: string[];
            selectedItemsByOrder: Record<string, string[]>;
            paymentKey: string;
        },
        PaySelectionResult
    >(getFunctions(undefined, "europe-west1"), "paySelection");

    const selectedItemsByOrderObj: Record<string, string[]> = {};
    for (const [orderId, set] of selectedItemsByOrder.entries()) {
        selectedItemsByOrderObj[orderId] = Array.from(set);
    }

    const res = await paySelectionFn({
        tableId: String(table.id),
        selectedOrderIds: Array.from(selectedOrderIds),
        selectedItemsByOrder: selectedItemsByOrderObj,
        paymentKey: uuid(),
    });

    const out = res.data;
    if (!out || out.ok !== true) return;

    // 5) Dialog state güncelle (lokal) — SENİN ESKİ MANTIĞINLA AYNI
    setLocalOrders((prev) => {
        if (!prev) return prev;
        const next: OrdersMap = { ...prev };

        // A) Order silinenleri kaldır (önce function'dan gelen, yoksa expected)
        const removed = new Set<string>(out.removedOrders ?? []);
        if (removed.size === 0) {
            for (const id of expectedRemovedOrders) removed.add(id);
        }

        for (const orderId of removed) {
            delete next[orderId];
        }

        // B) Update olan order'ları güncelle
        // Öncelik: function'dan gelen updatedOrders (source of truth)
        if (out.updatedOrders && out.updatedOrders.length > 0) {
            for (const u of out.updatedOrders) {
                const cur = next[u.orderId];
                if (!cur) continue;
                next[u.orderId] = { ...cur, items: u.items as any, total: u.total };
            }
        } else {
            // fallback: client'in hesapladığı expected update
            for (const [orderId, u] of expectedUpdates.entries()) {
                if (removed.has(orderId)) continue;
                const cur = next[orderId];
                if (!cur) continue;
                next[orderId] = { ...cur, items: u.nextItemsForWrite, total: u.nextTotal };
            }
        }

        return next;
    });

    // 6) seçimleri temizle
    setSelected({});
};