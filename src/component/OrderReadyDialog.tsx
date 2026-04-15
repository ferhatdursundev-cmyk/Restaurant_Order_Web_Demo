import { useEffect } from "react";
import {
    Dialog,
    DialogContent,
    Box,
    Typography,
    IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";

type Props = {
    open: boolean;
    orderLabel: string; // "001"
    onClose: () => void;
    durationMs?: number; // default 7000
};

export const OrderReadyDialog = ({ open, orderLabel, onClose, durationMs = 7000 }: Props) => {
    useEffect(() => {
        if (!open) return;
        const t = window.setTimeout(() => onClose(), durationMs);
        return () => window.clearTimeout(t);
    }, [open, durationMs, onClose]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    borderRadius: 4,
                    overflow: "hidden",
                    minWidth: { xs: "92vw", sm: 420 },
                    maxWidth: 520,
                    bgcolor: "background.paper",
                    boxShadow: "0 30px 90px rgba(0,0,0,0.28)",
                },
            }}
            BackdropProps={{
                sx: { backdropFilter: "blur(10px)" },
            }}
        >
            <DialogContent sx={{ p: 0 }}>
                <Box
                    sx={{
                        position: "relative",
                        px: 3,
                        py: 3,
                        background:
                            "linear-gradient(135deg, rgba(255,122,0,0.18) 0%, rgba(17,24,39,0.06) 55%, rgba(76,175,80,0.10) 100%)",
                    }}
                >
                    <IconButton
                        onClick={onClose}
                        sx={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            bgcolor: "rgba(0,0,0,0.06)",
                            "&:hover": { bgcolor: "rgba(0,0,0,0.10)" },
                        }}
                        aria-label="Kapat"
                    >
                        <CloseIcon />
                    </IconButton>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                            sx={{
                                width: 44,
                                height: 44,
                                borderRadius: 999,
                                display: "grid",
                                placeItems: "center",
                                bgcolor: "rgba(76,175,80,0.14)",
                                border: "1px solid rgba(76,175,80,0.35)",
                            }}
                        >
                            <CheckCircleRoundedIcon />
                        </Box>

                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 950, fontSize: 18, lineHeight: 1.1 }}>
                                Sipariş Hazır!
                            </Typography>
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            mt: 2.2,
                            p: 2,
                            borderRadius: 3,
                            bgcolor: "rgba(17,24,39,0.92)",
                            color: "white",
                            border: "1px solid rgba(255,255,255,0.10)",
                            boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
                        }}
                    >
                        <Box sx={{ display: "grid", placeItems: "center" }}>
                            <Typography sx={{ fontWeight: 950, fontSize: 26, letterSpacing: 1 }}>
                                {orderLabel}
                            </Typography>
                        </Box>

                        <Box
                            sx={{
                                mt: 1.8,
                                height: 6,
                                borderRadius: 999,
                                bgcolor: "rgba(255,255,255,0.12)",
                                overflow: "hidden",
                            }}
                        >
                            <Box
                                sx={{
                                    height: "100%",
                                    width: "100%",
                                    transformOrigin: "left",
                                    animation: `shrink ${durationMs}ms linear forwards`,
                                    bgcolor: "rgba(255,122,0,0.95)",
                                    "@keyframes shrink": {
                                        from: { transform: "scaleX(1)" },
                                        to: { transform: "scaleX(0)" },
                                    },
                                }}
                            />
                        </Box>
                    </Box>
                </Box>
            </DialogContent>
        </Dialog>
    );
}