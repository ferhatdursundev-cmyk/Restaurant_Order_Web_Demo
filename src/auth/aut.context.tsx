/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { db } from "../firebase/firebase";

export type AppUser = {
    uid: string;
    email: string | null;
    isAdmin: boolean;
    userType: string;
    name?: string;
    isToGoAdmin?: boolean;
};

type AuthCtx = {
    user: AppUser | null;
    loading: boolean;
};

const AuthContext = createContext<AuthCtx>({ user: null, loading: true });

async function fetchUserMeta(uid: string): Promise<{ isAdmin: boolean; userType: string; isToGoAdmin: boolean; name?: string }> {
    const snap = await get(ref(db, `users/${uid}`));

    if (!snap.exists()) {
        return { isAdmin: false, userType: "customer", isToGoAdmin: false };
    }

    const val = snap.val() as any;

    return {
        isAdmin: val.isAdmin,
        userType: String(val.userType ?? "customer"),
        isToGoAdmin: val.isToGoAdmin,
        name: val.name ? String(val.name) : undefined,
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
                    isToGoAdmin: meta.isToGoAdmin,
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

export const useAuth = () => {
    return useContext(AuthContext);
};