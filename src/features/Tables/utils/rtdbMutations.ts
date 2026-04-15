import type { OrdersMap, SelectedTable } from "./orderTypes";
import { ref, remove, update } from "firebase/database";
import { db } from "../../../firebase/firebase";
import { calcTotalFromItems, normalizeItemsForWrite, toItemsArray } from "./orderItems";
import { selKeyToString } from "./selection";

export async function deleteOrderNode(orderId: string, table: SelectedTable) {
    if (!table?.id) return;
    await remove(ref(db, `ordersByTable/${table.id}/${orderId}`));
}

export async function deleteCartItem(orderId: string, cartId: string, table: SelectedTable, localOrders: OrdersMap | null) {
    if (!table?.id) return;

    const cur = localOrders?.[orderId];
    const curArr = toItemsArray(cur?.items);
    const nextArr = curArr.filter((it) => it?.cartId !== cartId);

    const nextTotal = calcTotalFromItems(nextArr);
    const nextItemsForWrite = normalizeItemsForWrite(nextArr, cur?.items);

    await update(ref(db, `ordersByTable/${table.id}/${orderId}`), {
        items: nextItemsForWrite,
        total: nextTotal,
    });

    return { nextItemsForWrite, nextTotal };
}

export function applyLocalDeleteOrderNode(orderId: string, prev: OrdersMap | null) {
    if (!prev) return prev;
    const next: OrdersMap = { ...prev };
    delete next[orderId];
    return next;
}

export function applyLocalDeleteOrderSelections(orderId: string, prev: Record<string, true>) {
    const next = { ...prev };
    delete next[selKeyToString({ kind: "order", orderId })];
    Object.keys(next).forEach((k) => {
        if (k.startsWith(`item:${orderId}:`)) delete next[k];
    });
    return next;
}

export function applyLocalDeleteCartItemSelection(orderId: string, cartId: string, prev: Record<string, true>) {
    const next = { ...prev };
    delete next[selKeyToString({ kind: "item", orderId, cartId })];
    return next;
}

export function applyLocalUpdateOrder(orderId: string, prev: OrdersMap | null, nextItems: unknown, nextTotal: number) {
    if (!prev) return prev;
    const next: OrdersMap = { ...prev };
    const prevOrder = next[orderId];
    if (!prevOrder) return prev;
    next[orderId] = { ...prevOrder, items: nextItems as any, total: nextTotal };
    return next;
}