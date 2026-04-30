import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from "@mui/material";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { get, ref } from "firebase/database";
import { db } from "../../firebase/firebase";
import { show as showNotify, useAppDispatch } from "../../store";
import { capitalizeFirst } from "../../utils";

type DbUser = {
    name?: string;
    userType?: string;
    isAdmin?: boolean;
};

function fallbackNameFromEmail(email?: string | null) {
    if (!email) return "Kullanici";
    const at = email.indexOf("@");
    return at > 0 ? email.slice(0, at) : email;
}

export const Login = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const auth = useMemo(() => getAuth(), []);

    const [email, setEmail]       = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState<string | null>(null);

    const isFormValid = useMemo(
        () => email.trim().length > 0 && password.length > 0,
        [email, password]
    );

    const handleEmailChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value),
        []
    );

    const handlePasswordChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value),
        []
    );

    const onLogin = useCallback(async () => {
        setError(null);
        setLoading(true);

        try {
            const cred   = await signInWithEmailAndPassword(auth, email.trim(), password);
            const fbUser = cred.user;

            let name    = fbUser.displayName ?? fallbackNameFromEmail(fbUser.email);
            let isAdmin = false;

            try {
                const snap   = await get(ref(db, `users/${fbUser.uid}`));
                const dbUser = (snap.exists() ? (snap.val() as DbUser) : null);
                if (dbUser?.name) name = dbUser.name;
                isAdmin = dbUser?.userType === "admin" || dbUser?.isAdmin === true;
            } catch {
                // users kaydi okunamazsa Firebase bilgisini kullan
            }

            name = capitalizeFirst(name);
            dispatch(showNotify({
                message:     `Hosgeldin ${name}${isAdmin ? " Admin" : ""}`,
                severity:    "success",
                autoHideMs:  3000,
            }));

            navigate("/");
        } catch {
            setError("Giris basarisiz");
        } finally {
            setLoading(false);
        }
    }, [auth, email, password, dispatch, navigate]);

    return (
        <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
            <Card sx={{ width: 380, borderRadius: 4 }}>
                <CardContent sx={{ display: "grid", gap: 1.25 }}>
                    <Typography sx={{ fontWeight: 900, textAlign: "center", fontSize: 18 }}>
                        Login
                    </Typography>

                    {error && <Alert severity="error">{error}</Alert>}

                    <TextField
                        label="E-Mail"
                        value={email}
                        onChange={handleEmailChange}
                    />
                    <TextField
                        label="Sifre"
                        type="password"
                        value={password}
                        onChange={handlePasswordChange}
                    />

                    <Button
                        onClick={onLogin}
                        disabled={loading || !isFormValid}
                        variant="contained"
                        sx={{ bgcolor: "#FF7A00", "&:hover": { bgcolor: "#e96d00" }, fontWeight: 900 }}
                    >
                        {loading ? "Giris yapiliyor..." : "Giris"}
                    </Button>
                </CardContent>
            </Card>
        </Box>
    );
};