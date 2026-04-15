import { useState, useEffect } from "react";

type SessionState = {
    tableId: string | null;
    token: string | null;
    tokenExp: number;
    isExpired: boolean;
};

function computeSession(): SessionState {
    const tableId = localStorage.getItem("activeTableId");
    const sessionExpired = sessionStorage.getItem("tableSessionExpired") === "1";

    if (!tableId) return { tableId: null, token: null, tokenExp: 0, isExpired: sessionExpired };

    const token = sessionStorage.getItem(`tableToken:${tableId}`);
    const tokenExp = Number(sessionStorage.getItem(`tableTokenExp:${tableId}`) || 0);

    const isMinting = sessionStorage.getItem(`tableMinting:${tableId}`) === "1";

    const isExpired =
        sessionExpired ||
        (!isMinting && !!token && !!tokenExp && Date.now() >= tokenExp);

    return { tableId, token, tokenExp, isExpired };
}

export function useTableSession() {
    const [session, setSession] = useState<SessionState>(computeSession);

    useEffect(() => {
        const sync = () => {
            const next = computeSession();
            setSession((prev) =>
                prev.tableId === next.tableId &&
                prev.token === next.token &&
                prev.tokenExp === next.tokenExp &&
                prev.isExpired === next.isExpired
                    ? prev
                    : next
            );
        };

        const interval = window.setInterval(sync, 500);
        window.addEventListener("focus", sync);
        window.addEventListener("storage", sync);
        document.addEventListener("visibilitychange", sync);

        return () => {
            window.clearInterval(interval);
            window.removeEventListener("focus", sync);
            window.removeEventListener("storage", sync);
            document.removeEventListener("visibilitychange", sync);
        };
    }, []);

    return session;
}