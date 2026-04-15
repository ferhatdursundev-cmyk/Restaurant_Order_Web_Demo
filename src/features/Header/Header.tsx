import { useEffect, useMemo, useState } from "react";
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
import { getAuth, onAuthStateChanged, signOut, type User } from "firebase/auth";
import PeopleIcon from "@mui/icons-material/People";
import { useAuth } from "../../auth/aut.context.tsx";
// import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { asBool, extractTokenFromQuery } from "../../utils";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { LanguageSwitcher, useLanguage } from "../../i18n";
import {TableOrdersDrawer} from "../../component";
//import {useProximityCheck} from "../../hooks";

type Props = {
    title: string;
    iconSize?: { xs: number; sm: number };
};

export const Header = ({ title }: Props) => {
    const navigate = useNavigate();
    const location = useLocation();
    const auth = getAuth();
    const { user } = useAuth();
    const { t } = useLanguage();
    const h = t.header;

   // const { status: proximityStatus } = useProximityCheck();
    // const isProximityOk =  proximityStatus === "allowed";
    //! Yorum satiri Garson cagirma butonu müsterinin konumu restorant ise görünsün icin gerekli. Butonu kullanmak istediginde bu yorumu satirini ac!
    const [userData, setUserData] = useState<User | null>(auth.currentUser);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const menuOpen = Boolean(anchorEl);

    const [guestAnchorEl, setGuestAnchorEl] = useState<null | HTMLElement>(null);
    const guestMenuOpen = Boolean(guestAnchorEl);

    const [ordersDrawerOpen, setOrdersDrawerOpen] = useState(false);

    const isMenuPage = location.pathname === "/";

    useMemo(() => extractTokenFromQuery(location), [location]);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUserData(u));
        return () => unsub();
    }, [auth]);

    const handleLogout = async () => {
        await signOut(auth);
        navigate("/");
    };

    const canSeeToGo =
        !!userData &&
        (
            user?.isAdmin === true ||
            (user?.userType === "garson" && !asBool((user as any)?.isToGoAdmin))
        );

    // Butonu göster: QR ile gelen müşteri (tableId var) veya admin/garson
    const activeTableId = localStorage.getItem("activeTableId");
    const showOrdersButton = !!activeTableId || !!userData;

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
                    <Box
                        sx={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        {/* Sol taraf: Geri + Kasaya Gönderilen Siparişler */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            {!isMenuPage ? (
                                <Tooltip title={h.back}>
                                    <IconButton
                                        onClick={() => navigate("/")}
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

                                    { /*Buraada tableId sadece activeTableId olmasi lazim. Hata vermesin diye bu sekilde yaptim. Hatanin asil düzeltilmesi
                                    //! showOrdersButton && activeTableId && kontrolü ile giderilir. Satir 131 de. */}
                                    {/*  isProximityOk &&   <CallWaiterDialog tableId={activeTableId ?? ""} tableName={`Masa ${activeTableId}`} />*/}
                                </>
                            )}
                        </Box>

                        {/* Ortalanmış başlık */}
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

                        {/* Sağ taraf: Dil + Hesap menüsü */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <LanguageSwitcher size="compact" />
                            {!userData ? (
                                <>
                                    <Tooltip title={h.account}>
                                        <IconButton
                                            onClick={(e) => setGuestAnchorEl(e.currentTarget)}
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
                                        onClose={() => setGuestAnchorEl(null)}
                                        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                                        transformOrigin={{ vertical: "top", horizontal: "right" }}
                                    >
                                        <MenuItem
                                            onClick={() => {
                                                setGuestAnchorEl(null);
                                                navigate("/login");
                                            }}
                                        >
                                            <ListItemIcon>
                                                <LoginIcon fontSize="small" />
                                            </ListItemIcon>
                                            <ListItemText primary={h.login} />
                                        </MenuItem>

                                        {/*
                                         <MenuItem
                                            onClick={() => {
                                                setGuestAnchorEl(null);
                                                navigate("/about");
                                            }}
                                        >
                                            <ListItemIcon>
                                                <InfoOutlinedIcon fontSize="small" />
                                            </ListItemIcon>
                                            <ListItemText primary={h.aboutUs} />
                                        </MenuItem>
                                        */}
                                    </MuiMenu>
                                </>
                            ) : (
                                <>
                                    <Tooltip title={h.account}>
                                        <IconButton
                                            onClick={(e) => setAnchorEl(e.currentTarget)}
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
                                        onClose={() => setAnchorEl(null)}
                                        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                                        transformOrigin={{ vertical: "top", horizontal: "right" }}
                                    >
                                        {user?.userType === "admin" && (
                                            <MenuItem
                                                onClick={() => {
                                                    setAnchorEl(null);
                                                    navigate("/togo");
                                                }}
                                            >
                                                <ListItemIcon>
                                                    <ShoppingBagIcon fontSize="small" />
                                                </ListItemIcon>
                                                <ListItemText primary={h.package} />
                                            </MenuItem>
                                        )}

                                        {canSeeToGo && (
                                            <MenuItem
                                                onClick={() => {
                                                    setAnchorEl(null);
                                                    navigate("/tables");
                                                }}
                                            >
                                                <ListItemIcon>
                                                    <TableRestaurantIcon fontSize="small" />
                                                </ListItemIcon>
                                                <ListItemText primary={h.tables} />
                                            </MenuItem>
                                        )}

                                        {user?.userType === "admin" && (
                                            <MenuItem
                                                onClick={() => {
                                                    setAnchorEl(null);
                                                    navigate("/usermanagement");
                                                }}
                                            >
                                                <ListItemIcon>
                                                    <PeopleIcon fontSize="small" />
                                                </ListItemIcon>
                                                <ListItemText primary={h.staff} />
                                            </MenuItem>
                                        )}

                                        {user?.userType === "admin" && (
                                            <MenuItem
                                                onClick={() => {
                                                    setAnchorEl(null);
                                                    navigate("/report");
                                                }}
                                            >
                                                <ListItemIcon>
                                                    <AssessmentIcon />
                                                </ListItemIcon>
                                                <ListItemText primary={h.report} />
                                            </MenuItem>
                                        )}

                                        <MenuItem
                                            onClick={() => {
                                                setAnchorEl(null);
                                                handleLogout();
                                            }}
                                        >
                                            <ListItemIcon>
                                                <LogoutIcon fontSize="small" />
                                            </ListItemIcon>
                                            <ListItemText primary={h.logout} />
                                        </MenuItem>
                                    </MuiMenu>
                                </>
                            )}
                        </Box>
                    </Box>
                </Box>
            </Box>

            {/* Kasaya gönderilen siparişler drawer */}
            <TableOrdersDrawer
                open={ordersDrawerOpen}
                onClose={() => setOrdersDrawerOpen(false)}
            />
        </>
    );
};