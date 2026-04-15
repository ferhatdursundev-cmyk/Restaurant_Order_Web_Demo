import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type LiveCartItem = {
    cartId: string;
    productId: string;
    title: string;
    unitPrice: number;
    qty?: number;
    note?: string;
    image?: string;
};

type TableLiveCartState = {
    items: LiveCartItem[];
};

const initialState: TableLiveCartState = {
    items: [],
};

const tableLiveCartSlice = createSlice({
    name: "tableLiveCart",
    initialState,
    reducers: {
        setTableLiveItems(state, action: PayloadAction<LiveCartItem[]>) {
            state.items = action.payload;
        },
        clearTableLiveItems(state) {
            state.items = [];
        },
    },
});

export const { setTableLiveItems, clearTableLiveItems } = tableLiveCartSlice.actions;
export default tableLiveCartSlice.reducer;