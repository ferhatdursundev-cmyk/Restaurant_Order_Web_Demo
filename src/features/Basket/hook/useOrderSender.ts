import { useCallback, useRef } from "react";
import {db} from "../../../firebase/firebase.ts";
import {
    ref,
    push,
    set,
    serverTimestamp,
    runTransaction,
    remove,
    update,
} from "firebase/database";
import { getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {useAppDispatch, show as showNotify, clearCart, clearTableLiveItems} from "../../../store";
import {useAuth} from "../../../auth/aut.context.tsx";
import { useLanguage } from "../../../i18n";

type ItemOptions = Record<string, Record<number, boolean>>;

interface MergedItem {
    cartId: string;
    productId: string;
    title: string;
    unitPrice: number;
    qty?: number;
    note?: string;
    image?: string;
    optionsCatalog?: unknown;
}

interface UseOrderSenderParams {
    mergedItems: MergedItem[];
    total: number;
    itemOptions: ItemOptions;
    tableIdToUse: string | null | undefined;
    selectedTableId: string;
    tables: { id: string; name?: string }[];
    isToGoAdmin: boolean;
    isLocalOnlyTable: boolean;
    canChooseTable: boolean;
    isValidEmail: boolean;
    isValidFirstName: boolean;
    isValidLastName: boolean;
    isValidPhone: boolean;
    customerEmail: string;
    customerFirstName: string;
    customerLastName: string;
    customerPhone: string;
    paymentMethod: "cash" | "card";
    shouldRequireToken: boolean;
}

function storageKeyForTable(tableId: string) {
    return `tableToken:${tableId}`;
}

function dateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export function useOrderSender(params: UseOrderSenderParams) {
    const dispatch = useAppDispatch();
    const { user } = useAuth();
    const auth = getAuth();
    const navigate = useNavigate();
    const { t } = useLanguage();
    const b = t.basket;

    // Ref: en güncel params'ı closure'a hapsetmemek için
    const paramsRef = useRef(params);
    paramsRef.current = params;

    const sendOrder = useCallback(async () => {
        const p = paramsRef.current;

        if (p.isToGoAdmin && !p.isValidEmail) {
            dispatch(showNotify({ message: b.emailError, severity: "error" }));
            return;
        }

        if (p.isLocalOnlyTable && (!p.isValidFirstName || !p.isValidLastName || !p.isValidPhone)) {
            dispatch(showNotify({ message: b.requiredFieldsError, severity: "error" }));
            return;
        }

        if (p.canChooseTable && !p.tableIdToUse) {
            alert(b.noTableSelected);
            return;
        }

        if (!p.tableIdToUse) {
            dispatch(showNotify({ message: b.qrExpired, severity: "error" }));
            return;
        }

        if (p.mergedItems.length === 0) return;

        const tokenKey = storageKeyForTable(p.tableIdToUse);
        const token = sessionStorage.getItem(tokenKey);
        const expStr = sessionStorage.getItem(`tableTokenExp:${p.tableIdToUse}`);
        const exp = expStr ? Number(expStr) : null;

        if (p.shouldRequireToken && (!exp || Date.now() >= exp)) {
            dispatch(showNotify({ message: b.tokenExpired, severity: "error" }));
            return;
        }

        if (p.shouldRequireToken && !token) {
            dispatch(showNotify({ message: b.tokenMissing, severity: "error" }));
            return;
        }

        const path = `ordersByTable/${p.tableIdToUse}`;
        let nextNo: number | undefined;

        if (p.isToGoAdmin) {
            const day = dateKey();
            const counterRef = ref(db, `publicOrderNo/${day}/counter`);
            const counterRes = await runTransaction(counterRef, (cur) => {
                return typeof cur === "number" ? cur + 1 : 1;
            });

            if (!counterRes.committed) {
                dispatch(showNotify({ message: b.counterError, severity: "error" }));
                return;
            }
            nextNo = counterRes.snapshot.val() as number;
        }

        const author =
            (user as any)?.name ??
            auth.currentUser?.displayName ??
            (auth.currentUser?.email ? auth.currentUser.email.split("@")[0] : null) ??
            "Müşteri";

        const now = Date.now();

        const orderKey = p.isLocalOnlyTable
            ? (() => {
                const d = new Date(now);
                const hms =
                    String(d.getHours()).padStart(2, "0") +
                    String(d.getMinutes()).padStart(2, "0") +
                    String(d.getSeconds()).padStart(2, "0");
                const namePart = `${p.customerFirstName.trim()}${p.customerLastName.trim()}`
                    .toLowerCase()
                    .replace(/\s+/g, "")
                    .replace(/[^a-z0-9çğışöü]/gi, "");
                return `${namePart}_${hms}`;
            })()
            : null;

        const orderRef = orderKey
            ? ref(db, `${path}/${orderKey}`)
            : push(ref(db, path));

        const tableRow = p.tables.find((t) => t.id === p.tableIdToUse);
        const tableName = tableRow?.name || p.tableIdToUse;

        const payload: any = {
            author: author + " " + ((user as any)?.userType ?? ""),
            customerEmail: p.customerEmail.trim(),
            customerName: p.isLocalOnlyTable
                ? `${p.customerFirstName.trim()} ${p.customerLastName.trim()}`
                : null,
            customerPhone: p.isLocalOnlyTable ? p.customerPhone.trim() : null,
            paymentMethod: p.isLocalOnlyTable ? p.paymentMethod : null,
            status: p.isToGoAdmin ? "preparing" : "new",
            createdAt: serverTimestamp(),
            createdAtMs: now,
            source: p.isToGoAdmin ? "togo" : "basket",
            tableId: p.tableIdToUse,
            tableName,
            tableToken: p.shouldRequireToken ? token : null,
            printed: false,
            printStarted: false,
            items: p.mergedItems.map((i) => {
                const opts = p.itemOptions[i.cartId] ?? {};
                const allOptions: { id: number; label: string; price?: number | null }[] =
                    Array.isArray(i.optionsCatalog) ? i.optionsCatalog : [];
                const selectedOptions = allOptions
                    .filter((o) => !!opts[o.id])
                    .map((o) => o.label);
                return {
                    cartId: i.cartId,
                    productId: i.productId,
                    title: i.title,
                    unitPrice: i.unitPrice,
                    qty: i.qty ?? 1,
                    note: i.note ?? "",
                    image: i.image ?? "",
                    ...(selectedOptions.length > 0 && { selectedOptions }),
                };
            }),
            total: p.total,
        };

        if (typeof nextNo === "number") {
            payload.publicOrderNo = nextNo;
        }

        try {
            await set(orderRef, payload);

            if (!p.isToGoAdmin && !p.canChooseTable) {
                await remove(ref(db, `liveCartByTable/${p.tableIdToUse}`));
                await update(ref(db, `tableCartSignals/${p.tableIdToUse}`), {
                    lastSubmittedAt: Date.now(),
                    lastResetAt: Date.now(),
                });
            }

            dispatch(
                showNotify({
                    message: p.isToGoAdmin ? b.orderSentEmail : b.orderSent,
                    severity: "success",
                })
            );
        } catch (e) {
            console.error("sendOrder error:", e);
            dispatch(showNotify({ message: b.orderError, severity: "error" }));
            return;
        }

        dispatch(clearCart());
        dispatch(clearTableLiveItems());
        navigate("/");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, navigate, auth, user, b]);
    // ↑ paramsRef.current üzerinden okunduğu için params bağımlılıkları gerekmez

    return { sendOrder };
}