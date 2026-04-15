import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type OrderSettingsState = {
    isOrder: boolean;
};

const initialState: OrderSettingsState = {
    isOrder: false,
};

const orderSettingsSlice = createSlice({
    name: "orderSettings",
    initialState,
    reducers: {
        setIsOrder(state, action: PayloadAction<boolean>) {
            state.isOrder = action.payload;
        },
    },
});

export const { setIsOrder } = orderSettingsSlice.actions;
export default orderSettingsSlice.reducer;