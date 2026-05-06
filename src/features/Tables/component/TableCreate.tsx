import { Box, Button, TextField, Typography } from "@mui/material";
import { useCallback, useState } from "react";
import { get, ref, set } from "firebase/database";
import { db } from "../../../firebase/firebase.ts";
import { generateQrSecret } from "../../../utils";
import { ConfirmDialog } from "../../../component";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { TableQrCode } from "./TableQrCode.tsx";

export const TableCreate = () => {
    const [newTableDialogOpen, setNewTableDialogOpen] = useState(false);
    const [newTableNumber, setNewTableNumber] = useState("");
    const [newTableLoading, setNewTableLoading] = useState(false);
    const [newTableError, setNewTableError] = useState<string | null>(null);
    const [newTableSuccess, setNewTableSuccess] = useState<string | null>(null);
    const [newQrKey, setNewQrKey] = useState<string | null>(null);

    const handleNewTableDialogOpen = useCallback(() => {
        setNewTableNumber("");
        setNewTableError(null);
        setNewTableSuccess(null);
        setNewQrKey(null);
        setNewTableDialogOpen(true);
    }, []);

    const handleNewTableDialogClose = useCallback(() => {
        if (newTableLoading) return;
        setNewTableDialogOpen(false);
    }, [newTableLoading]);

    const handleCreateTable = useCallback(async () => {
        const trimmed = newTableNumber.trim();

        if (!trimmed || !/^\d+$/.test(trimmed)) {
            setNewTableError("Lütfen geçerli bir masa numarası girin (sadece rakam).");
            return;
        }

        const tableId = `t${trimmed}`;
        setNewTableLoading(true);
        setNewTableError(null);
        setNewTableSuccess(null);
        setNewQrKey(null);

        try {
            const tablesSnap = await get(ref(db, `tables/${tableId}`));

            if (tablesSnap.exists()) {
                setNewTableError(`Masa ${trimmed} zaten mevcut. Farklı bir numara girin.`);
                return;
            }

            const now = new Date().toISOString();
            const qrKey = generateQrSecret(tableId);
            const numberAsInt = parseInt(trimmed, 10);

            await set(ref(db, `tables/${tableId}`), {
                createdAt: now,
                id: tableId,
                isOpen: false,
                name: `Masa ${trimmed}`,
                number: numberAsInt,
                updatedAt: now,
            });

            await set(ref(db, `tableSecrets/${tableId}`), {
                qrKey,
            });

            setNewQrKey(qrKey);
            setNewTableSuccess(`Masa ${trimmed} başarıyla oluşturuldu!`);
        } catch (err: any) {
            console.log("ERROR CODE:", err?.code);
            console.log("ERROR MESSAGE:", err?.message);
            console.log("FULL ERROR:", err);

            const code = err?.code ?? "";
            if (code === "PERMISSION_DENIED" || code?.includes("permission")) {
                setNewTableError("Bu işlem için yetkiniz yok.");
            } else if (code === "NETWORK_ERROR" || err?.message?.includes("network")) {
                setNewTableError("Bağlantı hatası. İnternet bağlantınızı kontrol edin.");
            } else {
                setNewTableError("Masa oluşturulamadı. Var olan masa numarası girmedığınızdan emin olun ve lütfen tekrar deneyin.");
            }
        } finally {
            setNewTableLoading(false);
        }
    }, [newTableNumber]);

    return (
        <>
            <Button
                variant="outlined"
                size="small"
                startIcon={<AddCircleOutlineIcon />}
                onClick={handleNewTableDialogOpen}
                sx={{
                    borderRadius: 2.5,
                    textTransform: "none",
                    fontWeight: 700,
                    fontSize: 20,
                    whiteSpace: "nowrap",
                    color: "#FF7A00",
                    borderColor: "#FF7A00",
                    "&:hover": {
                        borderColor: "#ff8c1a",
                        bgcolor: "rgba(255,122,0,0.08)",
                    },
                }}
            >
                Yeni Masa
            </Button>

            <ConfirmDialog
                open={newTableDialogOpen}
                onClose={handleNewTableDialogClose}
                onConfirm={handleCreateTable}
                title="Yeni Masa Oluştur"
                confirmText={newTableLoading ? "Oluşturuluyor…" : "Oluştur"}
                cancelText={newTableSuccess ? "Kapat" : "İptal"}
                confirmDisabled={!newTableNumber || !!newTableSuccess}
                busy={newTableLoading}
                maxWidth="xs"
            >
                <TextField
                    label="Masa Numarası"
                    placeholder="Örn: 52"
                    value={newTableNumber}
                    onChange={(e) => {
                        setNewTableNumber(e.target.value.replace(/\D/g, ""));
                        setNewTableError(null);
                        setNewTableSuccess(null);
                    }}
                    disabled={newTableLoading}
                    inputProps={{ inputMode: "numeric", maxLength: 6 }}
                    fullWidth
                    size="small"
                    sx={{
                        "& .MuiOutlinedInput-root": {
                            bgcolor: "rgba(0,0,0,0.04)",
                            "& fieldset": { borderColor: "divider" },
                            "&:hover fieldset": { borderColor: "text.secondary" },
                            "&.Mui-focused fieldset": { borderColor: "#FF7A00" },
                        },
                        "& .MuiInputLabel-root.Mui-focused": { color: "#FF7A00" },
                        input: { color: "text.primary" },
                    }}
                />

                {/* Önizleme */}
                {newTableNumber && !newTableError && !newTableSuccess && (
                    <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: "rgba(255,122,0,0.08)", border: "1px solid rgba(255,122,0,0.25)" }}>
                        <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 0.5 }}>
                            Oluşturulacak kayıtlar:
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: "#FF7A00", fontFamily: "monospace" }}>
                            tables/t{newTableNumber} → name: "Masa {newTableNumber}", number: {newTableNumber}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: "#FF7A00", fontFamily: "monospace", mt: 0.5 }}>
                            tableSecrets/t{newTableNumber} → qrKey: "t{newTableNumber}_k_..."
                        </Typography>
                    </Box>
                )}

                {/* Hata */}
                {newTableError && (
                    <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: "rgba(229,57,53,0.08)", border: "1px solid rgba(229,57,53,0.30)" }}>
                        <Typography sx={{ fontSize: 13, color: "error.main" }}>{newTableError}</Typography>
                    </Box>
                )}

                {/* Başarı */}
                {newTableSuccess && (
                    <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.30)" }}>
                        <Typography sx={{ fontSize: 13, color: "success.main" }}>
                            {newTableSuccess}
                        </Typography>
                        {newQrKey && (
                            <TableQrCode
                                tableId={`t${newTableNumber}`}
                                trimmed={newTableNumber}
                                qrKey={newQrKey}
                            />
                        )}
                    </Box>
                )}
            </ConfirmDialog>
        </>
    );
};
