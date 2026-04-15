export function fmtDate(ms?: number) {
    if (!ms) return "—";
    try {
        return new Date(ms).toLocaleString("de-DE");
    } catch {
        return String(ms);
    }
}

export function tl(n: number) {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRL" }).format(n);
}