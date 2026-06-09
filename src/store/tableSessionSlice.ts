import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

type TableSessionState = {
    tableId: string | null;
};

const initialState: TableSessionState = {
    tableId: null,
};

const tableSessionSlice = createSlice({
    name: "tableSession",
    initialState,
    reducers: {
        setTableId(state, action: PayloadAction<string>) {
            state.tableId = action.payload;
        },
        clearTableId(state) {
            state.tableId = null;
        },
    },
});

export const { setTableId, clearTableId } = tableSessionSlice.actions;
export default tableSessionSlice.reducer;
