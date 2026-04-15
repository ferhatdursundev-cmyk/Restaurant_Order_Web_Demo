import { useMemo, useState } from "react";
import {
    Box,
    Button,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Alert,
    Typography,
} from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { ref, get, update } from "firebase/database";
import { db } from "../../../firebase/firebase";
import { ConfirmDialog, PremiumSwitch } from "../../../component";
import {useAppDispatch, useAppSelector, show as showNotify} from "../../../store";
import {useAuth} from "../../../auth/aut.context";

type TableRow = { id: string; name?: string };

const ORDERS_ROOT = "ordersByTable";

export const TablesChange = ({
                                 loading,
                                 list,
                                 onAfterClose,
                             }: {
    loading: boolean;
    list: TableRow[];
    onAfterClose?: () => void | Promise<void>;
}) => {
    const isOrder = useAppSelector((state) => state.orderSettings.isOrder);
    const { user } = useAuth();
    const isAdmin = (user as any)?.isAdmin === true;
    const dispatch = useAppDispatch();
    const [open, setOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [fromTable, setFromTable] = useState<string>("");
    const [toTable, setToTable] = useState<string>("");
    const [busy, setBusy] = useState(false);
    const [switchBusy, setSwitchBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [okMsg, setOkMsg] = useState<string | null>(null);

    const tableOptions = useMemo(() => list.map((t) => t.id), [list]);

    const handleSwitchChange = async (checked: boolean) => {
        setSwitchBusy(true);
        setError(null);

        try {
            await update(ref(db), {
                isOrder: checked,
            });
        } catch (e: any) {
            setError(e?.message ?? "isOrder güncellenemedi.");
        } finally {
            setSwitchBusy(false);
        }
    };

    const resetDialog = () => {
        setFromTable("");
        setToTable("");
        setError(null);
        setOkMsg(null);
        setBusy(false);
    };

    const handleOpen = () => {
        resetDialog();
        setOpen(true);
    };

    const handleClose = async () => {
        setOpen(false);
        if (onAfterClose) await onAfterClose();
    };

    async function moveTableOrders() {
        setError(null);
        setOkMsg(null);

        if (!fromTable || !toTable) {
            setError("Lütfen hem kaynak hem hedef masayı seç.");
            return;
        }
        if (fromTable === toTable) {
            setError("Kaynak ve hedef masa aynı olamaz.");
            return;
        }

        setBusy(true);
        try {
            const fromRef = ref(db, `${ORDERS_ROOT}/${fromTable}`);
            const toRef = ref(db, `${ORDERS_ROOT}/${toTable}`);

            const fromSnap = await get(fromRef);
            if (!fromSnap.exists()) {
                setError(`"${fromTable}" masasında taşınacak sipariş bulunamadı.`);
                return;
            }
            const fromData = fromSnap.val();

            const toSnap = await get(toRef);
            if (toSnap.exists()) {
                setError(
                    `"${toTable}" masasında zaten sipariş var. Önce hedef masayı boşalt ya da farklı hedef seç.`
                );
                return;
            }

            const updates: Record<string, unknown> = {};
            updates[`${ORDERS_ROOT}/${toTable}`] = fromData;
            updates[`${ORDERS_ROOT}/${fromTable}`] = null;

            await update(ref(db), updates);

            dispatch(showNotify({
                message: `Siparişler "${fromTable}" masasından "${toTable}" masasına taşındı.`,
                severity: "success",
            }));
            await handleClose();
        } catch (e: any) {
            setError(e?.message ?? "Beklenmeyen hata oluştu.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    width: "100%",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                    }}
                >
                    <Typography sx={{ fontWeight: 900, fontSize: 16 }}>
                        Toplam: {loading ? "…" : list.length} masa
                    </Typography>

                    {isAdmin && (
                        <PremiumSwitch
                            checked={isOrder}
                            onChange={(_, checked) => {
                                void handleSwitchChange(checked);
                            }}
                            disabled={switchBusy}
                        />
                    )}
                </Box>

                <Button
                    variant="contained"
                    startIcon={<SwapHorizIcon />}
                    onClick={user?.isAdmin ? handleOpen : undefined}
                    disabled={loading || tableOptions.length < 2 || user?.isAdmin === false}
                >
                    Masa Değiştir
                </Button>

            </Box>

            <ConfirmDialog
                open={open}
                title="Masa Değiştir"
                confirmText={busy ? "Güncelleniyor…" : "Güncelle"}
                cancelText="İptal"
                busy={busy}
                onClose={handleClose}
                onConfirm={async () => {
                    await moveTableOrders();
                }}
            >
                <Box sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                    {error && <Alert severity="error">{error}</Alert>}
                    {okMsg && <Alert severity="success">{okMsg}</Alert>}

                    <FormControl fullWidth>
                        <InputLabel id="fromTableLabel">Mevcut Masa</InputLabel>
                        <Select
                            labelId="fromTableLabel"
                            label="Kaynak Masa"
                            value={fromTable}
                            onChange={(e) => setFromTable(String(e.target.value))}
                            disabled={busy}
                        >
                            {tableOptions.map((id) => (
                                <MenuItem key={id} value={id}>
                                    {id}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth>
                        <InputLabel id="toTableLabel">Yeni Masa</InputLabel>
                        <Select
                            labelId="toTableLabel"
                            label="Hedef Masa"
                            value={toTable}
                            onChange={(e) => setToTable(String(e.target.value))}
                            disabled={busy}
                        >
                            {tableOptions.map((id) => (
                                <MenuItem key={id} value={id}>
                                    {id}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <ConfirmDialog
                        open={confirmOpen}
                        title="Masaları değiştirmek istiyor musunuz?"
                        description={fromTable && toTable ? `Kaynak: ${fromTable} → Hedef: ${toTable}` : undefined}
                        confirmText="Evet, değiştir"
                        cancelText="Vazgeç"
                        busy={busy}
                        onClose={() => setConfirmOpen(false)}
                        onConfirm={async () => {
                            await moveTableOrders();
                            setConfirmOpen(false);
                        }}
                    />
                </Box>
            </ConfirmDialog>
        </>
    );
};