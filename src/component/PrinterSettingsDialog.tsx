import { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from "@mui/material";

type PrinterItem = {
    name: string;
    isDefault?: boolean;
    source: "os" | "network";
};

type Props = {
    open: boolean;
    onClose: () => void;
};

type AgentConfig = {
    selectedPrinterName?: string;
    thermalMode: "escpos-network" | "os-print";
    thermalNetworkHost?: string;
    thermalNetworkPort?: number;
    paperWidth?: 32 | 42 | 48 | 80;
    openCashDrawer?: boolean;
};

const DEFAULT_CONFIG: AgentConfig = {
    selectedPrinterName: "",
    thermalMode: "os-print",
    thermalNetworkHost: "",
    thermalNetworkPort: 9100,
    paperWidth: 80,
    openCashDrawer: false,
};

export const PrinterSettingsDialog = ({ open, onClose }: Props) => {
    const [agentReady, setAgentReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const [printers, setPrinters] = useState<PrinterItem[]>([]);
    const [form, setForm] = useState<AgentConfig>(DEFAULT_CONFIG);

    const checkAgent = async () => {
        try {
            const res = await fetch("http://127.0.0.1:43125/health");
            const json = await res.json();
            const ok = !!json?.ok;
            setAgentReady(ok);
            return ok;
        } catch {
            setAgentReady(false);
            return false;
        }
    };

    const loadData = async () => {
        setLoading(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const ok = await checkAgent();

            if (!ok) {
                setPrinters([]);
                setForm(DEFAULT_CONFIG);
                setError("Print Agent çalışmıyor. Önce agent'i başlatın.");
                return;
            }

            const [printersRes, configRes] = await Promise.all([
                fetch("http://127.0.0.1:43125/printers"),
                fetch("http://127.0.0.1:43125/config"),
            ]);

            const printersJson = await printersRes.json();
            const configJson = await configRes.json();

            if (!printersRes.ok || !printersJson.ok) {
                throw new Error(printersJson.error || "Yazıcı listesi alınamadı");
            }

            if (!configRes.ok || !configJson.ok) {
                throw new Error(configJson.error || "Ayarlar alınamadı");
            }

            setPrinters(printersJson.printers || []);
            setForm({
                ...DEFAULT_CONFIG,
                ...(configJson.config || {}),
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Bilinmeyen hata");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!open) return;
        loadData();
    }, [open]);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccessMsg(null);

        try {
            if (form.thermalMode === "os-print" && !form.selectedPrinterName) {
                throw new Error("OS Print için bir yazıcı seçmelisiniz.");
            }

            // ESC/POS Network modunda thermalNetworkHost boş olabilir.
            // Boş bırakılırsa agent yazıcı IP'sini otomatik bulmaya çalışır.

            const payload = {
                ...form,
                thermalNetworkHost:
                    form.thermalMode === "escpos-network"
                        ? (form.thermalNetworkHost || "").trim()
                        : "",
            };

            const res = await fetch("http://127.0.0.1:43125/config", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const json = await res.json();

            if (!res.ok || !json.ok) {
                throw new Error(json.error || "Ayarlar kaydedilemedi");
            }

            setForm({
                ...DEFAULT_CONFIG,
                ...(json.config || {}),
            });

            setSuccessMsg(
                payload.thermalMode === "escpos-network" && !payload.thermalNetworkHost
                    ? "Ayarlar kaydedildi. Yazıcı IP adresi yazdırma anında otomatik bulunacak."
                    : "Yazıcı ayarları kaydedildi."
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : "Bilinmeyen hata");
        } finally {
            setSaving(false);
        }
    };

    const handleTestPrint = async () => {
        setTesting(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const res = await fetch("http://127.0.0.1:43125/print/receipt", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    orderId: "TEST-PRINT",
                    tableName: "Yazıcı Testi",
                    items: [
                        {
                            title: "Test Ürün",
                            qty: 1,
                            note: "Deneme",
                            lineTotal: 0,
                        },
                    ],
                    total: 0,
                }),
            });

            const json = await res.json();

            if (!res.ok || !json.ok) {
                throw new Error(json.error || "Test yazdırma başarısız");
            }

            setSuccessMsg("Test fişi gönderildi.");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Bilinmeyen hata");
        } finally {
            setTesting(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ fontWeight: 900 }}>Yazıcı Ayarları</DialogTitle>

            <DialogContent dividers>
                <Stack spacing={2}>
                    {!agentReady && (
                        <Alert severity="warning">
                            Print Agent çalışmıyor. Yazdırma için agent açık olmalı.
                        </Alert>
                    )}

                    {error && <Alert severity="error">{error}</Alert>}
                    {successMsg && <Alert severity="success">{successMsg}</Alert>}

                    <Box>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            Durum:{" "}
                            <strong>
                                {agentReady ? "Agent bağlı" : "Agent bağlı değil"}
                            </strong>
                        </Typography>
                    </Box>

                    <FormControl fullWidth disabled={loading || !agentReady}>
                        <InputLabel id="thermal-mode-label">Yazdırma Tipi</InputLabel>
                        <Select
                            labelId="thermal-mode-label"
                            label="Yazdırma Tipi"
                            value={form.thermalMode}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    thermalMode: e.target.value as
                                        | "escpos-network"
                                        | "os-print",
                                }))
                            }
                        >
                            <MenuItem value="os-print">OS Print</MenuItem>
                            <MenuItem value="escpos-network">ESC/POS Network</MenuItem>
                        </Select>
                    </FormControl>

                    {form.thermalMode === "os-print" && (
                        <FormControl fullWidth disabled={loading || !agentReady}>
                            <InputLabel id="printer-select-label">Yazıcı</InputLabel>
                            <Select
                                labelId="printer-select-label"
                                label="Yazıcı"
                                value={form.selectedPrinterName || ""}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        selectedPrinterName: e.target.value,
                                    }))
                                }
                            >
                                {printers.map((printer) => (
                                    <MenuItem key={printer.name} value={printer.name}>
                                        {printer.name}
                                        {printer.isDefault ? " (Varsayılan)" : ""}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    {form.thermalMode === "escpos-network" && (
                        <>
                            <TextField
                                fullWidth
                                label="Yazıcı IP (isteğe bağlı)"
                                value={form.thermalNetworkHost || ""}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        thermalNetworkHost: e.target.value,
                                    }))
                                }
                                disabled={loading || !agentReady}
                                placeholder="Boş bırakılırsa otomatik bulunur"
                                helperText="İsterseniz IP adresini manuel girebilirsiniz. Boş bırakırsanız agent yazıcıyı otomatik bulmaya çalışır."
                            />

                            <TextField
                                fullWidth
                                type="number"
                                label="Port"
                                value={form.thermalNetworkPort || 9100}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        thermalNetworkPort: Number(
                                            e.target.value || 9100
                                        ),
                                    }))
                                }
                                disabled={loading || !agentReady}
                            />
                        </>
                    )}

                    <FormControl fullWidth disabled={loading || !agentReady}>
                        <InputLabel id="paper-width-label">Kağıt Genişliği</InputLabel>
                        <Select
                            labelId="paper-width-label"
                            label="Kağıt Genişliği"
                            value={form.paperWidth || 80}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    paperWidth: Number(e.target.value) as 32 | 42 | 48,
                                }))
                            }
                        >
                            <MenuItem value={32}>32</MenuItem>
                            <MenuItem value={42}>42</MenuItem>
                            <MenuItem value={48}>48</MenuItem>
                            <MenuItem value={80}>80</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 2, py: 1.5 }}>
                <Button onClick={loadData} disabled={loading}>
                    Yenile
                </Button>

                <Button
                    onClick={handleTestPrint}
                    disabled={!agentReady || loading || testing}
                    variant="outlined"
                >
                    Test Yazdır
                </Button>

                <Button onClick={onClose}>Kapat</Button>

                <Button
                    onClick={handleSave}
                    variant="contained"
                    disabled={!agentReady || loading || saving}
                >
                    Kaydet
                </Button>
            </DialogActions>
        </Dialog>
    );
};