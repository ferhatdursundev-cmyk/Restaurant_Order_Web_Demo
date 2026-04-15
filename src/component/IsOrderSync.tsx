import { useEffect } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "../firebase/firebase";
import { useAppDispatch, setIsOrder } from "../store";

export const IsOrderSync = () => {
    const dispatch = useAppDispatch();

    useEffect(() => {
        const isOrderRef = ref(db, "isOrder");

        const unsubscribe = onValue(
            isOrderRef,
            (snapshot) => {
                const value = snapshot.exists() ? Boolean(snapshot.val()) : false;
                dispatch(setIsOrder(value));
            },
            () => {
                dispatch(setIsOrder(false));
            }
        );

        return () => unsubscribe();
    }, [dispatch]);

    return null;
};