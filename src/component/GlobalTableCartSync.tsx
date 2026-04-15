import { useEffect } from "react";
import { db } from "../firebase/firebase";
import { onValue, ref, set, remove } from "firebase/database";
import { useAppDispatch, useAppSelector } from "../store";
import { clearTableLiveItems, setTableLiveItems, type LiveCartItem } from "../store/tableLiveCartSlice";
import { useTableSession } from "../hooks/useTableSession";

type SessionLiveCart = {
    tableId?: string;
    tableToken?: string;
    expiresAt?: number;
    updatedAt?: number;
    source?: string;
    items?: Record<string, LiveCartItem>;
};

export function GlobalTableCartSync() {
    const dispatch = useAppDispatch();
    const localCartItems = useAppSelector((s) => s.cart.items);
    const { tableId, token, tokenExp, isExpired } = useTableSession();

    // Token süresi dolduğunda Firebase'den hemen sil
    useEffect(() => {
        if (!isExpired || !tableId || !token) return;
        void remove(ref(db, `liveCartByTable/${tableId}/${token}`));
    }, [isExpired, tableId, token]);

    // Yerel sepeti Firebase'e yaz
    useEffect(() => {
        if (!tableId || !token || !tokenExp || isExpired) return;

        const nodeRef = ref(db, `liveCartByTable/${tableId}/${token}`);

        if (localCartItems.length === 0) {
            void remove(nodeRef);
            return;
        }

        const itemsAsObject = localCartItems.reduce<Record<string, LiveCartItem>>(
            (acc, item) => {
                acc[item.cartId] = {
                    cartId: item.cartId,
                    productId: item.productId,
                    title: item.title,
                    unitPrice: item.unitPrice,
                    qty: item.qty ?? 1,
                    note: item.note ?? "",
                    image: item.image ?? "",
                };
                return acc;
            },
            {}
        );

        const payload: SessionLiveCart = {
            tableId,
            tableToken: token,
            expiresAt: tokenExp,
            updatedAt: Date.now(),
            source: "menu",
            items: itemsAsObject,
        };

        void set(nodeRef, payload);
    }, [localCartItems, tableId, token, tokenExp, isExpired]);

    // Diğer session'ların cart item'larını dinle
    useEffect(() => {
        if (!tableId || !token || !tokenExp || isExpired) {
            dispatch(clearTableLiveItems());
            return;
        }

        const tableRef = ref(db, `liveCartByTable/${tableId}`);

        const unsub = onValue(tableRef, (snap) => {
            const val = (snap.val() || {}) as Record<string, SessionLiveCart>;
            const now = Date.now();
            const otherItems: LiveCartItem[] = [];

            for (const [sessionToken, sessionData] of Object.entries(val)) {
                if (sessionToken === token) continue;
                if (!sessionData?.expiresAt || sessionData.expiresAt <= now) continue;

                const items = Object.values(sessionData.items || {});
                otherItems.push(...items);
            }

            dispatch(setTableLiveItems(otherItems));
        });

        return () => {
            unsub();
            dispatch(clearTableLiveItems());
        };
    }, [dispatch, tableId, token, tokenExp, isExpired]);

    return null;
}