import type { ConfirmState, OrdersMap, SelectedTable } from "./orderTypes";
import { handlePaySelected } from "./handlePaySelected";

export const handlePayClick = (opts: {
    rightTotal: number;
    table: SelectedTable;
    selected: Record<string, true>;
    localOrders: OrdersMap | null;
    setLocalOrders: React.Dispatch<React.SetStateAction<OrdersMap | null>>;
    setSelected: React.Dispatch<React.SetStateAction<Record<string, true>>>;
    openConfirm: (next: Omit<Extract<ConfirmState, { open: true }>, "open">) => void;
}) => {
    const { rightTotal, table, selected, localOrders, setLocalOrders, setSelected, openConfirm } = opts;

    openConfirm({
        title: "Ödeme yapmak istediğinize emin misiniz?",
        description: `Seçilen toplam: ${rightTotal}TL`,
        confirmLabel: "Öde",
        action: async () => {
            try {
                await handlePaySelected({
                    table,
                    selected,
                    localOrders,
                    setLocalOrders,
                    setSelected,
                });
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                openConfirm({
                    title: "Ödeme hatası",
                    description: msg,
                    confirmLabel: "Tamam",
                    action: async () => {},
                });
                throw e;
            }
        },
    });
}