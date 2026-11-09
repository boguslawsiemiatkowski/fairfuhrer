import { useCallback, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { FeatureCollection, Point } from "geojson";
import type { Place } from "../types";
import { placesToGeoJSON, setupPlacesClusterLayers } from "../utils/mapHelpers";
import { generatePopupHTML } from "../utils/popupGenerator";

interface UseMapboxLayersOptions {
  mapRef: React.RefObject<mapboxgl.Map | null>;
  places: Place[];
  popupClassName: string;
  openPanel: (place: Place) => void;
  closePanel: () => void;
  isPanelOpenRef: React.RefObject<boolean>;
  isMapAnimatingRef: React.RefObject<boolean>;
  isPickingOriginRef?: React.RefObject<boolean>;
  onMapClickForOrigin?: (
    coords: [number, number],
    clickedPlace?: Place,
  ) => void;
}

export function useMapboxLayers({
  mapRef,
  places,
  popupClassName,
  openPanel,
  closePanel,
  isPanelOpenRef,
  isMapAnimatingRef,
  isPickingOriginRef,
  onMapClickForOrigin,
}: UseMapboxLayersOptions) {
  const layersInitializedRef = useRef(false);
  const hasFittedInitialBoundsRef = useRef(false);
  const hoverPopupRef = useRef<mapboxgl.Popup | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const placesRef = useRef<Place[]>(places);
  // Indeks O(1) po ID miejsca oraz leniwy cache HTML dymków (generowany on-demand przy hoverze)
  const placeByIdRef = useRef<Map<number, Place>>(
    new Map(places.map((p) => [p.id, p])),
  );
  const popupCacheRef = useRef<Map<number, { place: Place; html: string }>>(
    new Map(),
  );
  const openPanelRef = useRef(openPanel);
  const closePanelRef = useRef(closePanel);
  const onMapClickForOriginRef = useRef(onMapClickForOrigin);

  useEffect(() => {
    placesRef.current = places;
    placeByIdRef.current = new Map(places.map((p) => [p.id, p]));
  }, [places]);

  useEffect(() => {
    openPanelRef.current = openPanel;
    closePanelRef.current = closePanel;
    onMapClickForOriginRef.current = onMapClickForOrigin;
  }, [openPanel, closePanel, onMapClickForOrigin]);

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

      // Jeśli w URL jest ?pin=..., pomiń ogólne fitBounds na cały region,
      // ponieważ kamera od razu poleci bezpośrednio do wskazanego pinu
      const hasUrlPin =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).has("pin");
      if (hasUrlPin) return;

      const bounds = new mapboxgl.LngLatBounds();
      currentPlaces
        .filter((p) => p.location?.coordinates)
        .forEach((p) => bounds.extend(p.location.coordinates));

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
        map.getCanvas().style.cursor = isPickingOriginRef?.current
          ? "crosshair"
          : "";
      });
      map.on("mouseenter", "places-clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "places-clusters", () => {
        map.getCanvas().style.cursor = isPickingOriginRef?.current
          ? "crosshair"
          : "";
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

        // Hover-Hold oraz otwieranie panelu po kliknięciu w dowolne miejsce dymku
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
          popupEl.addEventListener("click", (ev) => {
            const target = ev.target as HTMLElement | null;
            // Pozwól na normalne działanie kliknięcia w link telefoniczny (tel:...)
            if (target?.closest("a")) return;
            ev.stopPropagation();

            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current);
              hoverTimeoutRef.current = null;
            }
            if (hoverPopupRef.current) {
              hoverPopupRef.current.remove();
              hoverPopupRef.current = null;
            }
            if (isPickingOriginRef?.current) {
              onMapClickForOriginRef.current?.(
                place.location.coordinates,
                place,
              );
            } else {
              openPanelRef.current(place);
            }
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

      // ---- KLIK na pin → otwórz panel informacyjny (lub ustaw Startpunkt w trybie wyboru na mapie) ----
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
          if (isPickingOriginRef?.current) {
            onMapClickForOriginRef.current?.(place.location.coordinates, place);
          } else {
            openPanelRef.current(place);
          }
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

      // ---- KLIK w pustą mapę → ustaw Startpunkt trasy lub zamknij panel ----
      map.on("click", (e) => {
        // Ignoruj kliknięcia podczas programowej animacji mapy (easeTo)
        if (isMapAnimatingRef.current) return;

        const features = map.queryRenderedFeatures(e.point, {
          layers: ["places-unclustered", "places-clusters"],
        });
        if (features.length) return;

        if (isPickingOriginRef?.current) {
          onMapClickForOriginRef.current?.([e.lngLat.lng, e.lngLat.lat]);
          return;
        }

        if (isPanelOpenRef.current) {
          closePanelRef.current();
        }
      });
    },
    [
      popupClassName,
      updatePlacesData,
      isMapAnimatingRef,
      isPanelOpenRef,
      isPickingOriginRef,
    ],
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

