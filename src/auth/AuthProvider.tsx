import React, {
    createContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import {getAuth} from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import {get, ref} from "firebase/database";
import {db} from "../firebase/firebase.ts";
import type {AppUser} from "./aut.context.tsx";

export type AuthContextType = {
    user: AppUser | null;
    loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
});

async function fetchUserMeta(uid: string): Promise<{ isAdmin: boolean; userType: string }> {
    const snap = await get(ref(db, `users/${uid}`));

    if (!snap.exists()) {
        return { isAdmin: false, userType: "customer" };
    }

    const val = snap.val();

    return {
        isAdmin: Boolean(val.isAdmin),
        userType: val.userType ?? "customer",
    };
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const auth = getAuth();

    const [user, setUser] = useState<AppUser | null>(() => {
        const raw = localStorage.getItem("appUser");
        return raw ? (JSON.parse(raw) as AppUser) : null;
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (fbUser) => {
            try {
                if (!fbUser) {
                    setUser(null);
                    localStorage.removeItem("appUser");
                    return;
                }

                const meta = await fetchUserMeta(fbUser.uid);

                const next: AppUser = {
                    uid: fbUser.uid,
                    email: fbUser.email,
                    isAdmin: meta.isAdmin,
                    userType: meta.userType,
                };

                setUser(next);
                localStorage.setItem("appUser", JSON.stringify(next));
            } finally {
                setLoading(false);
            }
        });

        return () => unsub();
    }, [auth]);

    const value = useMemo(() => ({ user, loading }), [user, loading]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
