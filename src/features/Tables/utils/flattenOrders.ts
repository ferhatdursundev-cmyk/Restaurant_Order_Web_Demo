import type { OrdersMap, OrderEntity } from "./orderTypes";

/**
 * Bir node'un gerçek bir sipariş mi yoksa token wrapper mı olduğunu anlar.
 */
export function isOrderNode(val: unknown): val is OrderEntity {
    if (!val || typeof val !== "object") return false;
    const o = val as Record<string, unknown>;
    return (
        "items" in o ||
        "total" in o ||
        "status" in o ||
        "createdAtMs" in o ||
        "createdAt" in o
    );
}

/**
 * OrdersMap içindeki tüm siparişleri düzleştirir.
 * - Direkt yapı:    { orderId: { items, total, ... } }
 * - Token'lı yapı: { token: { orderId: { items, total, ... } } }
 */
export function flattenOrders(ordersMap: OrdersMap): Array<{ orderId: string; order: OrderEntity }> {
    const result: Array<{ orderId: string; order: OrderEntity }> = [];

    for (const [key, val] of Object.entries(ordersMap)) {
        if (!val || typeof val !== "object") continue;

        if (isOrderNode(val)) {
            result.push({ orderId: key, order: val });
        } else {
            for (const [orderId, inner] of Object.entries(val as Record<string, unknown>)) {
                if (inner && typeof inner === "object" && isOrderNode(inner)) {
                    result.push({ orderId, order: inner as OrderEntity });
                }
            }
        }
    }

    return result;
}