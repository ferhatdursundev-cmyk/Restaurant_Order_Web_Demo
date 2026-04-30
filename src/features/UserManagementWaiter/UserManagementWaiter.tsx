import React, { useEffect, useMemo, useState, useCallback } from "react";
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
import { show as showNotify, useAppDispatch } from "../../store";

// ─── Tipler ──────────────────────────────────────────────────────────────────
type UserType = "admin" | "garson" | "kurye" | "restaurant" | "dispatch" | string;

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

// ─── Sabitler (bileşen dışında) ───────────────────────────────────────────────
const userTypeItems = [
    { value: "garson" as const, label: "Garson" },
    { value: "admin" as const, label: "Admin" },
];

const INITIAL_CREATE_FORM: CreateUserForm = {
    name: "",
    email: "",
    password: "",
    userType: "garson",
    isAdmin: false,
};

const INITIAL_PASS_FORM: PasswordForm = { uid: "", newPassword: "" };

//UserManagementWaiter
export const UserManagementWaiter = () => {
    const dispatch = useAppDispatch();
    const auth = getAuth();
    const db   = getDatabase();
    // functions — stabil referans
    const functions = useMemo(() => getFunctions(undefined, "europe-west1"), []);

    const myUid = auth.currentUser?.uid ?? null;

    // State
    const [myIsAdmin, setMyIsAdmin]   = useState(false);
    const [users, setUsers]           = useState<UserRow[]>([]);
    const [error, setError]           = useState<string | null>(null);
    const [busy, setBusy]             = useState(false);

    // Dialog state
    const [openCreate, setOpenCreate]               = useState(false);
    const [openPass, setOpenPass]                   = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [deleteUid, setDeleteUid]                 = useState<string>("");
    const [createForm, setCreateForm]               = useState<CreateUserForm>(INITIAL_CREATE_FORM);
    const [passForm, setPassForm]                   = useState<PasswordForm>(INITIAL_PASS_FORM);

    // Callable functions
    const adminCreateUser = useMemo(
        () => httpsCallable<CreateUserForm, AdminCreateUserResult>(functions, "adminCreateUser"),
        [functions]
    );

    const adminSetPassword = useMemo(
        () => httpsCallable<PasswordForm, OkResult>(functions, "adminSetPassword"),
        [functions]
    );

    // Kendi isAdmin durumunu dinle
    useEffect(() => {
        if (!myUid) return;
        return onValue(ref(db, `users/${myUid}/isAdmin`), (snap) => {
            setMyIsAdmin(Boolean(snap.val()));
        });
    }, [myUid]);

    // Tüm kullanıcıları dinle
    useEffect(() => {
        return onValue(ref(db, "users"), (snap) => {
            const val = snap.val() as Record<string, Omit<UserRow, "uid">> | null;
            if (!val) { setUsers([]); return; }
            setUsers(
                Object.entries(val).map(([uid, u]) => ({
                    uid,
                    name:      String(u.name ?? ""),
                    email:     String(u.email ?? ""),
                    userType:  String(u.userType ?? ""),
                    isAdmin:   Boolean(u.isAdmin),
                    createdAt: typeof u.createdAt === "string" ? u.createdAt : undefined,
                }))
            );
        });
    }, []);

    // Helpers
    const resetError = useCallback(() => setError(null), []);

    // Create form handlers
    const handleCreateFormChange = useCallback(
        (field: keyof CreateUserForm) =>
            (e: React.ChangeEvent<HTMLInputElement>) =>
                setCreateForm((p) => ({ ...p, [field]: e.target.value })),
        []
    );

    const handleCreateUserTypeChange = useCallback(
        (val: UserType) => setCreateForm((p) => ({ ...p, userType: val })),
        []
    );

    // Password form handler
    const handlePassChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) =>
            setPassForm((p) => ({ ...p, newPassword: e.target.value })),
        []
    );

    // Dialog açma/kapama
    const handleOpenCreate = useCallback(() => setOpenCreate(true), []);
    const handleCloseCreate = useCallback(() => setOpenCreate(false), []);
    const handleClosePass = useCallback(() => setOpenPass(false), []);

    const handleOpenPass = useCallback((uid: string) => {
        setPassForm({ uid, newPassword: "" });
        setOpenPass(true);
    }, []);

    const handleOpenDelete = useCallback((uid: string) => {
        setDeleteUid(uid);
        setConfirmDeleteOpen(true);
    }, []);

    const handleCloseDelete = useCallback(() => {
        setConfirmDeleteOpen(false);
        setDeleteUid("");
    }, []);

    // CRUD işlemleri
    const handleCreate = useCallback(async () => {
        resetError();
        if (!myIsAdmin) return;

        const name     = createForm.name.trim();
        const email    = createForm.email.trim();
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
            setCreateForm(INITIAL_CREATE_FORM);
            dispatch(showNotify({ message: `${name} ${createForm.userType} oluşturuldu.`, severity: "success" }));
        } catch {
            dispatch(showNotify({ message: `${name} ${createForm.userType} oluşturulamadı.`, severity: "error" }));
            setError("Kullanıcı oluşturulamadı (Cloud Function gerekli / yetki yok olabilir).");
        } finally {
            setBusy(false);
        }
    }, [resetError, myIsAdmin, createForm, adminCreateUser, dispatch]);

    const handleChangePassword = useCallback(async () => {
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
            setPassForm(INITIAL_PASS_FORM);
            dispatch(showNotify({ message: "Şifre değiştirildi.", severity: "success" }));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("adminSetPassword error:", err);
            dispatch(showNotify({ message: "Şifre değiştirilemedi.", severity: "error" }));
            setError(`Şifre değiştirilemedi: ${msg}`);
        } finally {
            setBusy(false);
        }
    }, [resetError, myIsAdmin, passForm, adminSetPassword, dispatch]);

    const handleDelete = useCallback(async (uid: string) => {
        resetError();
        if (!myIsAdmin) return;

        setBusy(true);
        try {
            await adminDeleteUserCallable({ uid });
            await remove(ref(db, `users/${uid}`));
            dispatch(showNotify({ message: "Kullanıcı silindi.", severity: "success" }));
        } catch {
            dispatch(showNotify({ message: "Kullanıcı silinemedi.", severity: "error" }));
            setError("Silinemedi (Cloud Function / yetki).");
        } finally {
            setBusy(false);
        }
    }, [resetError, myIsAdmin, dispatch]);

    const handleConfirmDelete = useCallback(async () => {
        if (!deleteUid) return;
        await handleDelete(deleteUid);
        handleCloseDelete();
    }, [deleteUid, handleDelete, handleCloseDelete]);

    // Render
    return (
        <Box sx={{ maxWidth: 900, mx: "auto", p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography sx={{ fontWeight: 900, fontSize: 18 }}>Personel Listesi</Typography>

                {myIsAdmin && (
                    <Button
                        startIcon={<PersonAddAltIcon />}
                        variant="contained"
                        onClick={handleOpenCreate}
                        disabled={busy}
                        sx={{ bgcolor: "#FF7A00", "&:hover": { bgcolor: "#e96d00" }, fontWeight: 900 }}
                    >
                        Yeni Kullanıcı
                    </Button>
                )}
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Stack spacing={1.25}>
                {users.map((u) => (
                    <Card key={u.uid} sx={{ borderRadius: 3 }}>
                        <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
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
                                        onClick={() => handleOpenPass(u.uid)}
                                        disabled={busy}
                                        title="Şifre değiştir"
                                        sx={{ color: "primary.main" }}
                                    >
                                        <KeyIcon />
                                    </IconButton>
                                    <IconButton
                                        onClick={() => handleOpenDelete(u.uid)}
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
                title="Bu kullanıcıyı silmek istiyor musunuz?"
                confirmText="Evet, sil"
                cancelText="Vazgeç"
                busy={busy}
                onClose={handleCloseDelete}
                onConfirm={handleConfirmDelete}
            />

            {/* Create user dialog */}
            <ConfirmDialog
                open={openCreate}
                title="Yeni Kullanıcı Oluştur"
                confirmText="Oluştur"
                cancelText="İptal"
                busy={busy}
                onClose={handleCloseCreate}
                onConfirm={handleCreate}
            >
                <Box sx={{ display: "grid", gap: 1.25, pt: 1 }}>
                    <TextField
                        label="İsim"
                        value={createForm.name}
                        onChange={handleCreateFormChange("name")}
                        fullWidth
                    />
                    <TextField
                        label="E-Mail"
                        value={createForm.email}
                        onChange={handleCreateFormChange("email")}
                        fullWidth
                    />
                    <TextField
                        label="Şifre"
                        type="password"
                        value={createForm.password}
                        onChange={handleCreateFormChange("password")}
                        fullWidth
                    />
                    <Dropdown<UserType>
                        label="Kullanici Yetkisi"
                        value={createForm.userType as UserType}
                        onChange={handleCreateUserTypeChange}
                        items={userTypeItems}
                    />
                </Box>
            </ConfirmDialog>

            {/* Change password dialog */}
            <ConfirmDialog
                open={openPass}
                title="Şifre Değiştir"
                confirmText="Kaydet"
                cancelText="İptal"
                busy={busy}
                onClose={handleClosePass}
                onConfirm={handleChangePassword}
            >
                <Box sx={{ display: "grid", gap: 1.25, pt: 1 }}>
                    <TextField
                        label="Yeni şifre"
                        type="password"
                        value={passForm.newPassword}
                        onChange={handlePassChange}
                        fullWidth
                    />
                </Box>
            </ConfirmDialog>
        </Box>
    );
};