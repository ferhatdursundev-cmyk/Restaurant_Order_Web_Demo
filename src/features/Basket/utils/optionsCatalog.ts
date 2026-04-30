export type SalatOption = { id: number; key: string; label: string };
export type EkstraOption = { id: number; label: string; price?: number };

export function getSalatOptions(optionsCatalog: unknown): SalatOption[] {
    if (!optionsCatalog || typeof optionsCatalog !== "object") return [];
    const catalog = optionsCatalog as Record<string, unknown>;
    if (!Array.isArray(catalog.salata)) return [];
    return catalog.salata.filter(
        (s): s is SalatOption =>
            s && typeof s === "object" && "key" in s && "label" in s
    );
}

export function getEkstraOptions(optionsCatalog: unknown): EkstraOption[] {
    if (!optionsCatalog || typeof optionsCatalog !== "object") return [];
    const catalog = optionsCatalog as Record<string, unknown>;
    if (!Array.isArray(catalog.sos)) return [];
    return catalog.sos.filter(
        (e): e is EkstraOption =>
            e && typeof e === "object" && "id" in e && "label" in e
    );
}