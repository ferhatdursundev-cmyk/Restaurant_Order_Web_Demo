import { Box, Button, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
    tableId: string;   // "t12"
    trimmed: string;   // "12"
    qrKey: string;     // "t12_k_xxx"
};

export const TableQrCode = ({ tableId, trimmed, qrKey }: Props) => {
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const generate = async () => {
            try {
                const qrUrl = `https://restaurant-order-web-demo.vercel.app/t/${tableId}?k=${qrKey}`;

                const canvas = document.createElement("canvas");
                const qrSize = 256;
                const headerH = 48;
                const footerH = 48;
                canvas.width = qrSize;
                canvas.height = qrSize + headerH + footerH;

                const ctx = canvas.getContext("2d")!;

                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.fillStyle = "#000000";
                ctx.font = "bold 22px Arial";
                ctx.textAlign = "center";
                ctx.fillText(`MASA ${trimmed}`, qrSize / 2, 32);

                const qrCanvas = document.createElement("canvas");
                await QRCode.toCanvas(qrCanvas, qrUrl, { width: qrSize, margin: 1 });
                ctx.drawImage(qrCanvas, 0, headerH);

                ctx.fillStyle = "#000000";
                ctx.font = "bold 18px Arial";
                ctx.textAlign = "center";
                ctx.fillText("DEMO RESTORAN", qrSize / 2, qrSize + headerH + 32);

                const dataUrl = canvas.toDataURL("image/png");
                setQrDataUrl(dataUrl);
            } catch (err: any) {
                setError("QR kod oluşturulamadı: " + (err?.message ?? "Bilinmeyen hata"));
            }
        };

        generate();
    }, [tableId, trimmed, qrKey]);

    if (error) {
        return (
            <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: "rgba(229,57,53,0.08)", border: "1px solid rgba(229,57,53,0.30)" }}>
                <Typography sx={{ fontSize: 13, color: "error.main" }}>{error}</Typography>
            </Box>
        );
    }

    if (!qrDataUrl) {
        return (
            <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 1.5 }}>
                QR kod oluşturuluyor…
            </Typography>
        );
    }

    return (
        <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <img src={qrDataUrl} alt="QR Kod" style={{ width: 180, height: 180 }} />
            <Button
                size="small"
                variant="outlined"
                color="success"
                href={qrDataUrl}
                download={`masa-${trimmed}-qr.png`}
                sx={{ textTransform: "none", fontSize: 12 }}
            >
                QR İndir
            </Button>
        </Box>
    );
};
