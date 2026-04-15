import { configureStore } from "@reduxjs/toolkit";
import cartReducer from "./cart.slice";
import notifyReducer from "./notify.slice";
import orderSettingsReducer from "./orderSettings.slice";
import tableLiveCartReducer from "./tableLiveCartSlice";

export const store = configureStore({
    reducer: {
        cart: cartReducer,
        notify: notifyReducer,
        orderSettings: orderSettingsReducer,
        tableLiveCart: tableLiveCartReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;