// import { useEffect, useMemo, useState } from "react";
// import {
//     Alert,
//     Avatar,
//     Box,
//     Button,
//     Card,
//     CardContent,
//     Checkbox,
//     Chip,
//     Dialog,
//     DialogActions,
//     DialogContent,
//     DialogTitle,
//     Divider,
//     Skeleton,
//     Stack,
//     Typography,
//     IconButton,
//     FormControlLabel,
//     Tooltip,
// } from "@mui/material";
// import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
// import PrintIcon from "@mui/icons-material/Print";
// import RestartAltIcon from "@mui/icons-material/RestartAlt";
// import { useTheme, useMediaQuery } from "@mui/material";
// import { ref, remove, update, get } from "firebase/database";
// import { db } from "../../firebase/firebase";
//
// import type {
//     OrdersMap,
//     SelectedTable,
//     ConfirmState,
//     SelectionKey,
//     OrderItem,
// } from "./utils";
//
// import { fmtDate } from "./utils/orderFormat";
// import { buildOrdersList } from "./utils/buildOrdersList";
// import {
//     selKeyToString,
//     toggleSelection,
//     toggleAllItemsForOrder,
//     allItemsSelectedForOrder,
//     someItemsSelectedForOrder,
// } from "./utils/selection";
// import {
//     computeSelectedItemsForRight,
//     computeRightTotal,
//     computeGrandTotal,
// } from "./utils/computeSelectedRight";
// import {
//     deleteOrderNode,
//     deleteCartItem,
//     applyLocalDeleteOrderNode,
//     applyLocalDeleteOrderSelections,
//     applyLocalDeleteCartItemSelection,
//     applyLocalUpdateOrder,
// } from "./utils/rtdbMutations";
// import { handlePaySelected } from "./utils/handlePaySelected";
// import { ConfirmDialog } from "../../component/ConfirmDialog";
// import {useAuth} from "../../auth/aut.context.tsx";
//
// type Props = {
//     open: boolean;
//     onClose: () => void;
//     table: SelectedTable;
//     loading: boolean;
//     error: string | null;
//     orders: OrdersMap | null;
// };
//
// export const TableOrdersDialog = ({
//                                       open,
//                                       onClose,
//                                       table,
//                                       loading,
//                                       error,
//                                       orders,
//                                   }: Props) => {
//     const { user } = useAuth();
//     const [localOrders, setLocalOrders] = useState<OrdersMap | null>(orders);
//     const [confirm, setConfirm] = useState<ConfirmState>({ open: false });
//     const [confirmBusy, setConfirmBusy] = useState(false);
//     const [selected, setSelected] = useState<Record<string, true>>({});
//     const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
//
//     const theme = useTheme();
//     const isMobile = useMediaQuery(theme.breakpoints.down("md"));
//
//     useEffect(() => {
//         setLocalOrders(orders);
//     }, [orders]);
//
//     useEffect(() => {
//         if (!open) setSelected({});
//     }, [open]);
//
//     const ordersList = useMemo(() => buildOrdersList(localOrders), [localOrders]);
//
//     const openConfirm = (next: Omit<Extract<ConfirmState, { open: true }>, "open">) => {
//         setConfirm({ open: true, ...next });
//     };
//
//     const closeConfirm = () => {
//         if (confirmBusy) return;
//         setConfirm({ open: false });
//     };
//
//     const runConfirm = async () => {
//         if (!confirm.open) return;
//         try {
//             setConfirmBusy(true);
//             await confirm.action();
//             setConfirm({ open: false });
//         } finally {
//             setConfirmBusy(false);
//         }
//     };
//
//     const isSelected = (k: SelectionKey) => !!selected[selKeyToString(k)];
//
//     const toggle = (k: SelectionKey) => {
//         setSelected((prev) => toggleSelection(prev, k));
//     };
//
//     const toggleAll = (orderId: string, items: OrderItem[]) => {
//         setSelected((prev) => toggleAllItemsForOrder(prev, orderId, items));
//     };
//
//     const allSel = (orderId: string, items: OrderItem[]) =>
//         allItemsSelectedForOrder(orderId, items, isSelected);
//
//     const someSel = (orderId: string, items: OrderItem[]) =>
//         someItemsSelectedForOrder(orderId, items, isSelected);
//
//     const handleDeleteOrderNode = async (orderId: string) => {
//         await deleteOrderNode(orderId, table);
//
//         setLocalOrders((prev) => applyLocalDeleteOrderNode(orderId, prev));
//         setSelected((prev) => applyLocalDeleteOrderSelections(orderId, prev));
//     };
//
//     const handleDeleteCartItem = async (orderId: string, cartId: string) => {
//         const res = await deleteCartItem(orderId, cartId, table, localOrders);
//         if (!res) return;
//
//         setLocalOrders((prev) =>
//             applyLocalUpdateOrder(orderId, prev, res.nextItemsForWrite, res.nextTotal),
//         );
//         setSelected((prev) => applyLocalDeleteCartItemSelection(orderId, cartId, prev));
//     };
//
//     const handlePrintOrder = async (o: any) => {
//         if (printingOrderId === o.orderId) return;
//
//         try {
//             setPrintingOrderId(o.orderId);
//
//             const items = (o.itemsArr || []).map((it: any) => {
//                 const qty = it.qty ?? 1;
//                 const unit = typeof it.unitPrice === "number" ? it.unitPrice : 0;
//
//                 return {
//                     title: it.title ?? it.productId ?? "Ürün",
//                     qty,
//                     note: it.note ?? "",
//                     lineTotal: unit * qty,
//                 };
//             });
//
//             const total = items.reduce((sum: number, x: any) => sum + (x.lineTotal || 0), 0);
//
//             const res = await fetch("http://127.0.0.1:43125/print", {
//                 method: "POST",
//                 headers: {
//                     "Content-Type": "application/json",
//                 },
//                 body: JSON.stringify({
//                     orderId: o.orderId,
//                     tableName: table?.name || "Masa",
//                     items,
//                     total,
//                 }),
//             });
//
//             const json = await res.json();
//
//             if (!res.ok || !json.ok) {
//                 throw new Error(json.error || "Yazdırma başarısız");
//             }
//         } finally {
//             setPrintingOrderId(null);
//         }
//     };
//
//     const handleResetTableCart = async () => {
//         if (!table?.id) return;
//
//         try {
//             const resetTs = Date.now();
//
//             const liveCartSnap = await get(ref(db, `liveCartByTable/${table.id}`));
//             const liveCartVal = liveCartSnap.val() || {};
//
//             const updates: Record<string, number> = {
//                 [`tableCartSignals/${table.id}/lastResetAt`]: resetTs,
//             };
//
//             Object.keys(liveCartVal).forEach((token) => {
//                 updates[`tableCartSignals/${table.id}/${token}/lastResetAt`] = resetTs;
//             });
//
//             await update(ref(db), updates);
//             await remove(ref(db, `liveCartByTable/${table.id}`));
//
//             setSelected({});
//         } catch (err) {
//             console.error("handleResetTableCart error:", err);
//             throw err;
//         }
//     };
//
//     const selectedItemsForRight = useMemo(
//         () => computeSelectedItemsForRight(localOrders, isSelected),
//         [localOrders, selected]
//     );
//
//     const rightTotal = useMemo(() => computeRightTotal(selectedItemsForRight), [selectedItemsForRight]);
//
//     const grandTotal = useMemo(() => computeGrandTotal(localOrders), [localOrders]);
//
//     const onPayClick = () => {
//         openConfirm({
//             title: "Ödeme yapmak istediğinize emin misiniz?",
//             description: `Seçilen toplam: ${(rightTotal)}TL`,
//             confirmLabel: "Öde",
//             action: async () => {
//                 try {
//                     await handlePaySelected({
//                         table,
//                         selected,
//                         localOrders,
//                         setLocalOrders,
//                         setSelected,
//                     });
//                 } catch (e) {
//                     const msg = e instanceof Error ? e.message : String(e);
//                     openConfirm({
//                         title: "Ödeme hatası",
//                         description: msg,
//                         confirmLabel: "Tamam",
//                         action: async () => {},
//                     });
//                     throw e;
//                 }
//             },
//         });
//     };
//
//     const payDisabled = selectedItemsForRight.length === 0 || rightTotal <= 0;
//
//     return (
//         <>
//             <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
//                 <DialogTitle
//                     sx={{
//                         fontWeight: 900,
//                         display: "flex",
//                         alignItems: "center",
//                         justifyContent: "space-between",
//                         gap: 2,
//                     }}
//                 >
//                     <Box component="span">
//                         {table ? `${table.name} — Siparişler` : "Siparişler"}
//                     </Box>
//
//                     <Tooltip title="Masayı yeni müşteri için sıfırla">
//                         <span>
//                             <Button
//                                 variant="outlined"
//                                 color="warning"
//                                 size="small"
//                                 startIcon={<RestartAltIcon />}
//                                 disabled={!table?.id}
//                                 onClick={() =>
//                                     openConfirm({
//                                         title: "Masayı sıfırlamak istiyor musunuz?",
//                                         description:
//                                             "Bu işlem aynı masadaki gönderilmemiş canlı sepeti temizler. Açık müşteri cihazlarının sepeti de temizlenir.",
//                                         confirmLabel: "Masayı Sıfırla",
//                                         action: handleResetTableCart,
//                                     })
//                                 }
//                                 sx={{ fontWeight: 800, borderRadius: 999 }}
//                             >
//                                 Reset
//                             </Button>
//                         </span>
//                     </Tooltip>
//                 </DialogTitle>
//
//                 <DialogContent dividers sx={{ p: isMobile ? 1 : 2 }}>
//                     {error && <Alert severity="error">{error}</Alert>}
//
//                     {!error && loading && (
//                         <Stack spacing={1.2}>
//                             {Array.from({ length: 6 }).map((_, i) => (
//                                 <Card key={i} variant="outlined" sx={{ borderRadius: 3 }}>
//                                     <CardContent>
//                                         <Skeleton width="40%" />
//                                         <Skeleton width="70%" />
//                                         <Skeleton width="55%" />
//                                     </CardContent>
//                                 </Card>
//                             ))}
//                         </Stack>
//                     )}
//
//                     {!error && !loading && ordersList.length === 0 && (
//                         <Alert severity="info">
//                             Bu masaya ait sipariş yok.{" "}
//                             {table?.id ? <span>(ordersByTable/{table.id})</span> : null}
//                         </Alert>
//                     )}
//
//                     {!error && !loading && ordersList.length > 0 && (
//                         <Stack direction={isMobile ? "column" : "row"} spacing={2} alignItems="stretch">
//                             <Box sx={{ flex: 1, minWidth: 0, width: isMobile ? "100%" : "auto" }}>
//                                 <Stack spacing={1.25}>
//                                     {ordersList.map((o) => (
//                                         <Card key={o.orderId} variant="outlined" sx={{ borderRadius: 3 }}>
//                                             <CardContent sx={{ display: "grid", gap: 1 }}>
//                                                 <Stack direction="row" justifyContent="space-between" alignItems="center">
//                                                     <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
//                                                         <Checkbox
//                                                             size="small"
//                                                             checked={isSelected({ kind: "order", orderId: o.orderId })}
//                                                             onChange={() => toggle({ kind: "order", orderId: o.orderId })}
//                                                         />
//
//                                                         <IconButton
//                                                             size="small"
//                                                             disabled={!!user && !user.isAdmin}
//                                                             onClick={() =>
//                                                                 openConfirm({
//                                                                     title: "Siparişi sil?",
//                                                                     description: `Sipariş ID: ${o.orderId}`,
//                                                                     confirmLabel: "Sil",
//                                                                     action: () => handleDeleteOrderNode(o.orderId),
//                                                                 })
//                                                             }
//                                                             sx={{ color: "error.main" }}
//                                                             aria-label="Siparişi sil"
//                                                         >
//                                                             <DeleteOutlineIcon />
//                                                         </IconButton>
//
//                                                         <Typography sx={{ fontWeight: 900 }} noWrap>
//                                                             Sipariş: {o.orderId}
//                                                         </Typography>
//                                                     </Stack>
//
//                                                     <Stack direction="row" spacing={1} alignItems="center">
//                                                         <Tooltip title="Siparişi yazdır">
//                                                             <span>
//                                                                 <IconButton
//                                                                     size="small"
//                                                                     onClick={() => handlePrintOrder(o)}
//                                                                     disabled={printingOrderId === o.orderId || !table?.id}
//                                                                     sx={{
//                                                                         color: "primary.main",
//                                                                         bgcolor: "action.hover",
//                                                                         "&:hover": {
//                                                                             bgcolor: "primary.main",
//                                                                             color: "#fff",
//                                                                         },
//                                                                     }}
//                                                                     aria-label="Siparişi yazdır"
//                                                                 >
//                                                                     <PrintIcon fontSize="small" />
//                                                                 </IconButton>
//                                                             </span>
//                                                         </Tooltip>
//
//                                                         {typeof o.total === "number" && (
//                                                             <Chip size="small" label={`${o.total} TL`} />
//                                                         )}
//                                                     </Stack>
//                                                 </Stack>
//
//                                                 <Typography variant="caption" sx={{ color: "text.secondary" }}>
//                                                     {fmtDate(o.createdAtMs)}
//                                                 </Typography>
//
//                                                 <Divider />
//
//                                                 <Stack spacing={0.75} sx={{ pl: 4 }}>
//                                                     <FormControlLabel
//                                                         sx={{ m: 0, ml: -1 }}
//                                                         control={
//                                                             <Checkbox
//                                                                 size="small"
//                                                                 checked={allSel(o.orderId, o.itemsArr)}
//                                                                 indeterminate={
//                                                                     !allSel(o.orderId, o.itemsArr) &&
//                                                                     someSel(o.orderId, o.itemsArr)
//                                                                 }
//                                                                 onChange={() => toggleAll(o.orderId, o.itemsArr)}
//                                                             />
//                                                         }
//                                                         label={
//                                                             <Typography
//                                                                 variant="caption"
//                                                                 sx={{ color: "text.secondary", fontWeight: 800 }}
//                                                             >
//                                                                 Bu siparişteki ürünleri seç
//                                                             </Typography>
//                                                         }
//                                                     />
//
//                                                     {o.itemsArr.map((it, idx) => {
//                                                         const qty = it.qty ?? 1;
//                                                         const unit =
//                                                             typeof it.unitPrice === "number" ? it.unitPrice : 0;
//                                                         const lineTotal = unit * qty;
//                                                         const cartId = it.cartId;
//
//                                                         return (
//                                                             <Stack
//                                                                 key={`${o.orderId}-${cartId ?? idx}`}
//                                                                 direction="row"
//                                                                 justifyContent="space-between"
//                                                                 alignItems="center"
//                                                                 spacing={1}
//                                                             >
//                                                                 <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
//                                                                     <Checkbox
//                                                                         size="small"
//                                                                         disabled={!cartId}
//                                                                         checked={
//                                                                             cartId
//                                                                                 ? isSelected({
//                                                                                     kind: "item",
//                                                                                     orderId: o.orderId,
//                                                                                     cartId,
//                                                                                 })
//                                                                                 : false
//                                                                         }
//                                                                         onChange={() =>
//                                                                             cartId
//                                                                                 ? toggle({
//                                                                                     kind: "item",
//                                                                                     orderId: o.orderId,
//                                                                                     cartId,
//                                                                                 })
//                                                                                 : undefined
//                                                                         }
//                                                                     />
//
//                                                                     <IconButton
//                                                                         size="small"
//                                                                         disabled={!!user && !user.isAdmin || !cartId}
//                                                                         onClick={() =>
//                                                                             cartId && !!user && !user.isAdmin
//                                                                                 ? openConfirm({
//                                                                                     title: "Ürünü sil?",
//                                                                                     description: `${it.title ?? it.productId ?? "Ürün"} (cartId: ${cartId})`,
//                                                                                     confirmLabel: "Sil",
//                                                                                     action: () => handleDeleteCartItem(o.orderId, cartId),
//                                                                                 })
//                                                                                 : undefined
//                                                                         }
//                                                                         sx={{ color: "error.main" }}
//                                                                         aria-label="Ürünü sil"
//                                                                     >
//                                                                         <DeleteOutlineIcon />
//                                                                     </IconButton>
//
//                                                                     {it.image ? (
//                                                                         <Avatar
//                                                                             variant="rounded"
//                                                                             src={it.image}
//                                                                             alt={it.title ?? "Ürün"}
//                                                                             sx={{ width: 44, height: 44, borderRadius: 2 }}
//                                                                         />
//                                                                     ) : (
//                                                                         <Box
//                                                                             sx={{
//                                                                                 width: 44,
//                                                                                 height: 44,
//                                                                                 borderRadius: 2,
//                                                                                 bgcolor: "action.hover",
//                                                                             }}
//                                                                         />
//                                                                     )}
//
//                                                                     <Box sx={{ minWidth: 0 }}>
//                                                                         <Typography sx={{ fontWeight: 800 }} noWrap>
//                                                                             {it.title ?? it.productId ?? "Ürün"}
//                                                                         </Typography>
//
//                                                                         <Typography variant="caption" sx={{ color: "text.secondary" }}>
//                                                                             Note: {it?.note && it.note.length > 0 ? it.note : "Yok"}
//                                                                         </Typography>
//                                                                     </Box>
//                                                                 </Stack>
//
//                                                                 <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 700 }}>
//                                                                     {`${lineTotal} TL`}
//                                                                 </Typography>
//                                                             </Stack>
//                                                         );
//                                                     })}
//                                                 </Stack>
//                                             </CardContent>
//                                         </Card>
//                                     ))}
//
//                                     <Divider />
//
//                                     <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 0.5 }}>
//                                         <Typography sx={{ fontWeight: 900 }}>Genel Toplam</Typography>
//                                         <Typography sx={{ fontWeight: 900 }}>{`${grandTotal} TL`}</Typography>
//                                     </Stack>
//                                 </Stack>
//                             </Box>
//
//                             <Box
//                                 sx={{
//                                     width: isMobile ? "100%" : 380,
//                                     maxWidth: isMobile ? "100%" : "40%",
//                                     minWidth: isMobile ? 0 : 320,
//                                 }}
//                             >
//                                 <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
//                                     <CardContent sx={{ display: "grid", gap: 1 }}>
//                                         <Typography sx={{ fontWeight: 900 }}>Seçilenler</Typography>
//                                         <Divider />
//
//                                         {selectedItemsForRight.length === 0 ? (
//                                             <Typography variant="body2" sx={{ color: "text.secondary" }}>
//                                                 Seçim yapınca buraya aktarılacak.
//                                             </Typography>
//                                         ) : (
//                                             <Stack spacing={1}>
//                                                 {selectedItemsForRight.map((x, i) => {
//                                                     const qty = x.item.qty ?? 1;
//                                                     const unit =
//                                                         typeof x.item.unitPrice === "number" ? x.item.unitPrice : 0;
//                                                     const lineTotal = unit * qty;
//
//                                                     return (
//                                                         <Stack
//                                                             key={`${x.orderId}-${x.item.cartId ?? i}`}
//                                                             direction="row"
//                                                             justifyContent="space-between"
//                                                             alignItems="center"
//                                                             spacing={1}
//                                                         >
//                                                             <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
//                                                                 {x.item.image ? (
//                                                                     <Avatar
//                                                                         variant="rounded"
//                                                                         src={x.item.image}
//                                                                         alt={x.item.title ?? "Ürün"}
//                                                                         sx={{ width: 36, height: 36, borderRadius: 2 }}
//                                                                     />
//                                                                 ) : (
//                                                                     <Box
//                                                                         sx={{
//                                                                             width: 36,
//                                                                             height: 36,
//                                                                             borderRadius: 2,
//                                                                             bgcolor: "action.hover",
//                                                                         }}
//                                                                     />
//                                                                 )}
//
//                                                                 <Box sx={{ minWidth: 0 }}>
//                                                                     <Typography sx={{ fontWeight: 800 }} noWrap>
//                                                                         {x.item.title ?? x.item.productId ?? "Ürün"}
//                                                                     </Typography>
//                                                                     <Typography variant="caption" sx={{ color: "text.secondary" }}>
//                                                                         {`Note: ${x?.item?.note && x.item.note.length > 0 ? x.item.note : "Yok"}`}
//                                                                     </Typography>
//                                                                 </Box>
//                                                             </Stack>
//
//                                                             <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 700 }}>
//                                                                 {`${(lineTotal)}TL`}
//                                                             </Typography>
//                                                         </Stack>
//                                                     );
//                                                 })}
//                                             </Stack>
//                                         )}
//
//                                         <Divider />
//
//                                         <Stack direction="row" justifyContent="space-between" alignItems="center">
//                                             <Typography sx={{ fontWeight: 900 }}>Seçilen Toplam</Typography>
//                                             <Typography sx={{ fontWeight: 900 }}>{`${rightTotal} TL`}</Typography>
//                                         </Stack>
//
//                                         <Button
//                                             variant="contained"
//                                             onClick={onPayClick}
//                                             disabled={user && !user.isAdmin || payDisabled}
//                                             sx={{ mt: 1, fontWeight: 900 }}
//                                         >
//                                             Ödeme Al
//                                         </Button>
//
//                                         <Typography variant="caption" sx={{ color: "text.secondary" }}>
//                                             Ödeme onaylanınca ödemesi alınan ürünler silinir.
//                                         </Typography>
//                                     </CardContent>
//                                 </Card>
//                             </Box>
//                         </Stack>
//                     )}
//                 </DialogContent>
//
//                 <DialogActions sx={{ px: 2, py: 1.5 }}>
//                     <Button onClick={onClose} variant="contained">
//                         Kapat
//                     </Button>
//                 </DialogActions>
//             </Dialog>
//
//             <ConfirmDialog
//                 open={confirm.open}
//                 onClose={closeConfirm}
//                 onConfirm={runConfirm}
//                 busy={confirmBusy}
//                 title={confirm.open ? confirm.title : ""}
//                 description={confirm.open ? confirm.description : undefined}
//                 confirmText={confirm.open ? confirm.confirmLabel ?? "Onayla" : "Onayla"}
//                 cancelText="Vazgeç"
//             />
//         </>
//     );
// };