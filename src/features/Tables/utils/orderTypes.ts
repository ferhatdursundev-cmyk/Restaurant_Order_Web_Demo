export type OrderItem = {
    cartId?: string;
    productId?: string;
    title?: string;
    qty?: number;
    unitPrice?: number;
    image?: string;
    note?: string;
};

export type OrderEntity = {
    createdAtMs?: number;
    status?: string;
    source?: string;
    total?: number;
    items?: Record<string, OrderItem> | OrderItem[];
};

export type OrdersMap = Record<string, OrderEntity>;
export type SelectedTable = { id: string; name: string } | null;

export type SelectionKey =
    | { kind: "order"; orderId: string }
    | { kind: "item"; orderId: string; cartId: string };

export type ConfirmState =
    | { open: false }
    | {
    open: true;
    title: string;
    description?: string;
    confirmLabel?: string;
    action: () => Promise<void> | void;
};