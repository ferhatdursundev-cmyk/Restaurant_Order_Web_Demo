const KEY = "activeTableId";
const TS_KEY = "activeTableId_ts";
const TTL = 10 * 60 * 1000; // 10 dk

export const setActiveTableId = (tableId: string) => {
    const now = Date.now();

    localStorage.setItem(KEY, tableId);
    localStorage.setItem(TS_KEY, String(now));

    sessionStorage.setItem(KEY, tableId);
    sessionStorage.setItem(TS_KEY, String(now));
}

export const clearActiveTableId = () => {
    localStorage.removeItem(KEY);
    localStorage.removeItem(TS_KEY);
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(TS_KEY);
}

export const initActiveTableTTL = () => {
    const now = Date.now();

    const localTs = Number(localStorage.getItem(TS_KEY) || 0);
    const sessionTs = Number(sessionStorage.getItem(TS_KEY) || 0);

    const remainingLocal = localTs ? TTL - (now - localTs) : 0;
    const remainingSession = sessionTs ? TTL - (now - sessionTs) : 0;

    const remaining = Math.max(remainingLocal, remainingSession);

    if (remaining <= 0) {
        clearActiveTableId();
        return null;
    }

    const timeout = setTimeout(() => {
        clearActiveTableId();
    }, remaining);

    return timeout;
}