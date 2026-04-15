import type { OrdersMap } from "./orderTypes";
import { toItemsArray } from "./orderItems";
import { flattenOrders } from "./flattenOrders";

export function buildOrdersList(localOrders: OrdersMap | null) {
    if (!localOrders) return [];

    const flat = flattenOrders(localOrders);

    const arr = flat.map(({ orderId, order: o }) => ({
        orderId,
        ...o,
        createdAtMs: typeof o?.createdAtMs === "number" ? o.createdAtMs : undefined,
        total: typeof o?.total === "number" ? o.total : undefined,
        status: typeof o?.status === "string" ? o.status : undefined,
        itemsArr: toItemsArray(o?.items),
    }));

    return arr.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
}