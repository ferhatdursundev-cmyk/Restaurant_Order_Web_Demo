import type { OrderItem, SelectionKey } from "./orderTypes";

export function selKeyToString(k: SelectionKey) {
    return k.kind === "order" ? `order:${k.orderId}` : `item:${k.orderId}:${k.cartId}`;
}

export function allItemsSelectedForOrder(
    orderId: string,
    items: OrderItem[],
    isSelected: (k: SelectionKey) => boolean
) {
    if (items.length === 0) return false;
    return items.every((it) => (it.cartId ? isSelected({ kind: "item", orderId, cartId: it.cartId }) : false));
}

export function someItemsSelectedForOrder(
    orderId: string,
    items: OrderItem[],
    isSelected: (k: SelectionKey) => boolean
) {
    if (items.length === 0) return false;
    return items.some((it) => (it.cartId ? isSelected({ kind: "item", orderId, cartId: it.cartId }) : false));
}

export function toggleSelection(
    selected: Record<string, true>,
    key: SelectionKey
): Record<string, true> {
    const k = selKeyToString(key);
    const next = { ...selected };
    if (next[k]) delete next[k];
    else next[k] = true;
    return next;
}

export function toggleAllItemsForOrder(
    selected: Record<string, true>,
    orderId: string,
    items: OrderItem[]
): Record<string, true> {
    const next = { ...selected };
    const allSelected = items.every((it) => (it.cartId ? !!next[`item:${orderId}:${it.cartId}`] : false));

    items.forEach((it) => {
        if (!it.cartId) return;
        const k = `item:${orderId}:${it.cartId}`;
        if (allSelected) delete next[k];
        else next[k] = true;
    });

    return next;
}