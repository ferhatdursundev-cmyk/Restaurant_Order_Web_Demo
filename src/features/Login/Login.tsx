import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from "@mui/material";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { get, ref } from "firebase/database";
import { db } from "../../firebase/firebase";
import { show as showNotify, useAppDispatch } from "../../store";
import {capitalizeFirst} from "../../utils/capitalizeFirst";

type DbUser = {
    name?: string;
    userType?: string; // "admin" | "garson" | ...
    isAdmin?: boolean;
};

function fallbackNameFromEmail(email?: string | null) {
    if (!email) return "Kullanıcı";
    const at = email.indexOf("@");
    return at > 0 ? email.slice(0, at) : email;
}

export const Login = () => {
    const navigate = useNavigate();
    const auth = getAuth();
    const dispatch = useAppDispatch();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);

    const onLogin = async () => {
        setError(null);

        try {
            const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
            const fbUser = cred.user;

            // İsim: önce Firebase displayName, yoksa RTDB name, o da yoksa email'in @ öncesi
            let name = fbUser.displayName ?? fallbackNameFromEmail(fbUser.email);

            // Admin bilgisi: RTDB users/{uid} içinden
            let isAdmin = false;

            try {
                const snap = await get(ref(db, `users/${fbUser.uid}`));
                const dbUser = (snap.exists() ? (snap.val() as DbUser) : null);

                if (dbUser?.name) name = dbUser.name;
                isAdmin = dbUser?.userType === "admin" || dbUser?.isAdmin === true;
            } catch {
                // users kaydı okunamazsa sadece Firebase bilgisini kullan
            }
            name = capitalizeFirst(name);
            dispatch(
                showNotify({
                    message: `Hoşgeldin ${name}${isAdmin ? " Admin" : ""}`,
                    severity: "success",
                    autoHideMs: 3000,
                })
            );

            navigate("/");
        } catch {
            setError("Giriş başarısız");
        }
    };

    return (
        <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
            <Card sx={{ width: 380, borderRadius: 4 }}>
                <CardContent sx={{ display: "grid", gap: 1.25 }}>
                    <Typography sx={{ fontWeight: 900, textAlign: "center", fontSize: 18 }}>
                        Login
                    </Typography>

                    {error && <Alert severity="error">{error}</Alert>}

                    <TextField label="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <TextField label="Şifre" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

                    <Button
                        onClick={onLogin}
                        variant="contained"
                        sx={{ bgcolor: "#FF7A00", "&:hover": { bgcolor: "#e96d00" }, fontWeight: 900 }}
                    >
                        Giriş
                    </Button>
                </CardContent>
            </Card>
        </Box>
    );
};