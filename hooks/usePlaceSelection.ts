import { useState, useCallback, useRef, useEffect } from "react";
import type mapboxgl from "mapbox-gl";
import type { Place } from "../types";

export function usePlaceSelection(mapRef: React.RefObject<mapboxgl.Map | null>) {
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(false);

  const closePanelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPanelOpenRef = useRef(false);
  const isMapAnimatingRef = useRef(false);
  const pinSizeAnimFrameRef = useRef<number | null>(null);

  const animateToLocation = useCallback(
    (location: [number, number], zoom: number, duration = 1500) => {
      if (!mapRef.current) return;

      isMapAnimatingRef.current = true;
      mapRef.current.easeTo({
        center: location,
        zoom,
        duration,
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
          mapRef.current.setLayoutProperty("places-selected", "icon-size", size);
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
    (place: Place) => {
      // Anuluj aktywny timeout zamknięcia — zapobiega race condition,
      // gdy nowa pinezka jest klikana zanim 600ms timeout z closePanel dobiegnie końca
      if (closePanelTimeoutRef.current) {
        clearTimeout(closePanelTimeoutRef.current);
        closePanelTimeoutRef.current = null;
      }

      setSelectedPlace(place);
      setIsPanelOpen(true);
      isPanelOpenRef.current = true;

      // Wyłącz interakcje dotykowe mapy gdy panel jest otwarty
      if (mapRef.current) {
        mapRef.current.dragPan.disable();
        mapRef.current.touchZoomRotate.disable();
        mapRef.current.touchPitch.disable();
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
            setTimeout(() => {
              animateToLocation(place.location.coordinates, 16, 1200);
            }, 300);
          }
        });
      });
    },
    [mapRef, animateToLocation, animatePinSize],
  );

  const closePanel = useCallback(() => {
    isPanelOpenRef.current = false;
    setIsPanelVisible(false);

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

    // Przywróć interakcje dotykowe mapy
    if (mapRef.current) {
      mapRef.current.dragPan.enable();
      mapRef.current.touchZoomRotate.enable();
      mapRef.current.touchPitch.enable();
    }

    closePanelTimeoutRef.current = setTimeout(() => {
      closePanelTimeoutRef.current = null;
      setIsPanelOpen(false);
    }, 600);
  }, [mapRef, animatePinSize]);

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
          { padding: 60, duration: 800, ...(maxZoom !== undefined && { maxZoom }) },
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
    animateToLocation,
    handleLocationSelect,
  };
}

