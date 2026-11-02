"use client";

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  lazy,
  Suspense,
  Activity,
} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { categoryColorFor } from "./CategoryIcon";
import styles from "./MapBoxMap.module.css";
import MapSearch from "./MapSearch";
import type { Place } from "../types";
import {
  isValidMapboxToken,
  loadCategoryMarkerSDFs,
  applyGermanMapStyle,
  createUserLocationMarker,
} from "../utils/mapHelpers";
import { useGeolocation } from "../hooks/useGeolocation";
import { usePlaceSelection } from "../hooks/usePlaceSelection";
import { useMapboxLayers } from "../hooks/useMapboxLayers";

const PlaceInfoPanel = lazy(() => import("./PlaceInfoPanel"));

interface MapBoxMapProps {
  places: Place[];
  disableGeolocation?: boolean;
  embedded?: boolean;
}

export default function MapBoxMap({
  places,
  disableGeolocation = false,
  embedded = false,
}: MapBoxMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userLocationMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const [mapLoadingState, setMapLoadingState] = useState<
    "loading" | "success" | "error"
  >("loading");

  // Stan wybranego miejsca, panelu bocznego oraz animacji kamery/pinów
  const {
    selectedPlace,
    isPanelOpen,
    isPanelVisible,
    isPanelOpenRef,
    isMapAnimatingRef,
    openPanel,
    closePanel,
    animateToLocation,
    handleLocationSelect,
  } = usePlaceSelection(mapRef);

  // Geolokalizacja użytkownika
  const handleLocationFound = useCallback(
    (location: [number, number]) => {
      animateToLocation(location, 14, 1800);
    },
    [animateToLocation],
  );

  const {
    userLocation,
    setUserLocation,
    userLocationRequestedRef,
    getUserLocation,
  } = useGeolocation(handleLocationFound);

  // Warstwy GeoJSON, klastry, popupy hover i zdarzenia mapy
  const {
    placesRef,
    layersInitializedRef,
    initializeLayersAndEvents,
    cleanupLayers,
  } = useMapboxLayers({
    mapRef,
    places,
    userLocation,
    popupClassName: styles.popup,
    openPanel,
    closePanel,
    isPanelOpenRef,
    isMapAnimatingRef,
  });

  // Inicjalizacja instancji Mapbox GL
  const initializeMap = useCallback(() => {
    if (mapRef.current || !containerRef.current) return;
    if (layersInitializedRef.current) return;
    if (!isValidMapboxToken()) return;

    try {
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: userLocation || [9.0, 47.5],
        zoom: userLocation ? 12 : 6,
        attributionControl: true,
        cooperativeGestures: disableGeolocation,
      });

      map.on("load", () => {
        setMapLoadingState("success");
        applyGermanMapStyle(map);

        map.addControl(new mapboxgl.NavigationControl(), "top-left");

        if (!disableGeolocation) {
          const geolocateControl = new mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
            showUserHeading: true,
            showUserLocation: true,
          });

          map.addControl(geolocateControl, "top-left");

          geolocateControl.on("geolocate", (e) => {
            userLocationRequestedRef.current = true;
            const location: [number, number] = [
              e.coords.longitude,
              e.coords.latitude,
            ];
            setUserLocation(location);
            setTimeout(() => {
              animateToLocation(location, 14, 1800);
            }, 150);
          });
        }

        // Załaduj ikony SVG dla każdej kategorii, następnie utwórz warstwy i podepnij zdarzenia
        const categoryMap = new Map<number, string>();
        placesRef.current.forEach((p) =>
          p.Kategorie.forEach((cat) =>
            categoryMap.set(cat.id, categoryColorFor(cat)),
          ),
        );
        const categories = Array.from(categoryMap.entries()).map(
          ([id, color]) => ({ id, color }),
        );

        loadCategoryMarkerSDFs(map, categories, () => {
          initializeLayersAndEvents(map);
        });
      });

      map.on("error", (e) => {
        console.error("Błąd mapy:", e);
        setMapLoadingState("error");
      });

      mapRef.current = map;
    } catch (error) {
      console.error("Błąd inicjalizacji mapy:", error);
      queueMicrotask(() => setMapLoadingState("error"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pobierz lokalizację użytkownika po załadowaniu mapy
  useEffect(() => {
    if (disableGeolocation) return;
    if (mapLoadingState === "success" && !userLocationRequestedRef.current) {
      const timer = setTimeout(() => {
        getUserLocation();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [
    mapLoadingState,
    getUserLocation,
    disableGeolocation,
    userLocationRequestedRef,
  ]);

  // Mount / Unmount mapy
  useEffect(() => {
    initializeMap();

    return () => {
      cleanupLayers();
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aktualizuj pulsujący marker pozycji użytkownika
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;

    const placeUserMarker = () => {
      try {
        if (userLocationMarkerRef.current) {
          userLocationMarkerRef.current.remove();
          userLocationMarkerRef.current = null;
        }
        userLocationMarkerRef.current = createUserLocationMarker(
          map,
          userLocation,
          styles.popup,
        );
      } catch (error) {
        console.error("❌ Błąd podczas dodawania markera użytkownika:", error);
      }
    };

    if (map.isStyleLoaded()) {
      placeUserMarker();
    } else {
      map.once("idle", placeUserMarker);
    }
  }, [userLocation]);

  if (!isValidMapboxToken()) {
    return (
      <div className={styles.mapContainerWrapper}>
        <div className={styles.errorContainer}>
          <h3>Konfigurationsfehler</h3>
          <p>Mapbox-Token ist nicht konfiguriert oder ungültig.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.mapContainerWrapper}${embedded ? ` ${styles.mapContainerWrapperEmbedded}` : ""}`}
    >
      {mapLoadingState === "error" && (
        <div className={styles.errorOverlay}>
          <div className={styles.errorContainer}>
            <h3>Fehler beim Laden der Karte</h3>
            <p>Die Karte konnte nicht geladen werden.</p>
            <button
              type="button"
              onClick={() => {
                setMapLoadingState("loading");
                initializeMap();
              }}
              className={styles.retryButton}
            >
              Erneut versuchen
            </button>
          </div>
        </div>
      )}

      <div ref={containerRef} className={styles.mapContainer} />

      {!embedded && (
        <MapSearch
          onLocationSelect={handleLocationSelect}
          onPinSelect={(placeId) => {
            const place = placesRef.current.find((p) => p.id === placeId);
            if (!place) return;
            mapRef.current?.flyTo({
              center: place.location.coordinates,
              zoom: 16,
              duration: 800,
            });
            openPanel(place);
          }}
          places={places}
          disabled={mapLoadingState !== "success"}
        />
      )}

      <Activity mode={isPanelOpen ? "visible" : "hidden"}>
        <Suspense
          fallback={
            <div className={styles.loadingOverlay}>
              <div className={styles.loadingSpinner}>Panel wird geladen...</div>
            </div>
          }
        >
          <PlaceInfoPanel
            place={selectedPlace}
            isOpen={isPanelOpen}
            isVisible={isPanelVisible}
            onCloseAction={closePanel}
          />
        </Suspense>
      </Activity>
    </div>
  );
}
