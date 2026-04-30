import { useCallback } from "react";
import {
    Box,
    Button,
    IconButton,
    TextField,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

export type OptionItem = {
    id: number;
    key?: string;
    label: string;
    price?: number | null;
};

export type OptionsCatalog = OptionItem[];

type Props = {
    items: OptionItem[];
    onChange: (items: OptionItem[]) => void;
    disabled?: boolean;
};

export const OptionsCatalogField = ({ items: rawItems, onChange, disabled = false }: Props) => {
    const items = rawItems ?? [];

    const addItem = useCallback(() => {
        onChange([...items, { id: Date.now(), key: "", label: "", price: null }]);
    }, [items, onChange]);

    const removeItem = useCallback((idx: number) => {
        onChange(items.filter((_, i) => i !== idx));
    }, [items, onChange]);

    const updateItem = useCallback((idx: number, field: keyof OptionItem, val: string) => {
        onChange(items.map((item, i) =>
            i === idx
                ? {
                    ...item,
                    [field]: field === "price"
                        ? (val === "" ? null : Number(val))
                        : val,
                }
                : item
        ));
    }, [items, onChange]);

    return (
        <Box sx={{ display: "grid", gap: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: "text.secondary" }}>
                    Seçenekler
                </Typography>
                <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addItem}
                    disabled={disabled}
                    sx={{ fontSize: 12, textTransform: "none" }}
                >
                    Seçenek Ekle
                </Button>
            </Box>

            {items.length === 0 && (
                <Typography sx={{ fontSize: 12, color: "text.disabled" }}>
                    Henüz seçenek yok. "Seçenek Ekle" ile başlayın.
                </Typography>
            )}

            {items.map((item, idx) => (
                <Box
                    key={item.id}
                    sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 80px 32px",
                        gap: 0.75,
                        alignItems: "center",
                    }}
                >
                    <TextField
                        label="Label"
                        value={item.label}
                        onChange={(e) => updateItem(idx, "label", e.target.value)}
                        size="small"
                        disabled={disabled}
                        inputProps={{ maxLength: 50 }}
                        sx={{ "& .MuiInputBase-input": { fontSize: 13 } }}
                    />
                    <TextField
                        label="Key (opsiyonel)"
                        value={item.key ?? ""}
                        onChange={(e) => updateItem(idx, "key", e.target.value)}
                        size="small"
                        disabled={disabled}
                        inputProps={{ maxLength: 40 }}
                        sx={{ "& .MuiInputBase-input": { fontSize: 13 } }}
                    />
                    <TextField
                        label="Fiyat"
                        value={item.price == null ? "" : String(item.price)}
                        onChange={(e) => {
                            if (/^\d*$/.test(e.target.value)) updateItem(idx, "price", e.target.value);
                        }}
                        size="small"
                        disabled={disabled}
                        placeholder="—"
                        inputProps={{ inputMode: "numeric" }}
                        sx={{ "& .MuiInputBase-input": { fontSize: 13 } }}
                    />
                    <IconButton
                        size="small"
                        onClick={() => removeItem(idx)}
                        disabled={disabled}
                        sx={{ color: "error.main" }}
                    >
                        <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                </Box>
            ))}
        </Box>
    );
};