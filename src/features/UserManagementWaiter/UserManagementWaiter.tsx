import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    IconButton,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyIcon from "@mui/icons-material/Key";
import PersonAddAltIcon from "@mui/icons-material/PersonAddAlt";

import { getAuth } from "firebase/auth";
import { getDatabase, onValue, ref, remove } from "firebase/database";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Dropdown } from "../../component/Dropdown.tsx";
import { adminDeleteUserCallable } from "../../firebase/functions";
import { ConfirmDialog } from "../../component/ConfirmDialog.tsx";
import {show as showNotify, useAppDispatch} from "../../store";

type UserType = "admin" | "garson" | "kurye" | "restaurant" | "dispatch" | string;
const userTypeItems = [
    { value: "garson" as const, label: "Garson" },
    { value: "admin" as const, label: "Admin" },
];
type UserRow = {
    uid: string;
    name: string;
    email: string;
    userType: UserType;
    isAdmin: boolean;
    createdAt?: string;
};

type CreateUserForm = {
    name: string;
    email: string;
    password: string;
    userType: UserType;
    isAdmin: boolean;
};

type PasswordForm = {
    uid: string;
    newPassword: string;
};

type AdminCreateUserResult = { uid: string };
type OkResult = { ok: true };

export const UserManagementWaiter = () => {
    const auth = getAuth();
    const db = getDatabase();
    const dispatch = useAppDispatch();
    const functions = getFunctions(undefined, "europe-west1");
    const myUid = auth.currentUser?.uid ?? null;
    const [myIsAdmin, setMyIsAdmin] = useState(false);
    const [users, setUsers] = useState<UserRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // dialogs
    const [openCreate, setOpenCreate] = useState(false);
    const [openPass, setOpenPass] = useState(false);
    const [createForm, setCreateForm] = useState<CreateUserForm>({
        name: "",
        email: "",
        password: "",
        userType: "garson",
        isAdmin: false,
    });
    const [passForm, setPassForm] = useState<PasswordForm>({ uid: "", newPassword: "" });

    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [deleteUid, setDeleteUid] = useState<string>("");

    // callable functions (Cloud Functions gerekiyor)
    const adminCreateUser = useMemo(
        () => httpsCallable<CreateUserForm, AdminCreateUserResult>(functions, "adminCreateUser"),
        [functions]
    );
    const adminSetPassword = useMemo(
        () => httpsCallable<PasswordForm, OkResult>(functions, "adminSetPassword"),
        [functions]
    );

    // Load my isAdmin from RTDB
    useEffect(() => {
        if (!myUid) return;
        const myRef = ref(db, `users/${myUid}/isAdmin`);
        return onValue(myRef, (snap) => {
            setMyIsAdmin(Boolean(snap.val()));
        });
    }, [db, myUid]);

    // Load all users
    useEffect(() => {
        const usersRef = ref(db, "users");

        return onValue(usersRef, (snap) => {
            const val = snap.val() as Record<string, Omit<UserRow, "uid">> | null;

            if (!val) {
                setUsers([]);
                return;
            }
            const arr: UserRow[] = Object.entries(val).map(([uid, u]) => ({
                uid,
                name: String(u.name ?? ""),
                email: String(u.email ?? ""),
                userType: String(u.userType ?? ""),
                isAdmin: Boolean(u.isAdmin),
                createdAt: typeof u.createdAt === "string" ? u.createdAt : undefined,
            }));
            setUsers(arr);
        });
    }, [db]);

    const resetError = () => setError(null);

    const handleCreate = async () => {
        resetError();
        if (!myIsAdmin) return;

        const name = createForm.name.trim();
        const email = createForm.email.trim();
        const password = createForm.password.trim();

        if (!name || !email || !password || !createForm.userType) {
            setError("Lütfen isim, e-mail, şifre ve userType gir.");
            return;
        }

        setBusy(true);
        try {
            await adminCreateUser({
                name,
                email,
                password,
                userType: createForm.userType,
                isAdmin: createForm.userType === "admin",
            });
            setOpenCreate(false);
            dispatch(showNotify({ message: `${name} ${createForm.userType} oluşturuldu.`, severity: "success" }));
            setCreateForm({ name: "", email: "", password: "", userType: "garson", isAdmin: false });

        } catch {
            dispatch(showNotify({ message: `${name} ${createForm.userType} oluşturulamadı.`, severity: "error" }));
            setError("Kullanıcı oluşturulamadı (Cloud Function gerekli / yetki yok olabilir).");
        } finally {
            setBusy(false);
        }
    };

    const handleChangePassword = async () => {
        resetError();
        if (!myIsAdmin) return;

        const newPassword = passForm.newPassword.trim();
        if (!passForm.uid || !newPassword) {
            setError("Yeni şifre gir.");
            return;
        }

        setBusy(true);
        try {
            await adminSetPassword({ uid: passForm.uid, newPassword });
            setOpenPass(false);
            dispatch(showNotify({ message: `Şifre değiştirildi.`, severity: "success" }));
            setPassForm({ uid: "", newPassword: "" });
        } catch {
            dispatch(showNotify({ message: `Şifre değiştirilemedi.`, severity: "error" }));
            setError("Şifre değiştirilemedi (Cloud Function gerekli / yetki yok olabilir).");
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (uid: string) => {
        resetError();
        if (!myIsAdmin) return;

        setBusy(true);
        try {
            await adminDeleteUserCallable({ uid }); // callable
            await remove(ref(db, `users/${uid}`)); // RTDB temizliği
            dispatch(showNotify({ message: `Kullanıcı silindi.`, severity: "success" }));

        } catch {
            dispatch(showNotify({ message: `Kullanıcı silinemedi.`, severity: "success" }));
            setError("Silinemedi (Cloud Function / yetki).");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 900, mx: "auto", p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography sx={{ fontWeight: 900, fontSize: 18 }}>Personel Listesi</Typography>

                {myIsAdmin && (
                    <Button
                        startIcon={<PersonAddAltIcon />}
                        variant="contained"
                        onClick={() => setOpenCreate(true)}
                        disabled={busy}
                        sx={{ bgcolor: "#FF7A00", "&:hover": { bgcolor: "#e96d00" }, fontWeight: 900 }}
                    >
                        Yeni Kullanıcı
                    </Button>
                )}
            </Stack>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <Stack spacing={1.25}>
                {users.map((u) => (
                    <Card key={u.uid} sx={{ borderRadius: 3 }}>
                        <CardContent
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 1.5,
                            }}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 900, lineHeight: 1.15 }} noWrap>
                                    {u.name} • {u.userType.toUpperCase()}
                                </Typography>
                                <Typography sx={{ fontSize: 13, color: "text.secondary" }} noWrap>
                                    {u.email}
                                </Typography>
                            </Box>

                            {myIsAdmin && (
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                    <IconButton
                                        onClick={() => {
                                            setPassForm({ uid: u.uid, newPassword: "" });
                                            setOpenPass(true);
                                        }}
                                        disabled={busy}
                                        title="Şifre değiştir"
                                        sx={{ color: "primary.main" }}
                                    >
                                        <KeyIcon />
                                    </IconButton>

                                    <IconButton
                                        onClick={() => {
                                            setDeleteUid(u.uid);
                                            setConfirmDeleteOpen(true);
                                        }}
                                        disabled={busy}
                                        title="Sil"
                                        color="error"
                                    >
                                        <DeleteOutlineIcon />
                                    </IconButton>
                                </Stack>
                            )}
                        </CardContent>
                    </Card>
                ))}

                {users.length === 0 && (
                    <Typography sx={{ color: "text.secondary" }}>Kullanıcı bulunamadı.</Typography>
                )}
            </Stack>

            {/* Delete confirm */}
            <ConfirmDialog
                open={confirmDeleteOpen}
                title={`Bu kullanıcıyı silmek istiyor musunuz?`}
                confirmText="Evet, sil"
                cancelText="Vazgeç"
                busy={busy}
                onClose={() => {
                    setConfirmDeleteOpen(false);
                    setDeleteUid("");
                }}
                onConfirm={async () => {
                    const uid = deleteUid;
                    if (!uid) return;
                    await handleDelete(uid);
                    setConfirmDeleteOpen(false);
                    setDeleteUid("");
                }}
            />

            {/* Create user dialog -> ConfirmDialog */}
            <ConfirmDialog
                open={openCreate}
                title="Yeni Kullanıcı Oluştur"
                confirmText="Oluştur"
                cancelText="İptal"
                busy={busy}
                onClose={() => setOpenCreate(false)}
                onConfirm={handleCreate}
            >
                <Box sx={{ display: "grid", gap: 1.25, pt: 1 }}>
                    <TextField
                        label="İsim"
                        value={createForm.name}
                        onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                        fullWidth
                    />
                    <TextField
                        label="E-Mail"
                        value={createForm.email}
                        onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                        fullWidth
                    />
                    <TextField
                        label="Şifre"
                        type="password"
                        value={createForm.password}
                        onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                        fullWidth
                    />

                    <Dropdown<UserType>
                        label="Kullanici Yetkisi"
                        value={createForm.userType as UserType}
                        onChange={(val) => setCreateForm((p) => ({ ...p, userType: val }))}
                        items={userTypeItems}
                    />
                </Box>
            </ConfirmDialog>

            {/* Change password dialog -> ConfirmDialog */}
            <ConfirmDialog
                open={openPass}
                title="Şifre Değiştir"
                confirmText="Kaydet"
                cancelText="İptal"
                busy={busy}
                onClose={() => setOpenPass(false)}
                onConfirm={handleChangePassword}
            >
                <Box sx={{ display: "grid", gap: 1.25, pt: 1 }}>
                    <TextField
                        label="Yeni şifre"
                        type="password"
                        value={passForm.newPassword}
                        onChange={(e) => setPassForm((p) => ({ ...p, newPassword: e.target.value }))}
                        fullWidth
                    />
                </Box>
            </ConfirmDialog>
        </Box>
    );
};