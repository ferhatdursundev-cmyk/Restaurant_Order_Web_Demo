import { useEffect, useRef } from "react";
import { onValue, off, ref } from "firebase/database";
import { db } from "../firebase/firebase";
import { clearCart, useAppDispatch } from "../store";

function getTableId(): string | null {
    // Önce URL'den dene
    const match = window.location.pathname.match(/\/t\/([^/]+)/);
    if (match) return match[1];

    // Sonra localStorage'dan
    return localStorage.getItem("activeTableId");
}

export function GlobalTableResetSync() {
    const dispatch = useAppDispatch();
    const unsubRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        function subscribe() {
            if (unsubRef.current) return;

            const tableId = getTableId();
            if (!tableId) return;

            const dbRef = ref(db, `tableCartSignals/${tableId}/lastResetAt`);
            let isFirst = true;
            let lastHandled = 0;

            onValue(dbRef, (snap) => {
                const resetAt = snap.val();

                if (typeof resetAt !== "number") return;

                if (isFirst) {
                    isFirst = false;
                    lastHandled = resetAt;
                    return;
                }

                if (resetAt <= lastHandled) return;
                lastHandled = resetAt;
                dispatch(clearCart());
            });

            unsubRef.current = () => off(dbRef);
        }

        subscribe();
        window.addEventListener("tableSessionReady", subscribe);

        return () => {
            window.removeEventListener("tableSessionReady", subscribe);
            unsubRef.current?.();
            unsubRef.current = null;
        };
    }, [dispatch]);

    return null;
}