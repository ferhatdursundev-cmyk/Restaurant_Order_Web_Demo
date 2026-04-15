import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "../store";
import { clearCart } from "../store";
import { useTableSession } from "../hooks";
import { ConfirmDialog } from "./ConfirmDialog";
import { ref, remove } from "firebase/database";
import { db } from "../firebase/firebase";

export function GlobalTableSessionGuard() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { isExpired, tableId, token } = useTableSession();
    const alreadyHandledRef = useRef(false);
    const dialogOpenRef = useRef(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const tableIdRef = useRef<string | null>(null);
    const tokenRef = useRef<string | null>(null);

    useEffect(() => {
        if (!tableId || !isExpired) {
            if (!isExpired) alreadyHandledRef.current = false;
            return;
        }

        if (alreadyHandledRef.current) return;
        alreadyHandledRef.current = true;

        tableIdRef.current = tableId;
        tokenRef.current = token;

        // Flag set et
        sessionStorage.setItem("tableSessionExpired", "1");

        // Redux sepeti temizle
        dispatch(clearCart());

        // Firebase'den sil
        if (tableId && token) {
            void remove(ref(db, `liveCartByTable/${tableId}/${token}`));
        }

        // sessionStorage ve localStorage temizle
        sessionStorage.removeItem(`tableToken:${tableId}`);
        sessionStorage.removeItem(`tableTokenExp:${tableId}`);
        localStorage.removeItem("activeTableId");

        if (!dialogOpenRef.current) {
            dialogOpenRef.current = true;
            setTimeout(() => setDialogOpen(true), 0);
        }
    }, [isExpired, tableId, token, dispatch]);

    const handleConfirm = () => {
        dialogOpenRef.current = false;
        setDialogOpen(false);
        alreadyHandledRef.current = false;
        navigate("/");
    };

    return (
        <ConfirmDialog
            open={dialogOpen}
            title="Süreniz Doldu"
            description="Sipariş verme süreniz bitti. Lütfen bu sayfayi kapatin ve QR kodu yeniden okutun."
            confirmText="Tamam"
            cancelText=""
            onConfirm={handleConfirm}
            onClose={handleConfirm}
        />
    );
}