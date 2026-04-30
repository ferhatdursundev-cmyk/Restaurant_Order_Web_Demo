import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    Box,
    IconButton,
    TextField,
    Typography,
    Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { ConfirmDialog } from "../../component";
import { db } from "../../firebase/firebase";
import { ref, onValue, update, remove, set } from "firebase/database";
import { useAppDispatch, show as showNotify } from "../../store";
import { getStorage, ref as storageRef, listAll, deleteObject } from "firebase/storage";

type EditRow = {
    key: string;
    active: boolean;
    order: number;
    tr: string;
    de: string;
    en: string;
    ru: string;
    isNew?: boolean;
    markedForDelete?: boolean;
};

type Props = {
    open: boolean;
    onClose: () => void;
    onSaved: () => void;
};

const LANG_FIELDS: { code: "tr" | "de" | "en" | "ru"; flag: string; label: string }[] = [
    { code: "tr", flag: "🇹🇷", label: "Türkçe" },
    { code: "de", flag: "🇩🇪", label: "Almanca" },
    { code: "en", flag: "🇬🇧", label: "İngilizce" },
    { code: "ru", flag: "🇷🇺", label: "Rusça" },
];

function toKey(str: string) {
    return str.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 32);
}

export const ManageCategoriesDialog = ({ open, onClose, onSaved }: Props) => {
    const dispatch = useAppDispatch();

    const [rows,    setRows]    = useState<EditRow[]>([]);
    const [busy,    setBusy]    = useState(false);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [overIdx, setOverIdx] = useState<number | null>(null);

    // menu node = kaynak, __meta__ node'u = label/sira bilgisi
    useEffect(() => {
        if (!open) return;

        let menuKeys: string[] = [];
        let metaData: Record<string, { active?: boolean; order?: number; labels?: { tr?: string; de?: string; en?: string; ru?: string } }> = {};
        let menuLoaded = false;
        let metaLoaded = false;

        const merge = () => {
            if (!menuLoaded || !metaLoaded) return;
            setRows((prev) => {
                const prevMap = new Map(prev.map((r) => [r.key, r]));
                return menuKeys
                    .map((key, i) => {
                        if (prevMap.has(key)) return prevMap.get(key)!;
                        const meta = metaData[key];
                        return {
                            key,
                            active: meta?.active ?? true,
                            order:  meta?.order ?? i,
                            tr: meta?.labels?.tr ?? key,
                            de: meta?.labels?.de ?? "",
                            en: meta?.labels?.en ?? "",
                            ru: meta?.labels?.ru ?? "",
                        };
                    })
                    .sort((a, b) => a.order - b.order);
            });
        };

        const unsubMenu = onValue(ref(db, "menu"), (snap) => {
            menuKeys = snap.exists() ? Object.keys(snap.val()) : [];
            menuLoaded = true;
            merge();
        });

        const unsubMeta = onValue(ref(db, "menuCategoryTranslations"), (snap) => {
            metaData = snap.exists() ? snap.val() : {};
            metaLoaded = true;
            merge();
        });

        return () => { unsubMenu(); unsubMeta(); };
    }, [open]);

    const duplicateKeys = useMemo(() => {
        const active = rows.filter((r) => !r.markedForDelete);
        const keys = active.map((r) => r.isNew ? toKey(r.tr) : r.key);
        const seen = new Set<string>();
        const dupes = new Set<string>();
        keys.forEach((k) => { if (seen.has(k)) dupes.add(k); else seen.add(k); });
        return dupes;
    }, [rows]);

    const handleMarkDelete  = useCallback((idx: number) => setRows((prev) => prev.map((r, i) => i === idx ? { ...r, markedForDelete: !r.markedForDelete } : r)), []);
    const handleLabelChange = useCallback((idx: number, lang: "tr" | "de" | "en" | "ru", val: string) => {
        setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [lang]: val } : r));
    }, []);

    const handleAddRow = useCallback(() => {
        setRows((prev) => [...prev, { key: "", active: true, order: prev.length, tr: "", de: "", en: "", ru: "", isNew: true }]);
    }, []);

    const handleDragStart = useCallback((idx: number) => setDragIdx(idx), []);
    const handleDragOver  = useCallback((e: React.DragEvent, idx: number) => { e.preventDefault(); setOverIdx(idx); }, []);
    const handleDrop      = useCallback((idx: number) => {
        if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setOverIdx(null); return; }
        setRows((prev) => {
            const next = [...prev];
            const [moved] = next.splice(dragIdx, 1);
            next.splice(idx, 0, moved!);
            return next.map((r, i) => ({ ...r, order: i }));
        });
        setDragIdx(null); setOverIdx(null);
    }, [dragIdx]);
    const handleDragEnd = useCallback(() => { setDragIdx(null); setOverIdx(null); }, []);

    const handleSave = useCallback(async () => {
        const activeRows = rows.filter((r) => !r.markedForDelete);
        const toDelete   = rows.filter((r) => r.markedForDelete && !r.isNew);

        for (const r of activeRows) {
            if (!r.tr.trim()) {
                dispatch(showNotify({ message: "Her kategorinin Türkçe adı zorunludur.", severity: "error" }));
                return;
            }
        }
        if (duplicateKeys.size > 0) {
            dispatch(showNotify({ message: `Tekrarlayan key: ${[...duplicateKeys].join(", ")}`, severity: "error" }));
            return;
        }

        setBusy(true);
        try {
            const menuUpdates: Record<string, unknown> = {};
            const metaPayload: Record<string, object> = {};

            activeRows.forEach((r, i) => {
                const key = r.isNew ? toKey(r.tr) || `cat_${i}` : r.key;
                metaPayload[key] = { active: r.active, order: i, labels: { tr: r.tr.trim(), de: r.de.trim(), en: r.en.trim(), ru: r.ru.trim() } };
                if (r.isNew) {
                    menuUpdates[`menu/${key}/__placeholder__`] = {
                        id: Date.now(), title: r.tr.trim(), isAvailable: false,
                        type: key, keyTitle: "__placeholder__", price: 0,
                    };
                }
            });

            // meta bilgisini menuMeta node'una kaydet
            await set(ref(db, "menuCategoryTranslations"), metaPayload);
            if (Object.keys(menuUpdates).length > 0) await update(ref(db, "/"), menuUpdates);

            for (const r of toDelete) {
                await remove(ref(db, `menu/${r.key}`));
                await remove(ref(db, `menuCategoryTranslations/${r.key}`));

                // Storage'daki kategori klasörünü temizle
                try {
                    const storage = getStorage();
                    const folderRef = storageRef(storage, `menu/${r.key}`);
                    const listed = await listAll(folderRef);
                    await Promise.all(listed.items.map((item) => deleteObject(item)));
                } catch (e) {
                    console.warn(`Storage temizlenemedi: ${r.key}`, e);
                }
            }

            dispatch(showNotify({ message: "Kategoriler kaydedildi.", severity: "success" }));
            onSaved();
            onClose();
        } catch {
            dispatch(showNotify({ message: "Kaydedilemedi. Yetki hatasi.", severity: "error" }));
        } finally {
            setBusy(false);
        }
    }, [rows, duplicateKeys, dispatch, onSaved, onClose]);

    const handleClose    = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
    const toDeleteCount  = rows.filter((r) => r.markedForDelete).length;

    return (
        <ConfirmDialog
            open={open}
            title={
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <Typography sx={{ fontWeight: 900, fontSize: 17 }}>Kategorileri Yönet</Typography>
                    <Tooltip title="Yeni kategori ekle">
                        <IconButton size="small" onClick={handleAddRow} disabled={busy}
                                    sx={{ bgcolor: "#4caf50", color: "white", width: 28, height: 28, "&:hover": { bgcolor: "#388e3c" } }}>
                            <AddIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            }
            confirmText={busy ? "Kaydediliyor..." : "Kaydet"}
            cancelText="İptal"
            busy={busy}
            maxWidth="md"
            maxHeight="85vh"
            onClose={handleClose}
            onConfirm={handleSave}
        >
            <Box sx={{ display: "grid", gap: 1, pt: 1 }}>
                <Box sx={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr 1fr 1fr 32px", gap: 1, px: 0.5 }}>
                    <Box />
                    {LANG_FIELDS.map((l) => (
                        <Typography key={l.code} sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary", textAlign: "center" }}>
                            {l.flag} {l.label}
                        </Typography>
                    ))}
                    <Box />
                </Box>

                {rows.map((row, idx) => {
                    const computedKey = row.isNew ? toKey(row.tr) : row.key;
                    const isDupe = !row.markedForDelete && duplicateKeys.has(computedKey);
                    return (
                        <Box
                            key={`${row.key}-${idx}`}
                            draggable={!row.markedForDelete}
                            onDragStart={() => handleDragStart(idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDrop={() => handleDrop(idx)}
                            onDragEnd={handleDragEnd}
                            sx={{
                                display: "grid", gridTemplateColumns: "32px 1fr 1fr 1fr 1fr 32px",
                                gap: 1, alignItems: "center", px: 0.5, py: 0.5, borderRadius: 2,
                                border: "1px solid",
                                borderColor: isDupe ? "error.main" : overIdx === idx ? "primary.main" : "divider",
                                bgcolor: row.markedForDelete ? "rgba(229,57,53,0.07)"
                                    : overIdx === idx ? "action.hover"
                                        : dragIdx === idx ? "action.selected" : "transparent",
                                opacity: row.markedForDelete ? 0.5 : 1,
                                transition: "all 150ms",
                                cursor: row.markedForDelete ? "default" : "grab",
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center" }}>
                                <Typography sx={{ fontSize: 11, color: "text.disabled", minWidth: 14 }}>{idx + 1}</Typography>
                                <DragIndicatorIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                            </Box>

                            {LANG_FIELDS.map((l) => (
                                <TextField
                                    key={l.code}
                                    value={row[l.code]}
                                    onChange={(e) => handleLabelChange(idx, l.code, e.target.value)}
                                    placeholder={l.label}
                                    size="small"
                                    disabled={busy || row.markedForDelete}
                                    error={l.code === "tr" && !row.tr.trim() && !row.markedForDelete}
                                    inputProps={{ maxLength: 40 }}
                                    sx={{ "& .MuiInputBase-input": { fontSize: 13, py: 0.75 } }}
                                />
                            ))}

                            <Tooltip title={row.markedForDelete ? "Geri al" : "Sil"}>
                                <IconButton size="small" onClick={() => handleMarkDelete(idx)} disabled={busy}
                                            sx={{ color: row.markedForDelete ? "text.disabled" : "error.main" }}>
                                    <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    );
                })}

                {rows.length === 0 && (
                    <Typography sx={{ color: "text.disabled", textAlign: "center", py: 3, fontSize: 13 }}>
                        Henüz kategori yok. + butonuyla ekleyin.
                    </Typography>
                )}

                {toDeleteCount > 0 && (
                    <Typography sx={{ fontSize: 12, color: "error.main", mt: 0.5 }}>
                        {toDeleteCount} kategori Kaydet'e basılınca kalıcı olarak silinecek.
                    </Typography>
                )}
            </Box>
        </ConfirmDialog>
    );
};