import type {useLocation} from "react-router-dom";

export const extractTokenFromQuery = (location: ReturnType<typeof useLocation>) => {
    const sp = new URLSearchParams(location.search);
    return sp.get("token");
}