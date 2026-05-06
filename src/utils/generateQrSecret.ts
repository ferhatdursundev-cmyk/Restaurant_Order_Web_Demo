// QR key için rastgele 16 karakterlik string üretir
export const generateQrSecret = (tableId: string): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let rand = "";
    for (let i = 0; i < 16; i++) {
        rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${tableId}_k_${rand}`;
}
