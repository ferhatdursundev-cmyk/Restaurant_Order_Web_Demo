import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export type CartItem = {
    cartId: string;
    productId: string;
    title: string;
    unitPrice: number;
    qty: number;
    note: string;
    image: string;
};

type CartState = { items: CartItem[] };

const initialState: CartState = { items: [] };

function generateId() {
    return crypto.randomUUID();
}

const cartSlice = createSlice({
    name: "cart",
    initialState,
    reducers: {
        addItem(
            state,
            action: PayloadAction<{ productId: string; title: string; unitPrice: number, image: string }>
        ) {
            state.items.push({
                cartId: generateId(),
                productId: action.payload.productId,
                title: action.payload.title,
                unitPrice: action.payload.unitPrice,
                image: action.payload.image,
                qty: 1,
                note: "", // başlangıç boş
            });
        },

        updateNote(state, action: PayloadAction<{ cartId: string; note: string }>) {
            const row = state.items.find((i) => i.cartId === action.payload.cartId);
            if (row) row.note = action.payload.note;
        },

        removeItem(state, action: PayloadAction<string>) {
            state.items = state.items.filter((i) => i.cartId !== action.payload);
        },

        clearCart(state) {
            state.items = [];
        },
    },
});

export const { addItem, updateNote, removeItem, clearCart } = cartSlice.actions;
export default cartSlice.reducer;