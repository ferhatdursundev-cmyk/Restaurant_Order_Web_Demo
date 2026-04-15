import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import { AuthProvider } from "./auth/aut.context";
import { Provider } from "react-redux";
import { store } from "./store";
import {LanguageProvider} from "./i18n";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <Provider store={store}>
            <AuthProvider>
                <LanguageProvider>
                    <App />
                </LanguageProvider>
            </AuthProvider>
        </Provider>
    </React.StrictMode>
);