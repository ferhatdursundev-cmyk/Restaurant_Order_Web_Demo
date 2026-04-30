import type { SelectedTable } from "../utils";

export async function handlePrintAllOrders(opts: {
    ordersList: any[];
    table: SelectedTable;
    printAgentReady: boolean;
    printingAll: boolean;
    setPrintingAll: (v: boolean) => void;
}): Promise<void> {
    const { ordersList, table, printAgentReady, printingAll, setPrintingAll } = opts;

    if (printingAll || !printAgentReady || !table?.id || ordersList.length === 0) return;

    try {
        setPrintingAll(true);

        const allItems = ordersList.flatMap((o) =>
            (o.itemsArr || []).map((it: any) => {
                const qty = it.qty ?? 1;
                const unit = typeof it.unitPrice === "number" ? it.unitPrice : 0;
                return {
                    title: it.title ?? it.productId ?? "Ürün",
                    qty,
                    note: it.note ?? "",
                    lineTotal: unit * qty,
                    selectedSalat: Array.isArray(it.selectedSalat) ? it.selectedSalat : undefined,
                    selectedEkstra: Array.isArray(it.selectedEkstra) ? it.selectedEkstra : undefined,
                };
            })
        );

        const total = allItems.reduce((sum, x) => sum + (x.lineTotal || 0), 0);

        const res = await fetch("http://127.0.0.1:43125/print/receipt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                orderId: `${table.name}-TÜM`,
                tableName: table?.name || "Masa",
                customerName: null,
                customerPhone: null,
                paymentMethod: null,
                items: allItems,
                total,
            }),
        });

        const json = await res.json();
        if (!res.ok || !json.ok) {
            throw new Error(json.error || "Yazdırma başarısız");
        }
    } catch (err) {
        console.error("Print all error:", err);
    } finally {
        setPrintingAll(false);
    }
}