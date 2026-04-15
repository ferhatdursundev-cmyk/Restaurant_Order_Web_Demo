import type { OrderEntity, OrderItem } from "./orderTypes";

export function toItemsArray(items?: OrderEntity["items"]): OrderItem[] {
    if (!items) return [];
    if (Array.isArray(items)) return items.filter(Boolean);
    return Object.values(items).filter(Boolean);
}

export function calcTotalFromItems(items: OrderItem[]) {
    return items.reduce((sum, it) => {
        const qty = it?.qty ?? 1;
        const p = typeof it?.unitPrice === "number" ? it.unitPrice : 0;
        return sum + qty * p;
    }, 0);
}

export function normalizeItemsForWrite(nextArr: OrderItem[], orig?: OrderEntity["items"]) {
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