import { useEffect } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "../firebase/firebase";
import { clearCart, useAppDispatch } from "../store";

function getCurrentTableSession() {
    const tokenKey = Object.keys(sessionStorage).find((k) =>
        k.startsWith("tableToken:")
    );

    if (!tokenKey) {
        return { tableId: null, token: null };
    }

    const tableId = tokenKey.replace("tableToken:", "");
    const token = sessionStorage.getItem(tokenKey);

    return {
        tableId,
        token,
    };
}

export function GlobalTableSubmissionSync() {
    const dispatch = useAppDispatch();

    useEffect(() => {
        const { tableId, token } = getCurrentTableSession();

        if (!tableId || !token) return;

        const resetRef = ref(db, `tableCartSignals/${tableId}/${token}`);

        const unsub = onValue(resetRef, (snap) => {
            const val = snap.val();

            if (!val || typeof val !== "object") return;

            const resetAt =
                typeof val.lastResetAt === "number" ? val.lastResetAt : 0;

            if (!resetAt) return;

            dispatch(clearCart());
        });

        return () => unsub();
    }, [dispatch]);

    return null;
}