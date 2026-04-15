export const capitalizeFirst= (s: string)=> {
    const t = (s ?? "").trim();
    if (!t) return t;
    return t[0].toLocaleUpperCase("tr-TR") + t.slice(1);
}