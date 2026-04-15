import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

type OrderItem = {
    cartId?: string;
    productId?: string;
    title?: string;
    qty?: number;
    unitPrice?: number;
    image?: string;
    note?: string;
};

type Order = {
    createdAt?: number;
    createdAtMs?: number;
    dayKey?: string;
    monthKey?: string;
    weekKey?: string;
    items?: Record<string, OrderItem> | OrderItem[];
    source?: string;
    status?: string;
    total?: number;
};

type Payload = {
    tableId: string;
    selectedOrderIds: string[];
    selectedItemsByOrder: Record<string, string[]>;
    paymentKey: string;
};

type Result = {
    ok: true;
    already?: boolean;
    removedOrders: string[];
    updatedOrders: Array<{ orderId: string; total: number; items: unknown }>;
};

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

function dayId(ms: number) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function monthId(ms: number) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function isoWeekId(ms: number) {
    const d = new Date(ms);
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function hourBucket(ms: number) { return pad2(new Date(ms).getHours()); }
function weekDayBucket(ms: number) { const d = new Date(ms).getDay(); return String(d === 0 ? 7 : d); }
function monthDayBucket(ms: number) { return String(new Date(ms).getDate()); }

function pickCreatedAtMs(order: Order): number | null {
    const ms =
        typeof order.createdAtMs === "number" ? order.createdAtMs :
            typeof order.createdAt === "number" ? order.createdAt : null;
    return typeof ms === "number" && !Number.isNaN(ms) ? ms : null;
}

function toItemsArray(items?: Order["items"]): OrderItem[] {
    if (!items) return [];
    if (Array.isArray(items)) return items.filter(Boolean);
    return Object.values(items).filter(Boolean);
}

function normalizeItemsForWrite(nextArr: OrderItem[], orig?: Order["items"]) {
    if (!orig) return nextArr;
    if (Array.isArray(orig)) return nextArr;
    const keys = Object.keys(orig);
    const out: Record<string, OrderItem> = {};
    nextArr.forEach((it, idx) => { out[keys[idx] ?? String(idx)] = it; });
    return out;
}

function calcTotalFromItems(items: OrderItem[]) {
    return items.reduce((sum, it) => {
        const qty = Number(it?.qty ?? 1);
        const p = typeof it?.unitPrice === "number" ? it.unitPrice : Number(it?.unitPrice ?? 0);
        if (Number.isNaN(qty) || Number.isNaN(p)) return sum;
        return sum + qty * p;
    }, 0);
}

function sumQty(items: OrderItem[]) {
    return items.reduce((s, it) => s + Number(it?.qty ?? 1), 0);
}

function isOrderNode(val: unknown): val is Order {
    if (!val || typeof val !== "object") return false;
    const o = val as Record<string, unknown>;
    return "items" in o || "total" in o || "status" in o || "createdAtMs" in o || "createdAt" in o;
}

/**
 * Önce direkt path'e bak: ordersByTable/{tableId}/{orderId}
 * Bulamazsa token katmanında ara: ordersByTable/{tableId}/{token}/{orderId}
 * Gerçek ref'i ve order verisini döner.
 */
async function resolveOrderRef(
    tableId: string,
    orderId: string
): Promise<{ ref: admin.database.Reference; order: Order } | null> {
    const db = admin.database();

    // 1) Direkt path
    const directRef = db.ref(`/ordersByTable/${tableId}/${orderId}`);
    const directSnap = await directRef.get();
    if (directSnap.exists() && isOrderNode(directSnap.val())) {
        return { ref: directRef, order: directSnap.val() as Order };
    }

    // 2) Token katmanında ara: ordersByTable/{tableId}/* altındaki tüm node'ları tara
    const tableRef = db.ref(`/ordersByTable/${tableId}`);
    const tableSnap = await tableRef.get();
    if (!tableSnap.exists()) return null;

    const tableVal = tableSnap.val() as Record<string, unknown>;
    for (const [tokenKey, tokenVal] of Object.entries(tableVal)) {
        if (isOrderNode(tokenVal)) continue; // bu direkt sipariş, token wrapper değil
        if (!tokenVal || typeof tokenVal !== "object") continue;

        const tokenNode = tokenVal as Record<string, unknown>;
        if (orderId in tokenNode && isOrderNode(tokenNode[orderId])) {
            const tokenOrderRef = db.ref(`/ordersByTable/${tableId}/${tokenKey}/${orderId}`);
            return { ref: tokenOrderRef, order: tokenNode[orderId] as Order };
        }
    }

    return null;
}

async function incTotals(root: admin.database.Reference, revenue: number, qty: number) {
    await Promise.all([
        root.child("totals/revenue").transaction((v) => Number(v || 0) + revenue),
        root.child("totals/qty").transaction((v) => Number(v || 0) + qty),
        root.child("totals/orderCount").transaction((v) => Number(v || 0) + 1),
    ]);
}

async function incSeries(root: admin.database.Reference, bucket: string, revenue: number, qty: number) {
    await Promise.all([
        root.child(`series/${bucket}/revenue`).transaction((v) => Number(v || 0) + revenue),
        root.child(`series/${bucket}/qty`).transaction((v) => Number(v || 0) + qty),
    ]);
}

async function incProducts(root: admin.database.Reference, items: OrderItem[]) {
    const ops: Promise<unknown>[] = [];
    for (const it of items) {
        const q = Number(it?.qty ?? 1);
        const price = typeof it?.unitPrice === "number" ? it.unitPrice : Number(it?.unitPrice ?? 0);
        const rev = q * price;
        const productId = String(it?.productId ?? "");
        const title = String(it?.title ?? "");
        if (!productId) continue;
        const pRef = root.child(`products/${productId}`);
        ops.push(pRef.child("title").transaction((v) => v ?? title));
        ops.push(pRef.child("qty").transaction((v) => Number(v || 0) + q));
        ops.push(pRef.child("revenue").transaction((v) => Number(v || 0) + rev));
    }
    await Promise.all(ops);
}

export const paySelection = onCall(
    { region: "europe-west1" },
    async (request) => {
        const auth = request.auth;
        if (!auth) throw new HttpsError("unauthenticated", "Login gerekli");

        const uid = auth.uid;

        const isAdminSnap = await admin.database().ref(`/users/${uid}/isAdmin`).get();
        if (isAdminSnap.val() !== true) throw new HttpsError("permission-denied", "Sadece admin ödeme alabilir.");

        const data = (request.data ?? {}) as Partial<Payload>;
        const tableId = String(data.tableId ?? "");
        const paymentKey = String(data.paymentKey ?? "");

        const selectedOrderIds = Array.isArray(data.selectedOrderIds) ? data.selectedOrderIds.map(String) : [];
        const selectedItemsByOrder = (data.selectedItemsByOrder ?? {}) as Record<string, string[]>;

        if (!tableId) throw new HttpsError("invalid-argument", "tableId gerekli");
        if (!paymentKey) throw new HttpsError("invalid-argument", "paymentKey gerekli");

        // idempotent lock
        const lockRef = admin.database().ref(`/paymentLocks/${tableId}/${paymentKey}`);
        const lockSnap = await lockRef.get();
        if (lockSnap.exists()) {
            return { ok: true, already: true, removedOrders: [], updatedOrders: [] } as Result;
        }
        await lockRef.set({ at: admin.database.ServerValue.TIMESTAMP, by: uid });

        const selectedOrderSet = new Set<string>(selectedOrderIds);
        const orderIdSet = new Set<string>(selectedOrderIds);
        Object.keys(selectedItemsByOrder).forEach((oid) => orderIdSet.add(oid));

        const removedOrders: string[] = [];
        const updatedOrders: Array<{ orderId: string; total: number; items: unknown }> = [];

        for (const orderId of Array.from(orderIdSet)) {
            // ← Tek değişiklik: direkt ref yerine resolveOrderRef ile hem direkt hem token'lı path'i dene
            const resolved = await resolveOrderRef(tableId, orderId);
            if (!resolved) continue;

            const { ref: orderRef, order } = resolved;

            const createdAtMs = pickCreatedAtMs(order);
            if (!createdAtMs) continue;

            const allItems = toItemsArray(order.items);
            if (allItems.length === 0) continue;

            const payWhole = selectedOrderSet.has(orderId);
            const cartIds = Array.isArray(selectedItemsByOrder[orderId]) ? selectedItemsByOrder[orderId] : [];
            const cartSet = new Set(cartIds);

            const paidItems = payWhole
                ? allItems
                : allItems.filter((it) => (it.cartId ? cartSet.has(it.cartId) : false));

            if (paidItems.length === 0) continue;

            const revenue = calcTotalFromItems(paidItems);
            const qty = sumQty(paidItems);

            const dId = typeof order.dayKey === "string" && order.dayKey.length === 10 ? order.dayKey : dayId(createdAtMs);
            const mId = typeof order.monthKey === "string" && order.monthKey.length === 7 ? order.monthKey : monthId(createdAtMs);
            const wId = typeof order.weekKey === "string" && order.weekKey.includes("W") ? order.weekKey : isoWeekId(createdAtMs);

            const daily = admin.database().ref(`/reportsDaily/${dId}`);
            const weekly = admin.database().ref(`/reportsWeekly/${wId}`);
            const monthly = admin.database().ref(`/reportsMonthly/${mId}`);

            const saleId = admin.database().ref(`/salesByDay/${dId}`).push().key!;
            await admin.database().ref(`/salesByDay/${dId}/${saleId}`).set({
                createdAtMs,
                tableId,
                orderId,
                source: order.source ?? null,
                items: paidItems,
                total: revenue,
                paymentKey,
                paidBy: uid,
                paidAt: admin.database.ServerValue.TIMESTAMP,
                paidWhole: payWhole,
                dayKey: dId,
                weekKey: wId,
                monthKey: mId,
            });

            await Promise.all([
                incTotals(daily, revenue, qty),
                incTotals(weekly, revenue, qty),
                incTotals(monthly, revenue, qty),
                incSeries(daily, hourBucket(createdAtMs), revenue, qty),
                incSeries(weekly, weekDayBucket(createdAtMs), revenue, qty),
                incSeries(monthly, monthDayBucket(createdAtMs), revenue, qty),
                incProducts(daily, paidItems),
                incProducts(weekly, paidItems),
                incProducts(monthly, paidItems),
            ]);

            if (payWhole) {
                await orderRef.remove();
                removedOrders.push(orderId);
                continue;
            }

            const remaining = allItems.filter((it) => (it.cartId ? !cartSet.has(it.cartId) : true));

            if (remaining.length === 0) {
                await orderRef.remove();
                removedOrders.push(orderId);
                continue;
            }

            const nextTotal = calcTotalFromItems(remaining);
            const nextItemsForWrite = normalizeItemsForWrite(remaining, order.items);

            await orderRef.update({ items: nextItemsForWrite, total: nextTotal });

            updatedOrders.push({ orderId, total: nextTotal, items: nextItemsForWrite });
        }

        return { ok: true, removedOrders, updatedOrders } as Result;
    }
);