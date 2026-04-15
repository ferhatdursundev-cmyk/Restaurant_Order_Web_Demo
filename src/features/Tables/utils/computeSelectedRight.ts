import type { OrdersMap, OrderItem, SelectionKey } from "./orderTypes";
import { toItemsArray } from "./orderItems";
import { flattenOrders } from "./flattenOrders";

export function computeSelectedItemsForRight(
    localOrders: OrdersMap | null,
    isSelected: (k: SelectionKey) => boolean
) {
    const out: Array<{ orderId: string; item: OrderItem }> = [];
    const flat = flattenOrders(localOrders ?? {});

    for (const { orderId, order: o } of flat) {
        const itemsArr = toItemsArray(o?.items);

        if (isSelected({ kind: "order", orderId })) {
            itemsArr.forEach((it) => out.push({ orderId, item: it }));
            continue;
        }

        itemsArr.forEach((it) => {
            if (!it.cartId) return;
            if (isSelected({ kind: "item", orderId, cartId: it.cartId })) out.push({ orderId, item: it });
        });
    }

    return out;
}

export function computeRightTotal(selectedItemsForRight: Array<{ orderId: string; item: OrderItem }>) {
    return selectedItemsForRight.reduce((sum, x) => {
        const qty = x.item?.qty ?? 1;
        const p = typeof x.item?.unitPrice === "number" ? x.item.unitPrice : 0;
        return sum + qty * p;
    }, 0);
}

export function computeGrandTotal(localOrders: OrdersMap | null) {
    const flat = flattenOrders(localOrders ?? {});
    return flat.reduce((sum, { order: o }) => sum + (typeof o?.total === "number" ? o.total : 0), 0);
}