import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, TextField, Typography } from "@mui/material";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getDatabase, ref, set } from "firebase/database";

export const CreateUser = () => {
    const navigate = useNavigate();
    const auth = getAuth();
    const db = getDatabase();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onCreate = async () => {
        setError(null);
        setLoading(true);

        try {
            // 1) Auth user create
            const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
            const uid = cred.user.uid;

            // 2) (opsiyonel) displayName
            if (name.trim()) {
                await updateProfile(cred.user, { displayName: name.trim() });
            }

            // 3) RTDB profile write (UID aynı)
            const payload = {
                uid,
                name: name.trim(),
                email: email.trim(),
                isAdmin: false,
                createdAt: new Date().toISOString(),
            };

            await set(ref(db, `users/${uid}`), payload);

            navigate("/");
        } catch {
            setError("Kullanıcı oluşturulamadı");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
            <Card sx={{ width: "min(420px, 100%)", borderRadius: 4 }}>
                <CardContent sx={{ display: "grid", gap: 1.25 }}>
                    <Typography sx={{ fontWeight: 900, textAlign: "center", fontSize: 18 }}>
                        Kullanıcı Oluştur
                    </Typography>

                    {error && <Alert severity="error">{error}</Alert>}

                    <TextField label="İsim" value={name} onChange={(e) => setName(e.target.value)} />
                    <TextField label="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <TextField label="Şifre" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

                    <Button
                        onClick={onCreate}
                        disabled={loading}
                        variant="contained"
                        sx={{ bgcolor: "#FF7A00", "&:hover": { bgcolor: "#e96d00" }, fontWeight: 900 }}
                    >
                        {loading ? "Oluşturuluyor..." : "Oluştur"}
                    </Button>

                    <Button variant="text" onClick={() => navigate("/login")}>
                        Zaten hesabın var mı? Giriş Yap
                    </Button>
                </CardContent>
            </Card>
        </Box>
    );
}
