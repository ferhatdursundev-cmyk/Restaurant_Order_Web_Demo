import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    Box,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu as MuiMenu,
    MenuItem,
    Tooltip,
    Typography,
} from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import TableRestaurantIcon from "@mui/icons-material/TableRestaurant";
import LogoutIcon from "@mui/icons-material/Logout";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { getAuth, onAuthStateChanged, signOut, type User } from "firebase/auth";
import PeopleIcon from "@mui/icons-material/People";
import { useAuth } from "../../auth/aut.context.tsx";
import { asBool, extractTokenFromQuery } from "../../utils";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { LanguageSwitcher, useLanguage } from "../../i18n";
import {CallWaiterDialog, TableOrdersDrawer} from "../../component";
import {useProximityCheck} from "../../hooks";

type Props = {
    title: string;
    iconSize?: { xs: number; sm: number };
};

export const Header = ({ title }: Props) => {
    const navigate  = useNavigate();
    const location  = useLocation();
    const { user }  = useAuth();
    const { t }     = useLanguage();
    const h         = t.header;

    const auth = useMemo(() => getAuth(), []);
    const { status: proximityStatus } = useProximityCheck();
    const isProximityOk =  proximityStatus === "allowed";

    const [userData, setUserData]           = useState<User | null>(auth.currentUser);
    const [anchorEl, setAnchorEl]           = useState<null | HTMLElement>(null);
    const [guestAnchorEl, setGuestAnchorEl] = useState<null | HTMLElement>(null);
    const [ordersDrawerOpen, setOrdersDrawerOpen] = useState(false);

    // Butonu göster: QR ile gelen müşteri (tableId var) veya admin/garson
    const activeTableId = localStorage.getItem("activeTableId");
    const showOrdersButton = !!activeTableId || !!userData;
    const menuOpen      = Boolean(anchorEl);
    const guestMenuOpen = Boolean(guestAnchorEl);

    const isMenuPage = useMemo(() => location.pathname === "/", [location.pathname]);

    const canSeeToGo = useMemo(
        () =>
            !!userData &&
            (
                user?.isAdmin === true ||
                (user?.userType === "garson" && !asBool((user as any)?.isToGoAdmin))
            ),
        [userData, user]
    );

    useMemo(() => extractTokenFromQuery(location), [location]);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUserData(u));
        return () => unsub();
    }, [auth]);

    // ─── Menu handlers
    const handleOpenUserMenu  = useCallback((e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget), []);
    const handleCloseUserMenu = useCallback(() => setAnchorEl(null), []);

    const handleOpenGuestMenu  = useCallback((e: React.MouseEvent<HTMLElement>) => setGuestAnchorEl(e.currentTarget), []);
    const handleCloseGuestMenu = useCallback(() => setGuestAnchorEl(null), []);

    // ─── Navigation handlers
    const handleGoHome = useCallback(() => navigate("/"), [navigate]);

    const handleGoToLogin = useCallback(() => {
        setGuestAnchorEl(null);
        navigate("/login");
    }, [navigate]);

    const handleGoToTables = useCallback(() => {
        setAnchorEl(null);
        navigate("/tables");
    }, [navigate]);

    const handleGoToUserManagement = useCallback(() => {
        setAnchorEl(null);
        navigate("/usermanagement");
    }, [navigate]);

    const handleGoToReport = useCallback(() => {
        setAnchorEl(null);
        navigate("/report");
    }, [navigate]);

    const handleGoToReservations = useCallback(() => {
        setAnchorEl(null);
        navigate("/admin/rezervasyonlar");
    }, [navigate]);

    const handleGoToReservationPage = useCallback(() => {
        setGuestAnchorEl(null);
        navigate("/rezervasyon");
    }, [navigate]);

    const handleLogout = useCallback(async () => {
        setAnchorEl(null);
        await signOut(auth);
        navigate("/");
    }, [auth, navigate]);

    const handleCloseDrawer = useCallback(() => setOrdersDrawerOpen(false), []);

    return (
        <>
            <Box
                sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: 20,
                    bgcolor: "background.default",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    backdropFilter: "blur(10px)",
                }}
            >
                <Box
                    sx={{
                        maxWidth: 1200,
                        mx: "auto",
                        px: { xs: 2, md: 3 },
                        py: 0.35,
                        display: "grid",
                        gap: 0.25,
                    }}
                >
                    <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>

                        {/* Sol: Geri butonu + Garson Cagirma */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            {!isMenuPage ? (
                                <Tooltip title={h.back}>
                                    <IconButton
                                        onClick={handleGoHome}
                                        sx={{
                                            width: { xs: 25, sm: 30 },
                                            height: { xs: 25, sm: 30 },
                                            borderRadius: 999,
                                            bgcolor: "action.hover",
                                            transition: "all 120ms ease",
                                            "&:hover": { bgcolor: "#FF7A00", color: "#fff" },
                                        }}
                                    >
                                        <ArrowBackIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                </Tooltip>
                            ) : (
                                <Box sx={{ width: { xs: 25, sm: 30 }, height: { xs: 25, sm: 30 } }} />
                            )}

                            {showOrdersButton &&  activeTableId &&  (
                                <>
                                    <Tooltip title={h.sentOrders ?? "Kasaya Gönderilen Siparişler"}>
                                        <IconButton
                                            onClick={() => setOrdersDrawerOpen(true)}
                                            sx={{
                                                width: { xs: 25, sm: 30 },
                                                height: { xs: 25, sm: 30 },
                                                borderRadius: 999,
                                                transition: "all 120ms ease",
                                                color:"#FF7A00",
                                                bgcolor:"#fff",
                                                "&:hover": { bgcolor: "#FF7A00", color: "#fff" },
                                            }}
                                        >
                                            <ReceiptLongIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                    </Tooltip>
                                    { isProximityOk &&   <CallWaiterDialog tableId={activeTableId ?? ""} tableName={`Masa ${activeTableId}`} /> }
                                </>
                            )}
                        </Box>

                        {/* Orta: Baslik */}
                        <Typography
                            sx={{
                                position: "absolute",
                                left: "50%",
                                transform: "translateX(-50%)",
                                fontWeight: 900,
                                fontSize: 15,
                                letterSpacing: 0.3,
                                color: "#FF7A00",
                                whiteSpace: "nowrap",
                                pointerEvents: "none",
                                lineHeight: 1,
                            }}
                        >
                            {title}
                        </Typography>

                        {/* Sag: Dil + Hesap menusu */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <LanguageSwitcher size="compact" />

                            {!userData ? (
                                <>
                                    <Tooltip title={h.account}>
                                        <IconButton
                                            onClick={handleOpenGuestMenu}
                                            sx={{
                                                width: { xs: 30, sm: 34 },
                                                height: { xs: 30, sm: 34 },
                                                borderRadius: 999,
                                                bgcolor: "action.hover",
                                                transition: "all 120ms ease",
                                                "&:hover": { bgcolor: "#FF7A00", color: "#fff" },
                                            }}
                                        >
                                            <MoreVertIcon sx={{ fontSize: 18 }} />
                                        </IconButton>
                                    </Tooltip>

                                    <MuiMenu
                                        anchorEl={guestAnchorEl}
                                        open={guestMenuOpen}
                                        onClose={handleCloseGuestMenu}
                                        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                                        transformOrigin={{ vertical: "top", horizontal: "right" }}
                                    >
                                        <MenuItem onClick={handleGoToLogin}>
                                            <ListItemIcon><LoginIcon fontSize="small" /></ListItemIcon>
                                            <ListItemText primary={h.login} />
                                        </MenuItem>
                                        <MenuItem onClick={handleGoToReservationPage}>
                                            <ListItemIcon><CalendarMonthIcon fontSize="small" /></ListItemIcon>
                                            <ListItemText primary="Rezervasyon Yap" />
                                        </MenuItem>
                                    </MuiMenu>
                                </>
                            ) : (
                                <>
                                    <Tooltip title={h.account}>
                                        <IconButton
                                            onClick={handleOpenUserMenu}
                                            sx={{
                                                width: { xs: 30, sm: 34 },
                                                height: { xs: 30, sm: 34 },
                                                borderRadius: 999,
                                                bgcolor: "action.hover",
                                                transition: "all 120ms ease",
                                                "&:hover": { bgcolor: "#FF7A00", color: "#fff" },
                                            }}
                                        >
                                            <AccountCircleIcon sx={{ fontSize: 20 }} />
                                        </IconButton>
                                    </Tooltip>

                                    <MuiMenu
                                        anchorEl={anchorEl}
                                        open={menuOpen}
                                        onClose={handleCloseUserMenu}
                                        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                                        transformOrigin={{ vertical: "top", horizontal: "right" }}
                                    >
                                        {canSeeToGo && (
                                            <MenuItem onClick={handleGoToTables}>
                                                <ListItemIcon><TableRestaurantIcon fontSize="small" /></ListItemIcon>
                                                <ListItemText primary={h.tables} />
                                            </MenuItem>
                                        )}

                                        {user?.userType === "admin" && (
                                            <MenuItem onClick={handleGoToUserManagement}>
                                                <ListItemIcon><PeopleIcon fontSize="small" /></ListItemIcon>
                                                <ListItemText primary={h.staff} />
                                            </MenuItem>
                                        )}

                                        {user?.userType === "admin" && (
                                            <MenuItem onClick={handleGoToReport}>
                                                <ListItemIcon><AssessmentIcon fontSize="small" /></ListItemIcon>
                                                <ListItemText primary={h.report} />
                                            </MenuItem>
                                        )}

                                        {user?.userType === "admin" && (
                                            <MenuItem onClick={handleGoToReservations}>
                                                <ListItemIcon><CalendarMonthIcon fontSize="small" /></ListItemIcon>
                                                <ListItemText primary="Rezervasyonlar" />
                                            </MenuItem>
                                        )}

                                        <MenuItem onClick={handleLogout}>
                                            <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                                            <ListItemText primary={h.logout} />
                                        </MenuItem>
                                    </MuiMenu>
                                </>
                            )}
                        </Box>
                    </Box>
                </Box>
            </Box>

            <TableOrdersDrawer open={ordersDrawerOpen} onClose={handleCloseDrawer} />
        </>
    );
};
