import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/aut.context";
import React from "react";

type Props = {
    children: React.ReactNode;
    allowedRoles?: string[];
    requireAdmin?: boolean;
};

export const ProtectedRoute = ({ children, allowedRoles, requireAdmin }: Props) => {
    const { user } = useAuth();
    const location = useLocation();

    if (!user) return <Navigate to="/" replace state={{ from: location.pathname }} />;

    if (requireAdmin && !user.isAdmin) return <Navigate to="/" replace />;

    if (allowedRoles && !allowedRoles.includes(user.userType)) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};