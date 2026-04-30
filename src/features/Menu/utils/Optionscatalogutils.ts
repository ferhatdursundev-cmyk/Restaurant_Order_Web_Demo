import type { OptionItem } from "../OptionsCatalogField";

type OptionsCatalog = OptionItem[];

export function legacyCatalogToItems(catalog: Record<string, OptionItem[]>): OptionItem[] {
    return Object.values(catalog).flat();
}

export function isLegacyCatalog(val: unknown): val is Record<string, OptionItem[]> {
    return typeof val === "object" && val !== null && !Array.isArray(val);
}

export function parseCatalog(raw: unknown): OptionsCatalog {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as OptionItem[];
    if (isLegacyCatalog(raw)) return legacyCatalogToItems(raw as Record<string, OptionItem[]>);
    return [];
}