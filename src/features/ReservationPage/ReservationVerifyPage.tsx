import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
    Alert,
    Button,
    CircularProgress,
    Container,
    Paper,
    Stack,
    Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { useLanguage } from "../../i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

type VerifyState =
    | { status: "loading" }
    | { status: "success" }
    | { status: "error"; message: string };

// ─── Component ────────────────────────────────────────────────────────────────

export const ReservationVerifyPage: React.FC = () => {
    const { t }          = useLanguage();
    const r              = t.reservation;
    const [searchParams] = useSearchParams();
    const navigate       = useNavigate();

    const token = searchParams.get("token") ?? "";

    const [verifyState, setVerifyState] = useState<VerifyState>({ status: "loading" });

    // ── Verify on mount ────────────────────────────────────────────────────────

    useEffect(() => {
        const verify = async () => {
            if (!token) {
                setVerifyState({ status: "error", message: r.verifyExpired });
                return;
            }

            try {
                const res  = await fetch(
                    `https://europe-west1-restaurantorderwebdemo.cloudfunctions.net/verifyReservationEmail?token=${encodeURIComponent(token)}`
                );
                const data = await res.json() as { ok: boolean; error?: string };

                if (data.ok) {
                    setVerifyState({ status: "success" });
                } else {
                    setVerifyState({ status: "error", message: data.error || r.verifyExpired });
                }
            } catch {
                setVerifyState({ status: "error", message: r.submitError });
            }
        };

        verify();
    }, [token, r]);

    // ── Callbacks ──────────────────────────────────────────────────────────────

    const handleGoHome         = useCallback(() => navigate("/"), [navigate]);
    const handleNewReservation = useCallback(() => navigate("/rezervasyon"), [navigate]);

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <Container maxWidth="sm" sx={{ py: 8 }}>
            <Paper elevation={0} sx={{
                p: 5, borderRadius: 4, textAlign: "center",
                border: "1px solid", borderColor: "divider",
            }}>

                {/* Loading */}
                {verifyState.status === "loading" && (
                    <Stack spacing={3} alignItems="center">
                        <CircularProgress size={64} color="warning" />
                        <Typography variant="h5" fontWeight={700}>{r.verifying}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {r.verifyingDesc}
                        </Typography>
                    </Stack>
                )}

                {/* Success */}
                {verifyState.status === "success" && (
                    <Stack spacing={2} alignItems="center">
                        <CheckCircleOutlineIcon sx={{ fontSize: 72, color: "success.main" }} />
                        <Typography variant="h5" fontWeight={700}>{r.verified}</Typography>
                        <Typography variant="body1" color="text.secondary">
                            {r.verifiedDesc}
                        </Typography>
                        <Alert severity="info" sx={{ textAlign: "left", width: "100%" }}>
                            {r.verifiedInfo}
                        </Alert>
                        <Stack direction="row" spacing={2} pt={1}>
                            <Button variant="outlined" onClick={handleGoHome}>{r.home}</Button>
                            <Button
                                variant="contained"
                                startIcon={<CalendarMonthIcon />}
                                onClick={handleNewReservation}
                            >
                                {r.newReservation}
                            </Button>
                        </Stack>
                    </Stack>
                )}

                {/* Error */}
                {verifyState.status === "error" && (
                    <Stack spacing={2} alignItems="center">
                        <ErrorOutlineIcon sx={{ fontSize: 72, color: "error.main" }} />
                        <Typography variant="h5" fontWeight={700}>{r.verifyFailed}</Typography>
                        <Typography variant="body1" color="text.secondary">
                            {verifyState.message}
                        </Typography>
                        <Alert severity="warning" sx={{ textAlign: "left", width: "100%" }}>
                            {r.verifyExpired}
                        </Alert>
                        <Stack direction="row" spacing={2} pt={1}>
                            <Button variant="outlined" onClick={handleGoHome}>{r.home}</Button>
                            <Button variant="contained" onClick={handleNewReservation}>
                                {r.newReservation}
                            </Button>
                        </Stack>
                    </Stack>
                )}

            </Paper>
        </Container>
    );
};
