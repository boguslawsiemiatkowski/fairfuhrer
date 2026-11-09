import { useState, useCallback, useRef, useEffect } from "react";
import type mapboxgl from "mapbox-gl";
import type { Place } from "../types";

interface UsePlaceSelectionOptions {
  syncUrl?: boolean;
  places?: Place[];
  onEnsurePlaceVisible?: (place: Place) => void;
}

function findPlaceByParam(places: Place[], param: string): Place | undefined {
  const normalized = param.trim().toLowerCase();
  if (!normalized) return undefined;
  return places.find(
    (p) =>
      (p.slug && p.slug.toLowerCase() === normalized) ||
      String(p.id) === normalized,
  );
}

export function usePlaceSelection(
  mapRef: React.RefObject<mapboxgl.Map | null>,
  options?: UsePlaceSelectionOptions,
) {
  const syncUrl = options?.syncUrl ?? false;
  const onEnsurePlaceVisibleRef = useRef(options?.onEnsurePlaceVisible);
  useEffect(() => {
    onEnsurePlaceVisibleRef.current = options?.onEnsurePlaceVisible;
  }, [options?.onEnsurePlaceVisible]);
  const placesRef = useRef<Place[]>(options?.places ?? []);
  useEffect(() => {
    placesRef.current = options?.places ?? [];
  }, [options?.places]);

  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(false);

  const closePanelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPanelOpenRef = useRef(false);
  const isMapAnimatingRef = useRef(false);
  const pinSizeAnimFrameRef = useRef<number | null>(null);

  const animateToLocation = useCallback(
    (
      location: [number, number],
      zoom: number,
      duration = 1500,
      withPanelOffset = false,
    ) => {
      if (!mapRef.current) return;

      const isDesktop =
        typeof window !== "undefined" && window.innerWidth > 860;
      const rightOffset =
        withPanelOffset && isDesktop
          ? window.innerWidth >= 1200
            ? 450
            : 410
          : 0;

      isMapAnimatingRef.current = true;
      mapRef.current.easeTo({
        center: location,
        zoom,
        duration,
        padding: { top: 0, bottom: 0, left: 0, right: rightOffset },
        easing: (t) => 1 - Math.pow(1 - t, 3),
        essential: true,
      });

      // Zdejmij flagę po zakończeniu animacji (z marginesem 100ms)
      setTimeout(() => {
        isMapAnimatingRef.current = false;
      }, duration + 100);
    },
    [mapRef],
  );

  const animatePinSize = useCallback(
    (from: number, to: number, duration = 280) => {
      if (pinSizeAnimFrameRef.current) {
        cancelAnimationFrame(pinSizeAnimFrameRef.current);
        pinSizeAnimFrameRef.current = null;
      }

      const start = performance.now();
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const size = from + (to - from) * easeOutCubic(t);
        if (mapRef.current?.getLayer("places-selected")) {
          mapRef.current.setLayoutProperty(
            "places-selected",
            "icon-size",
            size,
          );
        }
        if (t < 1) {
          pinSizeAnimFrameRef.current = requestAnimationFrame(tick);
        } else {
          pinSizeAnimFrameRef.current = null;
        }
      };

      pinSizeAnimFrameRef.current = requestAnimationFrame(tick);
    },
    [mapRef],
  );

  const openPanel = useCallback(
    (place: Place, opts?: { skipUrlSync?: boolean }) => {
      // Anuluj aktywny timeout zamknięcia — zapobiega race condition,
      // gdy nowa pinezka jest klikana zanim timeout z closePanel dobiegnie końca
      if (closePanelTimeoutRef.current) {
        clearTimeout(closePanelTimeoutRef.current);
        closePanelTimeoutRef.current = null;
      }

      const wasAlreadyOpen = isPanelOpenRef.current;

      setSelectedPlace(place);
      setIsPanelOpen(true);
      isPanelOpenRef.current = true;

      // Synchronizacja stanu otwartego pinu w URL (?pin=slug lub ?pin=id)
      if (syncUrl && !opts?.skipUrlSync && typeof window !== "undefined") {
        const pinIdentifier = place.slug || String(place.id);
        const url = new URL(window.location.href);
        if (url.searchParams.get("pin") !== pinIdentifier) {
          url.searchParams.set("pin", pinIdentifier);
          if (wasAlreadyOpen) {
            window.history.replaceState(null, "", url.toString());
          } else {
            window.history.pushState(null, "", url.toString());
          }
        }
      }

      // Podświetl wybrany pin — płynne powiększenie
      if (mapRef.current?.getLayer("places-selected")) {
        mapRef.current.setLayoutProperty("places-selected", "icon-size", 1);
        mapRef.current.setFilter("places-selected", [
          "==",
          ["get", "placeId"],
          place.id,
        ]);
        animatePinSize(1, 1.45);
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsPanelVisible(true);

          if (mapRef.current) {
            const currentZoom = mapRef.current.getZoom();
            const targetZoom = Math.max(currentZoom, 15.5);
            setTimeout(
              () => {
                animateToLocation(
                  place.location.coordinates,
                  targetZoom,
                  wasAlreadyOpen ? 850 : 1100,
                  true,
                );
              },
              wasAlreadyOpen ? 40 : 180,
            );
          }
        });
      });
    },
    [mapRef, animateToLocation, animatePinSize, syncUrl],
  );

  const closePanel = useCallback(
    (opts?: { skipUrlSync?: boolean }) => {
      isPanelOpenRef.current = false;
      setIsPanelVisible(false);

      // Usunięcie ?pin= z URL po zamknięciu panelu
      if (syncUrl && !opts?.skipUrlSync && typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (url.searchParams.has("pin")) {
          url.searchParams.delete("pin");
          window.history.replaceState(null, "", url.toString());
        }
      }

      // Reset podświetlonego pinu — płynne zmniejszenie, potem ukrycie
      if (mapRef.current?.getLayer("places-selected")) {
        animatePinSize(1.45, 1);
        setTimeout(() => {
          if (mapRef.current?.getLayer("places-selected")) {
            mapRef.current.setFilter("places-selected", [
              "==",
              ["get", "placeId"],
              -1,
            ]);
          }
        }, 280);
      }

      closePanelTimeoutRef.current = setTimeout(() => {
        closePanelTimeoutRef.current = null;
        setIsPanelOpen(false);
      }, 450);
    },
    [mapRef, animatePinSize, syncUrl],
  );

  // Otwarcie pinu przekazanego w URL (?pin=slug lub ?pin=id) zaraz po załadowaniu warstw mapy
  const openInitialPinFromUrl = useCallback(() => {
    if (!syncUrl || typeof window === "undefined") return;
    const pinParam = new URLSearchParams(window.location.search).get("pin");
    if (!pinParam) return;

    const place = findPlaceByParam(placesRef.current, pinParam);
    if (place) {
      onEnsurePlaceVisibleRef.current?.(place);
      openPanel(place, { skipUrlSync: true });
    }
  }, [syncUrl, openPanel]);

  // Obsługa przycisku Wstecz / Dalej w przeglądarce (popstate)
  useEffect(() => {
    if (!syncUrl || typeof window === "undefined") return;

    const handlePopState = () => {
      const pinParam = new URLSearchParams(window.location.search).get("pin");
      if (!pinParam) {
        if (isPanelOpenRef.current) {
          closePanel({ skipUrlSync: true });
        }
        return;
      }

      const place = findPlaceByParam(placesRef.current, pinParam);
      if (place) {
        openPanel(place, { skipUrlSync: true });
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [syncUrl, openPanel, closePanel]);

  const handleLocationSelect = useCallback(
    (
      coords: [number, number],
      zoom: number,
      bbox?: [number, number, number, number],
      maxZoom?: number,
    ) => {
      const map = mapRef.current;
      if (!map) return;

      if (bbox) {
        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          {
            padding: 60,
            duration: 800,
            ...(maxZoom !== undefined && { maxZoom }),
          },
        );
      } else {
        map.flyTo({ center: coords, zoom, duration: 800 });
      }
    },
    [mapRef],
  );

  useEffect(() => {
    return () => {
      if (closePanelTimeoutRef.current) {
        clearTimeout(closePanelTimeoutRef.current);
      }
      if (pinSizeAnimFrameRef.current) {
        cancelAnimationFrame(pinSizeAnimFrameRef.current);
      }
    };
  }, []);

  return {
    selectedPlace,
    isPanelOpen,
    isPanelVisible,
    isPanelOpenRef,
    isMapAnimatingRef,
    openPanel,
    closePanel,
    openInitialPinFromUrl,
    animateToLocation,
    handleLocationSelect,
  };
}
