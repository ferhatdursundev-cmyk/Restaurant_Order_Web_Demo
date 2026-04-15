import { useEffect, useState } from "react";
import { get, ref } from "firebase/database";
import { db } from "../firebase/firebase";

type LatLng = { lat: number; lng: number };

export function useRestaurantLocation() {
    const [location, setLocation] = useState<LatLng | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        get(ref(db, "restaurantConfig/location"))
            .then((snap) => {
                const val = snap.val();
                if (val?.lat && val?.lng) {
                    setLocation({ lat: val.lat, lng: val.lng });
                } else {
                    setError("Restoran konumu bulunamadı.");
                }
            })
            .catch(() => setError("Restoran konumu okunamadı."));
    }, []);

    return { location, error };
}