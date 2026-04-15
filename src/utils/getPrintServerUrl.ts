import { get, ref } from "firebase/database";
import { db } from "../firebase/firebase";

let cached: string | null = null;

export async function getPrintServerUrl(): Promise<string> {
    if (cached) {
        console.log("[getPrintServerUrl] cache'den döndü:", cached);
        return cached;
    }

    const snap = await get(ref(db, "printerConfig/printServerUrl"));
    const val = snap.val();

    console.log("[getPrintServerUrl] RTDB'den okunan değer:", val);

    if (typeof val !== "string" || !val.startsWith("http")) {
        throw new Error("Yazıcı sunucu adresi bulunamadı (printerConfig/printServerUrl).");
    }

    cached = val;
    return val;
}