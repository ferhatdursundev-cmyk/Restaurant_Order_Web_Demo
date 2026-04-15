import { useEffect, useRef, useState } from "react";
import { useRestaurantLocation } from "./useRestaurantLocation";
import { haversineMetres } from "../utils";

const MAX_DISTANCE_METRES = 300;
const MAX_SAMPLES = 3; // kaç ölçüm alınsın
const MIN_ACCURACY_METRES = 300; // bu hassasiyete ulaşınca dur

type Status = "checking" | "allowed" | "denied" | "location_error" | "no_restaurant";

export function useProximityCheck() {
    const { location: restaurantLocation, error: restaurantError } = useRestaurantLocation();
    const [status, setStatus] = useState<Status>("checking");
    const [distance, setDistance] = useState<number | null>(null);
    const didRun = useRef(false);

    useEffect(() => {
        if (restaurantError) {
            const t = setTimeout(() => setStatus("no_restaurant"), 0);
            return () => clearTimeout(t);
        }

        if (!restaurantLocation) return;

        if (didRun.current) return;
        didRun.current = true;

        if (!navigator.geolocation) {
            const t = setTimeout(() => setStatus("location_error"), 0);
            return () => clearTimeout(t);
        }

        let sampleCount = 0;
        let bestAccuracy = Infinity;
        let bestDistance = Infinity;

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const accuracy = pos.coords.accuracy; // metre cinsinden GPS hassasiyeti
                const d = haversineMetres(
                    pos.coords.latitude,
                    pos.coords.longitude,
                    restaurantLocation.lat,
                    restaurantLocation.lng,
                );

                // daha iyi hassasiyete sahip ölçümü kaydet
                if (accuracy < bestAccuracy) {
                    bestAccuracy = accuracy;
                    bestDistance = d;
                }

                sampleCount++;

                // yeterince hassas veya max örnek sayısına ulaştıysa bitir
                if (accuracy <= MIN_ACCURACY_METRES || sampleCount >= MAX_SAMPLES) {
                    navigator.geolocation.clearWatch(watchId);
                    setDistance(Math.round(bestDistance));
                    setStatus(bestDistance <= MAX_DISTANCE_METRES ? "allowed" : "denied");
                }
            },
            () => {
                setStatus("location_error");
            },
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
        );

        return () => {
            navigator.geolocation.clearWatch(watchId);
        };
    }, [restaurantLocation, restaurantError]);

    return { status, distance };
}