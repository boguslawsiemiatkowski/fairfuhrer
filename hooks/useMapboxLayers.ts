import { useCallback, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { FeatureCollection, Point } from "geojson";
import type { Place } from "../types";
import { placesToGeoJSON, setupPlacesClusterLayers } from "../utils/mapHelpers";
import { generatePopupHTML } from "../utils/popupGenerator";

interface UseMapboxLayersOptions {
  mapRef: React.RefObject<mapboxgl.Map | null>;
  places: Place[];
  userLocation: [number, number] | null;
  popupClassName: string;
  openPanel: (place: Place) => void;
  closePanel: () => void;
  isPanelOpenRef: React.RefObject<boolean>;
  isMapAnimatingRef: React.RefObject<boolean>;
}

export function useMapboxLayers({
  mapRef,
  places,
  userLocation,
  popupClassName,
  openPanel,
  closePanel,
  isPanelOpenRef,
  isMapAnimatingRef,
}: UseMapboxLayersOptions) {
  const layersInitializedRef = useRef(false);
  const hasFittedInitialBoundsRef = useRef(false);
  const hoverPopupRef = useRef<mapboxgl.Popup | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const placesRef = useRef<Place[]>(places);
  const userLocationRef = useRef<[number, number] | null>(userLocation);
  // Indeks O(1) po ID miejsca oraz leniwy cache HTML dymków (generowany on-demand przy hoverze)
  const placeByIdRef = useRef<Map<number, Place>>(
    new Map(places.map((p) => [p.id, p])),
  );
  const popupCacheRef = useRef<Map<number, { place: Place; html: string }>>(
    new Map(),
  );
  const openPanelRef = useRef(openPanel);
  const closePanelRef = useRef(closePanel);

  useEffect(() => {
    placesRef.current = places;
    placeByIdRef.current = new Map(places.map((p) => [p.id, p]));
  }, [places]);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  useEffect(() => {
    openPanelRef.current = openPanel;
    closePanelRef.current = closePanel;
  }, [openPanel, closePanel]);

  const updatePlacesData = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !layersInitializedRef.current) return;

    const source = map.getSource("places-source") as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (!source) return;

    const currentPlaces = placesRef.current;
    source.setData(placesToGeoJSON(currentPlaces) as FeatureCollection<Point>);

    // Dopasuj kadr kamery (fitBounds) tylko raz — przy pierwszym załadowaniu mapy.
    // Przełączanie filtrów kategorii aktualizuje wyłącznie piny w bieżącym widoku,
    // nie resetując przybliżenia ani pozycji kamery użytkownika.
    if (currentPlaces.length > 0 && !hasFittedInitialBoundsRef.current) {
      hasFittedInitialBoundsRef.current = true;

      const bounds = new mapboxgl.LngLatBounds();
      currentPlaces
        .filter((p) => p.location?.coordinates)
        .forEach((p) => bounds.extend(p.location.coordinates));
      if (userLocationRef.current) bounds.extend(userLocationRef.current);

      const padding =
        window.innerWidth > 768
          ? { top: 80, bottom: 80, left: 80, right: 80 }
          : { top: 50, bottom: 50, left: 20, right: 20 };

      map.fitBounds(bounds, { padding, duration: 1000 });
    }
  }, [mapRef]);

  const initializeLayersAndEvents = useCallback(
    (map: mapboxgl.Map) => {
      if (layersInitializedRef.current) return;

      setupPlacesClusterLayers(map, placesRef.current);
      layersInitializedRef.current = true;
      updatePlacesData();

      // ---- KURSORY ----
      map.on("mouseenter", "places-unclustered", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "places-unclustered", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", "places-clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "places-clusters", () => {
        map.getCanvas().style.cursor = "";
      });

      // ---- HOVER TOOLTIP ----
      map.on("mouseenter", "places-unclustered", (e) => {
        if (!e.features?.length) return;
        const feature = e.features[0];
        const placeId = feature.properties?.placeId as number;

        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }

        if (hoverPopupRef.current) {
          hoverPopupRef.current.remove();
          hoverPopupRef.current = null;
        }

        const geometry = feature.geometry as Point;
        const coords = geometry.coordinates as [number, number];
        const place = placeByIdRef.current.get(placeId);
        if (!place) return;

        // Leniwe generowanie i cachowanie HTML dymku (on-demand przy najechaniu)
        const cached = popupCacheRef.current.get(placeId);
        let html: string;
        if (cached && cached.place === place) {
          html = cached.html;
        } else {
          html = generatePopupHTML(place);
          popupCacheRef.current.set(placeId, { place, html });
        }
        if (!html) return;

        hoverPopupRef.current = new mapboxgl.Popup({
          offset: [0, -36],
          closeButton: false,
          className: popupClassName,
          maxWidth: "320px",
        })
          .setLngLat(coords)
          .setHTML(html)
          .addTo(map);

        // Hover-Hold: zatrzymaj timer zamknięcia gdy kursor znajduje się nad popupem
        const popupEl = hoverPopupRef.current.getElement();
        if (popupEl) {
          popupEl.addEventListener("mouseenter", () => {
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current);
              hoverTimeoutRef.current = null;
            }
          });
          popupEl.addEventListener("mouseleave", () => {
            hoverTimeoutRef.current = setTimeout(() => {
              if (hoverPopupRef.current) {
                hoverPopupRef.current.remove();
                hoverPopupRef.current = null;
              }
              hoverTimeoutRef.current = null;
            }, 300);
          });
        }
      });

      map.on("mouseleave", "places-unclustered", () => {
        hoverTimeoutRef.current = setTimeout(() => {
          if (hoverPopupRef.current) {
            hoverPopupRef.current.remove();
            hoverPopupRef.current = null;
          }
          hoverTimeoutRef.current = null;
        }, 300);
      });

      // ---- KLIK na pin → otwórz panel informacyjny ----
      map.on("click", "places-unclustered", (e) => {
        if (!e.features?.length) return;
        const placeId = e.features[0].properties?.placeId as number;
        e.originalEvent.stopPropagation();

        if (hoverPopupRef.current) {
          hoverPopupRef.current.remove();
          hoverPopupRef.current = null;
        }

        const place = placeByIdRef.current.get(placeId);
        if (place) {
          openPanelRef.current(place);
        }
      });

      // ---- KLIK na klaster → przybliż mapę ----
      map.on("click", "places-clusters", (e) => {
        if (!e.features?.length) return;
        const clusterId = e.features[0].properties?.cluster_id as number;
        const source = map.getSource("places-source") as mapboxgl.GeoJSONSource;
        const geometry = e.features[0].geometry as Point;
        const coords = geometry.coordinates as [number, number];

        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return;
          map.easeTo({ center: coords, zoom });
        });

        e.originalEvent.stopPropagation();
      });

      // ---- KLIK w pustą mapę → zamknij panel ----
      map.on("click", (e) => {
        // Ignoruj kliknięcia podczas programowej animacji mapy (easeTo)
        if (isMapAnimatingRef.current) return;
        if (!isPanelOpenRef.current) return;

        const features = map.queryRenderedFeatures(e.point, {
          layers: ["places-unclustered", "places-clusters"],
        });
        if (!features.length) {
          closePanelRef.current();
        }
      });
    },
    [popupClassName, updatePlacesData, isMapAnimatingRef, isPanelOpenRef],
  );

  // Aktualizuj dane źródła GeoJSON gdy zmieni się lista miejsc (np. filtry kategorii)
  useEffect(() => {
    if (!mapRef.current || !layersInitializedRef.current) return;
    if (mapRef.current.isStyleLoaded()) {
      updatePlacesData();
    }
  }, [places, updatePlacesData, mapRef]);

  const cleanupLayers = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (hoverPopupRef.current) {
      hoverPopupRef.current.remove();
      hoverPopupRef.current = null;
    }
    layersInitializedRef.current = false;
    hasFittedInitialBoundsRef.current = false;
  }, []);

  return {
    placesRef,
    layersInitializedRef,
    initializeLayersAndEvents,
    cleanupLayers,
  };
}

