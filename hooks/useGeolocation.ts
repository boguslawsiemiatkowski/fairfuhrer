import { useState, useCallback, useRef } from "react";

export function useGeolocation(
  onLocationFound?: (location: [number, number]) => void,
) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null,
  );
  const userLocationRequestedRef = useRef(false);

  const getUserLocation = useCallback(() => {
    userLocationRequestedRef.current = true;

    if (!navigator.geolocation) {
      console.warn("❌ Geolocation wird von diesem Browser nicht unterstützt");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation: [number, number] = [longitude, latitude];
        setUserLocation(newLocation);

        if (onLocationFound) {
          onLocationFound(newLocation);
        }
      },
      (error) => {
        console.error("❌ Geolocation-Fehler:", error);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [onLocationFound]);

  return {
    userLocation,
    setUserLocation,
    userLocationRequestedRef,
    getUserLocation,
  };
}
