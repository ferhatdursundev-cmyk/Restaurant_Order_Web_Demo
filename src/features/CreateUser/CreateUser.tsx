import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from "@mui/material";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getDatabase, ref, set } from "firebase/database";



export const CreateUser = () => {
    const navigate = useNavigate();
    const auth = getAuth();
    const db   = getDatabase();
    const [name, setName]         = useState("");
    const [email, setEmail]       = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState<string | null>(null);

    // Form validasyonu
    const isFormValid = useMemo(
        () => email.trim().length > 0 && password.length >= 6,
        [email, password]
    );

    // Field handlers
    const handleNameChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value),
        []
    );

    const handleEmailChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value),
        []
    );

    const handlePasswordChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value),
        []
    );

    // Navigasyon
    const handleGoToLogin = useCallback(() => navigate("/login"), [navigate]);

    // Kayıt işlemi
    const onCreate = useCallback(async () => {
        setError(null);
        setLoading(true);

        try {
            const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
            const uid  = cred.user.uid;

            if (name.trim()) {
                await updateProfile(cred.user, { displayName: name.trim() });
            }

            await set(ref(db, `users/${uid}`), {
                uid,
                name:      name.trim(),
                email:     email.trim(),
                isAdmin:   false,
                createdAt: new Date().toISOString(),
            });

            navigate("/");
        } catch {
            setError("Kullanıcı oluşturulamadı");
        } finally {
            setLoading(false);
        }
    }, [email, password, name, navigate]);

    // Render
    return (
        <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
            <Card sx={{ width: "min(420px, 100%)", borderRadius: 4 }}>
                <CardContent sx={{ display: "grid", gap: 1.25 }}>
                    <Typography sx={{ fontWeight: 900, textAlign: "center", fontSize: 18 }}>
                        Kullanıcı Oluştur
                    </Typography>

                    {error && <Alert severity="error">{error}</Alert>}

                    <TextField label="İsim"   value={name}     onChange={handleNameChange} />
                    <TextField label="E-Mail" value={email}    onChange={handleEmailChange} />
                    <TextField label="Şifre"  type="password"  value={password} onChange={handlePasswordChange} />

                    <Button
                        onClick={onCreate}
                        disabled={loading || !isFormValid}
                        variant="contained"
                        sx={{ bgcolor: "#FF7A00", "&:hover": { bgcolor: "#e96d00" }, fontWeight: 900 }}
                    >
                        {loading ? "Oluşturuluyor..." : "Oluştur"}
                    </Button>

                    <Button variant="text" onClick={handleGoToLogin}>
                        Zaten hesabın var mı? Giriş Yap
                    </Button>
                </CardContent>
            </Card>
        </Box>
    );
};