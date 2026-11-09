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
} from "../utils/mapHelpers";
import { usePlaceSelection } from "../hooks/usePlaceSelection";
import { useMapboxLayers } from "../hooks/useMapboxLayers";

const PlaceInfoPanel = lazy(() => import("./PlaceInfoPanel"));

interface MapBoxMapProps {
  places: Place[];
  allPlaces?: Place[];
  onEnsurePlaceVisible?: (place: Place) => void;
  disableGeolocation?: boolean;
  embedded?: boolean;
}

export default function MapBoxMap({
  places,
  allPlaces,
  onEnsurePlaceVisible,
  disableGeolocation = false,
  embedded = false,
}: MapBoxMapProps) {
  const searchablePlaces = allPlaces ?? places;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [mapLoadingState, setMapLoadingState] = useState<
    "loading" | "success" | "error"
  >("loading");

  // Stan wybranego miejsca, panelu bocznego, synchronizacji URL (?pin=) oraz animacji kamery/pinów
  const {
    selectedPlace,
    isPanelOpen,
    isPanelVisible,
    isPanelOpenRef,
    isMapAnimatingRef,
    openPanel,
    closePanel,
    openInitialPinFromUrl,
    handleLocationSelect,
  } = usePlaceSelection(mapRef, {
    syncUrl: !embedded,
    places: searchablePlaces,
    onEnsurePlaceVisible,
  });

  // Warstwy GeoJSON, klastry, popupy hover i zdarzenia mapy
  const {
    placesRef,
    layersInitializedRef,
    initializeLayersAndEvents,
    cleanupLayers,
  } = useMapboxLayers({
    mapRef,
    places,
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
        center: [9.0, 47.5],
        zoom: 6,
        attributionControl: true,
        cooperativeGestures: disableGeolocation,
      });

      map.on("load", () => {
        setMapLoadingState("success");
        applyGermanMapStyle(map);

        map.addControl(new mapboxgl.NavigationControl(), "top-left");

        if (!disableGeolocation) {
          // Natywna kontrolka geolokalizacji na żądanie użytkownika:
          // - maximumAge: 0 wymusza świeży odczyt (zamiast starej pozycji IP z cache przeglądarki)
          // - trackUserLocation: true używa watchPosition i na bieżąco doprecyzowuje pozycję Wi-Fi/GPS
          // - showAccuracyCircle: true pokazuje realny promień dokładności odczytu
          const geolocateControl = new mapboxgl.GeolocateControl({
            positionOptions: {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0,
            },
            fitBoundsOptions: {
              maxZoom: 15,
            },
            trackUserLocation: true,
            showUserHeading: true,
            showUserLocation: true,
            showAccuracyCircle: true,
          });

          map.addControl(geolocateControl, "top-left");
        }

        // Załaduj ikony SVG dla każdej kategorii ze wszystkich miejsc, następnie utwórz warstwy i podepnij zdarzenia
        const categoryMap = new Map<number, string>();
        searchablePlaces.forEach((p) =>
          p.Kategorie.forEach((cat) =>
            categoryMap.set(cat.id, categoryColorFor(cat)),
          ),
        );
        const categories = Array.from(categoryMap.entries()).map(
          ([id, color]) => ({ id, color }),
        );

        loadCategoryMarkerSDFs(map, categories, () => {
          initializeLayersAndEvents(map);
          openInitialPinFromUrl();
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

  // Mount / Unmount mapy
  useEffect(() => {
    initializeMap();

    return () => {
      cleanupLayers();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {mapLoadingState === "loading" && (
        <div
          className={styles.skeletonOverlay}
          role="status"
          aria-live="polite"
          aria-label="Karte wird initialisiert"
        >
          <div className={styles.skeletonGrid} aria-hidden="true" />
          <div className={styles.skeletonBadge}>
            <span className={styles.skeletonSpinner} aria-hidden="true" />
            <span className={styles.skeletonText}>Karte wird geladen…</span>
          </div>
        </div>
      )}

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
            const place =
              searchablePlaces.find((p) => p.id === placeId) ??
              placesRef.current.find((p) => p.id === placeId);
            if (!place) return;
            onEnsurePlaceVisible?.(place);
            mapRef.current?.flyTo({
              center: place.location.coordinates,
              zoom: 16,
              duration: 800,
            });
            openPanel(place);
          }}
          places={searchablePlaces}
          disabled={mapLoadingState !== "success"}
          panelOpen={isPanelOpen && isPanelVisible}
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
