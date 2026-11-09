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
  GERMAN_MAPBOX_LOCALE,
} from "../utils/mapHelpers";
import { usePlaceSelection } from "../hooks/usePlaceSelection";
import { useMapboxLayers } from "../hooks/useMapboxLayers";
import {
  useMapboxRoute,
  formatDuration,
  type RouteProfile,
} from "../hooks/useMapboxRoute";
import { formatDistance } from "../lib/orte-shared";

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
  const geolocateControlRef = useRef<mapboxgl.GeolocateControl | null>(null);

  const [mapLoadingState, setMapLoadingState] = useState<
    "loading" | "success" | "error"
  >("loading");
  const [mobileMapPreview, setMobileMapPreview] = useState(false);

  // Stan wybranego miejsca, panelu bocznego, synchronizacji URL (?pin=) oraz animacji kamery/pinów
  const {
    selectedPlace,
    isPanelOpen,
    isPanelVisible,
    isPanelOpenRef,
    isMapAnimatingRef,
    openPanel,
    closePanel: baseClosePanel,
    openInitialPinFromUrl,
    handleLocationSelect,
  } = usePlaceSelection(mapRef, {
    syncUrl: !embedded,
    places: searchablePlaces,
    onEnsurePlaceVisible,
  });

  // Wyznaczanie trasy na mapie (Mapbox Directions API v5)
  const route = useMapboxRoute({
    mapRef,
    destination: selectedPlace,
    isMapAnimatingRef,
  });

  const closePanel = useCallback(() => {
    setMobileMapPreview(false);
    route.closeAndClearRoute();
    baseClosePanel();
  }, [route, baseClosePanel]);

  const handleOpenPanel = useCallback(
    (place: Place) => {
      setMobileMapPreview(false);
      route.handleDestinationChange(place);
      openPanel(place);
    },
    [openPanel, route],
  );

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
    openPanel: handleOpenPanel,
    closePanel,
    isPanelOpenRef,
    isMapAnimatingRef,
    isPickingOriginRef: route.isPickingOnMapRef,
    onMapClickForOrigin: (coords, clickedPlace) => {
      setMobileMapPreview(false);
      route.handleMapClickForOrigin(coords, clickedPlace);
    },
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
        locale: GERMAN_MAPBOX_LOCALE,
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

          geolocateControlRef.current = geolocateControl;
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

          // Jeśli w URL przekazano również ?route=1 lub ?route=walking|cycling|driving (np. ze strony audiopinu),
          // automatycznie rozwiń sekcję Routenplaner w otwartym panelu
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            const routeParam = url.searchParams.get("route");
            if (routeParam && url.searchParams.has("pin")) {
              const initialProfile: RouteProfile | undefined =
                routeParam === "walking" ||
                routeParam === "cycling" ||
                routeParam === "driving"
                  ? routeParam
                  : undefined;
              route.openPlanner(initialProfile);
            }
          }
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

  // Mount / Unmount mapy oraz nasłuchiwanie wywołania geolokalizacji z poziomu Legendy
  useEffect(() => {
    initializeMap();

    const handleTriggerGeolocate = () => {
      geolocateControlRef.current?.trigger();
    };
    window.addEventListener(
      "fairfuehrer:trigger-geolocate",
      handleTriggerGeolocate,
    );

    return () => {
      window.removeEventListener(
        "fairfuehrer:trigger-geolocate",
        handleTriggerGeolocate,
      );
      geolocateControlRef.current = null;
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

      {/* Pływający pasek instrukcji nad mapą podczas wybierania punktu startowego kliknięciem */}
      {route.status === "picking-on-map" && (
        <div
          className={styles.pickingFloatingBanner}
          role="status"
          aria-live="polite"
        >
          <span>
            <strong>Startpunkt wählen:</strong> Tippen Sie auf eine Stelle oder
            einen Pin auf der Karte.
          </span>
          <button
            type="button"
            className={styles.pickingFloatingCancelBtn}
            onClick={route.cancelPickingOnMap}
          >
            Abbrechen
          </button>
        </div>
      )}

      {/* Na ekranach mobilnych (<= 860px) pasek podglądu trasy na mapie, gdy pełnoekranowy panel jest zwinięty */}
      {mobileMapPreview && route.routeResult && selectedPlace && (
        <div
          className={styles.mobileRoutePreviewBar}
          role="region"
          aria-label="Aktive Route auf der Karte"
        >
          <div className={styles.mobileRoutePreviewInfo}>
            <span className={styles.mobileRoutePreviewMetrics}>
              {formatDuration(route.routeResult.durationSeconds)} ·{" "}
              {formatDistance(route.routeResult.distanceMeters)}
            </span>
            <span className={styles.mobileRoutePreviewDest}>
              Nach {selectedPlace.Name}
            </span>
          </div>
          <div className={styles.mobileRoutePreviewActions}>
            <button
              type="button"
              className={styles.mobileRoutePreviewPrimaryBtn}
              onClick={() => setMobileMapPreview(false)}
            >
              Details &amp; Schritte
            </button>
            <button
              type="button"
              className={styles.mobileRoutePreviewCloseBtn}
              onClick={() => {
                setMobileMapPreview(false);
                route.closeAndClearRoute();
              }}
            >
              Beenden
            </button>
          </div>
        </div>
      )}

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
            handleOpenPanel(place);
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
            mobileMapPreview={mobileMapPreview}
            onExitMobileMapPreview={() => setMobileMapPreview(false)}
            routePlanner={
              !embedded
                ? {
                    allPlaces: searchablePlaces,
                    isPlannerOpen: route.isPlannerOpen,
                    profile: route.profile,
                    origin: route.origin,
                    status: route.status,
                    errorMessage: route.errorMessage,
                    infoNotice: route.infoNotice,
                    routeResult: route.routeResult,
                    isOriginFarForActiveMobility:
                      route.isOriginFarForActiveMobility,
                    onOpenPlanner: route.openPlanner,
                    onCloseRoute: () => {
                      setMobileMapPreview(false);
                      route.closeAndClearRoute();
                    },
                    onChangeProfile: route.changeProfile,
                    onSelectGpsOrigin: route.selectGpsOrigin,
                    onSelectCustomOrigin: route.selectCustomOrigin,
                    onStartPickingOnMap: route.startPickingOnMap,
                    onCancelPickingOnMap: route.cancelPickingOnMap,
                    onFitRouteBounds: () => {
                      if (
                        typeof window !== "undefined" &&
                        window.innerWidth <= 860
                      ) {
                        setMobileMapPreview(true);
                      }
                      route.fitRouteBounds();
                    },
                  }
                : undefined
            }
          />
        </Suspense>
      </Activity>
    </div>
  );
}
