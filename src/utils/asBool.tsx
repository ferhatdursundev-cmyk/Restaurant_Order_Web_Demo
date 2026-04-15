export const asBool = (v: unknown): boolean => {
    return v === true || v === "true" || v === "TRUE" || v === 1 || v === "1";
}