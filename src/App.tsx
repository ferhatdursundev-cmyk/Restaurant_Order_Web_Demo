import { BrowserRouter, Routes, Route } from "react-router-dom";
import {
    Login,
    Menu,
    Header,
    Tables,
    Basket,
    UserManagementWaiter,
    ReportsPage,
    AboutUs,
    ToGoPage,
} from "./features";
import { Box } from "@mui/material";
import {
    GlobalNotify, IsOrderSync, GlobalTableSubmissionSync, GlobalTableCartSync, GlobalTableResetSync,
    GlobalTableSessionGuard
} from "./component";
import { GlobalAutoPrint } from "./component/GlobalAutoPrint";
import {GlobalOrderAlarm, initActiveTableTTL} from "./utils";
import {ProtectedRoute} from "./app/ProtectedRoute";
import {Footer} from "./features";
import {useAuth} from "./auth/aut.context";
import {useEffect} from "react";

export default function App() {
    const { user } = useAuth();
    const isAdmin = (user as any)?.isAdmin === true;

    useEffect(() => {
        const timeout = initActiveTableTTL();
        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, []);

    return (
        <BrowserRouter>
            <IsOrderSync />
            <GlobalOrderAlarm />
            {isAdmin && <GlobalAutoPrint />}
            <GlobalTableCartSync />
            <GlobalTableSubmissionSync />
            <GlobalTableResetSync />
            <GlobalTableSessionGuard/>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    minHeight: "100vh",
                }}
            >
                <Box sx={{ position: "sticky", top: 0, zIndex: 1200, bgcolor: "background.default" }}>
                    <Header title="DEMO RESTORAN-KAFE-OTEL" />
                </Box>

                <GlobalNotify />

                <Box sx={{ flex: 1 }}>
                    <Routes>
                        <Route path="/" element={<Menu />} />
                        <Route path="/basket" element={<Basket />} />
                        <Route path="/about" element={<AboutUs />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/t/:tableId" element={<Menu />} />
                        <Route
                            path="/tables"
                            element={
                                <ProtectedRoute allowedRoles={["admin", "garson"]}>
                                    <Tables />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/togo"
                            element={
                                <ProtectedRoute allowedRoles={["admin"]}>
                                    <ToGoPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/usermanagement"
                            element={
                                <ProtectedRoute allowedRoles={["admin"]}>
                                    <UserManagementWaiter />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/report"
                            element={
                                <ProtectedRoute allowedRoles={["admin"]}>
                                    <ReportsPage />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </Box>
                <Footer />
            </Box>
        </BrowserRouter>
    );
}