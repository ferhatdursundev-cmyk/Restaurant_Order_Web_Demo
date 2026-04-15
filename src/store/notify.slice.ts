import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type NotifySeverity = "success" | "info" | "warning" | "error";

export type NotifyState = {
    open: boolean;
    message: string;
    severity: NotifySeverity;
    autoHideMs: number;
    key: number;
};

const initialState: NotifyState = {
    open: false,
    message: "",
    severity: "info",
    autoHideMs: 6000, // 3 saniye
    key: 0,
};

type ShowPayload = {
    message: string;
    severity?: NotifySeverity;
    autoHideMs?: number;
};

const notifySlice = createSlice({
    name: "notify",
    initialState,
    reducers: {
        show: (state, action: PayloadAction<ShowPayload>) => {
            state.open = true;
            state.message = action.payload.message;
            state.severity = action.payload.severity ?? "info";
            state.autoHideMs = action.payload.autoHideMs ?? 6000; // 3 saniye
            state.key += 1;
        },
        close: (state) => {
            state.open = false;
        },
    },
});

export const { show, close } = notifySlice.actions;
export default notifySlice.reducer;