// hooks/useMapboxRoute.ts
// Hook zarządzający wyznaczaniem trasy (Mapbox Directions API v5), rysowaniem
// warstwy linii trasy oraz znacznika punktu startowego (A) bezpośrednio na mapie FairFührer.

import { useState, useCallback, useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import type { FeatureCollection, LineString } from "geojson";
import { distanceInMeters, formatDistance } from "../lib/orte-shared";
import type { Place } from "../types";

export type RouteProfile = "walking" | "cycling" | "driving";

export interface RouteOrigin {
  type: "gps" | "pin" | "place" | "map-click";
  label: string;
  sublabel?: string;
  coords: [number, number];
  placeId?: number;
}

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
}

export interface RouteResult {
  profile: RouteProfile;
  distanceMeters: number;
  durationSeconds: number;
  geometry: LineString;
  steps: RouteStep[];
}

export type RouteStatus =
  | "idle"
  | "picking-on-map"
  | "locating-gps"
  | "loading-route"
  | "ready"
  | "error";

// Maksymalny dystans w linii prostej dla tras pieszych i rowerowych (120 km).
// Powyżej tego progu Mapbox Directions dla walking/cycling zwraca błąd lub trasa
// nie ma praktycznego sensu turystycznego — wówczas automatycznie przełączamy na Auto
// i wyświetlamy użytkownikowi jasne wyjaśnienie.
export const MAX_ACTIVE_MOBILITY_DISTANCE_M = 120_000;

const ROUTE_SOURCE_ID = "fairfuehrer-route-source";
const ROUTE_CASING_LAYER_ID = "fairfuehrer-route-casing";
const ROUTE_LINE_LAYER_ID = "fairfuehrer-route-line";

const EMPTY_GEOJSON: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [],
};

// Cache obliczonych tras w pamięci sesji (klucz: profile + współrzędne A->B)
const directionsCache = new Map<string, RouteResult>();

function buildCacheKey(
  profile: RouteProfile,
  start: [number, number],
  end: [number, number],
): string {
  const s = `${start[0].toFixed(5)},${start[1].toFixed(5)}`;
  const e = `${end[0].toFixed(5)},${end[1].toFixed(5)}`;
  return `${profile}:${s}->${e}`;
}

export function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes < 60) {
    return `${totalMinutes} Min.`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours} Std. ${mins} Min.` : `${hours} Std.`;
}

interface UseMapboxRouteOptions {
  mapRef: React.RefObject<mapboxgl.Map | null>;
  destination: Place | null;
  isMapAnimatingRef: React.RefObject<boolean>;
}

export function useMapboxRoute({
  mapRef,
  destination,
  isMapAnimatingRef,
}: UseMapboxRouteOptions) {
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [profile, setProfile] = useState<RouteProfile>("walking");
  const [origin, setOrigin] = useState<RouteOrigin | null>(null);
  const [status, setStatus] = useState<RouteStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);

  const isPickingOnMapRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const originMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destinationRef = useRef<Place | null>(destination);

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  // Tworzy warstwy GeoJSON dla linii trasy (pod warstwą klastrów i pinów), jeśli jeszcze nie istnieją
  const ensureRouteLayers = useCallback((map: mapboxgl.Map) => {
    if (!map.isStyleLoaded()) return;

    if (!map.getSource(ROUTE_SOURCE_ID)) {
      map.addSource(ROUTE_SOURCE_ID, {
        type: "geojson",
        data: EMPTY_GEOJSON,
      });
    }

    const beforeLayerId = map.getLayer("places-clusters")
      ? "places-clusters"
      : undefined;

    if (!map.getLayer(ROUTE_CASING_LAYER_ID)) {
      map.addLayer(
        {
          id: ROUTE_CASING_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#18222f",
            "line-width": 9,
            "line-opacity": 0.92,
          },
        },
        beforeLayerId,
      );
    }

    if (!map.getLayer(ROUTE_LINE_LAYER_ID)) {
      map.addLayer(
        {
          id: ROUTE_LINE_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#fc6c14",
            "line-width": 5,
            "line-opacity": 1,
          },
        },
        beforeLayerId,
      );
    }
  }, []);

  // Czyści linię trasy oraz marker punktu startowego z mapy
  const clearMapRouteGraphics = useCallback(() => {
    if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
    }

    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource(ROUTE_SOURCE_ID) as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (source) {
      source.setData(EMPTY_GEOJSON);
    }
  }, [mapRef]);

  // Rysuje marker punktu startowego (START) oraz geometrię trasy i dopasowuje kamerę
  const renderRouteOnMap = useCallback(
    (
      currentOrigin: RouteOrigin,
      currentDest: Place,
      geometry: LineString,
      fitCamera = true,
    ) => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;

      ensureRouteLayers(map);

      const source = map.getSource(ROUTE_SOURCE_ID) as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (source) {
        source.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry,
            },
          ],
        });
      }

      // Marker punktu startowego (A / START)
      if (originMarkerRef.current) {
        originMarkerRef.current.remove();
      }

      const el = document.createElement("div");
      el.style.cssText =
        "display:inline-flex;align-items:center;gap:5px;padding:3px 8px;background:#18222f;color:#ffffff;border:2px solid #ffffff;box-shadow:0 3px 10px rgba(24,34,47,0.35);font-family:var(--font-fira),sans-serif;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;pointer-events:none;white-space:nowrap;";
      const dot = document.createElement("span");
      dot.style.cssText =
        "width:8px;height:8px;border-radius:50%;background:#fc6c14;display:inline-block;flex-shrink:0;";
      const text = document.createElement("span");
      text.textContent = "Start";
      el.appendChild(dot);
      el.appendChild(text);

      originMarkerRef.current = new mapboxgl.Marker({
        element: el,
        anchor: "bottom",
        offset: [0, -6],
      })
        .setLngLat(currentOrigin.coords)
        .addTo(map);

      if (fitCamera && geometry.coordinates.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend(currentOrigin.coords);
        bounds.extend(currentDest.location.coordinates);
        for (const coord of geometry.coordinates) {
          bounds.extend(coord as [number, number]);
        }

        const isDesktop =
          typeof window !== "undefined" && window.innerWidth > 860;
        const padding = isDesktop
          ? {
              top: 80,
              bottom: 80,
              left: 70,
              right: window.innerWidth >= 1200 ? 480 : 440,
            }
          : { top: 70, bottom: 260, left: 40, right: 40 };

        isMapAnimatingRef.current = true;
        map.fitBounds(bounds, {
          padding,
          maxZoom: 16,
          duration: 950,
          essential: true,
        });
        setTimeout(() => {
          isMapAnimatingRef.current = false;
        }, 1050);
      }
    },
    [mapRef, ensureRouteLayers, isMapAnimatingRef],
  );

  // Oblicza trasę przez Mapbox Directions API v5 dla podanego punktu startowego, celu i profilu
  const calculateRoute = useCallback(
    async (
      targetOrigin: RouteOrigin,
      targetDest: Place,
      requestedProfile: RouteProfile,
      fitCamera = true,
    ) => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
      if (!token) {
        setStatus("error");
        setErrorMessage(
          "Mapbox-Token fehlt. Die Routenberechnung ist derzeit nicht verfügbar.",
        );
        return;
      }

      const straightDist = distanceInMeters(
        targetOrigin.coords,
        targetDest.location.coordinates,
      );

      // Sprawdź, czy punkt startowy i cel nie są w tym samym miejscu (< 20 m)
      if (straightDist < 20) {
        clearMapRouteGraphics();
        setRouteResult(null);
        setStatus("error");
        setErrorMessage(
          "Startpunkt und Ziel liegen unmittelbar nebeneinander (unter 20 m). Bitte wählen Sie einen anderen Startpunkt.",
        );
        return;
      }

      // Sprawdź, czy dystans nie przekracza 120 km dla tras pieszych / rowerowych
      let effectiveProfile = requestedProfile;
      if (
        straightDist > MAX_ACTIVE_MOBILITY_DISTANCE_M &&
        (requestedProfile === "walking" || requestedProfile === "cycling")
      ) {
        effectiveProfile = "driving";
        setProfile("driving");
        setInfoNotice(
          `Ihr gewählter Startpunkt („${targetOrigin.label}“) ist ca. ${formatDistance(straightDist)} vom Ziel entfernt. Fuß- und Fahrradrouten sind nur bis 120 km verfügbar — es wird daher automatisch die Auto-Route angezeigt. Tipp: Wählen Sie einen Ort oder Pin in der Region als Startpunkt, um Fuß- oder Radwege vor Ort zu planen.`,
        );
      } else {
        setInfoNotice(null);
      }

      const cacheKey = buildCacheKey(
        effectiveProfile,
        targetOrigin.coords,
        targetDest.location.coordinates,
      );
      const cached = directionsCache.get(cacheKey);
      if (cached) {
        setRouteResult(cached);
        setStatus("ready");
        setErrorMessage(null);
        renderRouteOnMap(targetOrigin, targetDest, cached.geometry, fitCamera);
        return;
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setStatus("loading-route");
      setErrorMessage(null);

      const coordsParam = `${targetOrigin.coords[0]},${targetOrigin.coords[1]};${targetDest.location.coordinates[0]},${targetDest.location.coordinates[1]}`;
      const url =
        `https://api.mapbox.com/directions/v5/mapbox/${effectiveProfile}/${coordsParam}` +
        `?geometries=geojson` +
        `&overview=full` +
        `&steps=true` +
        `&language=de` +
        `&access_token=${token}`;

      try {
        const res = await fetch(url, { signal: controller.signal });
        const data = (await res.json()) as {
          code?: string;
          message?: string;
          routes?: {
            distance: number;
            duration: number;
            geometry: LineString;
            legs?: {
              steps?: {
                distance: number;
                duration: number;
                maneuver?: { instruction?: string };
              }[];
            }[];
          }[];
        };

        if (controller.signal.aborted) return;

        if (!res.ok || data.code !== "Ok" || !data.routes?.length) {
          clearMapRouteGraphics();
          setRouteResult(null);
          setStatus("error");
          setErrorMessage(
            "Zwischen diesem Startpunkt und dem Ziel konnte leider keine Route gefunden werden. Bitte wählen Sie einen Startpunkt in der Nähe oder einen anderen Verkehrsträger.",
          );
          return;
        }

        const primaryRoute = data.routes[0];
        const rawSteps = primaryRoute.legs?.[0]?.steps ?? [];
        const steps: RouteStep[] = rawSteps
          .map((s) => ({
            instruction: s.maneuver?.instruction?.trim() ?? "",
            distanceMeters: Math.round(s.distance ?? 0),
            durationSeconds: Math.round(s.duration ?? 0),
          }))
          .filter((s) => Boolean(s.instruction));

        const result: RouteResult = {
          profile: effectiveProfile,
          distanceMeters: Math.round(primaryRoute.distance),
          durationSeconds: Math.round(primaryRoute.duration),
          geometry: primaryRoute.geometry,
          steps,
        };

        directionsCache.set(cacheKey, result);
        setRouteResult(result);
        setStatus("ready");
        setErrorMessage(null);
        renderRouteOnMap(targetOrigin, targetDest, result.geometry, fitCamera);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        clearMapRouteGraphics();
        setRouteResult(null);
        setStatus("error");
        setErrorMessage(
          "Netzwerkfehler bei der Routenberechnung. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.",
        );
      }
    },
    [clearMapRouteGraphics, renderRouteOnMap],
  );

  // Zmiana kursora mapy w trybie wybierania punktu na mapie
  useEffect(() => {
    const isPicking = status === "picking-on-map";
    isPickingOnMapRef.current = isPicking;

    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    if (isPicking) {
      canvas.style.cursor = "crosshair";
    } else if (canvas.style.cursor === "crosshair") {
      canvas.style.cursor = "";
    }
  }, [status, mapRef]);

  // Wywoływane przy zmianie docelowego pinu (np. kliknięcie innego pinu na mapie):
  // jeśli planer był otwarty i miał wybrany punkt startowy, automatycznie przelicza trasę do nowego celu
  const handleDestinationChange = useCallback(
    (nextDest: Place | null) => {
      destinationRef.current = nextDest;

      if (!nextDest) {
        abortControllerRef.current?.abort();
        clearMapRouteGraphics();
        setIsPlannerOpen(false);
        setStatus("idle");
        setRouteResult(null);
        setErrorMessage(null);
        setInfoNotice(null);
        return;
      }

      if (isPlannerOpen && origin) {
        if (origin.placeId !== undefined && origin.placeId === nextDest.id) {
          clearMapRouteGraphics();
          setOrigin(null);
          setRouteResult(null);
          setStatus("idle");
          setInfoNotice(
            "Sie haben Ihren bisherigen Startpunkt als neues Ziel ausgewählt. Bitte wählen Sie einen neuen Startpunkt.",
          );
          return;
        }
        calculateRoute(origin, nextDest, profile, true);
      }
    },
    [isPlannerOpen, origin, profile, clearMapRouteGraphics, calculateRoute],
  );

  // Wybór aktualnej lokalizacji GPS jako punktu startowego
  const selectGpsOrigin = useCallback(() => {
    if (!destinationRef.current) return;

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("error");
      setErrorMessage(
        "Ihr Gerät oder Browser unterstützt keine GPS-Ortung. Bitte wählen Sie stattdessen unten einen anderen Ort/Pin oder tippen Sie auf die Karte.",
      );
      return;
    }

    setStatus("locating-gps");
    setErrorMessage(null);
    setInfoNotice(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dest = destinationRef.current;
        if (!dest) return;
        const nextOrigin: RouteOrigin = {
          type: "gps",
          label: "Mein GPS-Standort",
          sublabel: `${pos.coords.latitude.toFixed(4)}° N, ${pos.coords.longitude.toFixed(4)}° E`,
          coords: [pos.coords.longitude, pos.coords.latitude],
        };
        setOrigin(nextOrigin);
        calculateRoute(nextOrigin, dest, profile, true);
      },
      (err) => {
        setStatus("error");
        if (err.code === 1) {
          setErrorMessage(
            "Standortzugriff verweigert: Ihr Browser hat die GPS-Abfrage blockiert. Bitte erlauben Sie den Standortzugriff über das Symbol links in der Browser-Adressleiste — oder wählen Sie unten einfach einen anderen Ort/Pin bzw. einen Punkt auf der Karte als Startpunkt.",
          );
        } else if (err.code === 3) {
          setErrorMessage(
            "Zeitüberschreitung bei der GPS-Ortung. Bitte versuchen Sie es erneut oder wählen Sie einen anderen Ort/Pin bzw. einen Punkt auf der Karte als Startpunkt.",
          );
        } else {
          setErrorMessage(
            "Ihr GPS-Standort konnte leider nicht ermittelt werden. Bitte wählen Sie unten einen Ort/Pin über die Suche oder tippen Sie Ihren Startpunkt direkt auf der Karte an.",
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    );
  }, [calculateRoute, profile]);

  // Wybór innego pinu lub miejsca z wyszukiwarki jako punktu startowego
  const selectCustomOrigin = useCallback(
    (nextOrigin: RouteOrigin) => {
      const dest = destinationRef.current;
      if (!dest) return;
      setOrigin(nextOrigin);
      setErrorMessage(null);
      calculateRoute(nextOrigin, dest, profile, true);
    },
    [calculateRoute, profile],
  );

  // Aktywacja trybu wskazania punktu startowego kliknięciem na mapie
  const startPickingOnMap = useCallback(() => {
    abortControllerRef.current?.abort();
    setErrorMessage(null);
    setInfoNotice(null);
    setStatus("picking-on-map");
  }, []);

  const cancelPickingOnMap = useCallback(() => {
    setStatus(routeResult ? "ready" : "idle");
  }, [routeResult]);

  // Wywoływane z useMapboxLayers, gdy użytkownik kliknie na mapę (lub na inny pin) w trybie picking-on-map
  const handleMapClickForOrigin = useCallback(
    (coords: [number, number], clickedPlace?: Place) => {
      const dest = destinationRef.current;
      if (!dest) return;

      const nextOrigin: RouteOrigin = clickedPlace
        ? {
            type: "pin",
            label: clickedPlace.Name,
            sublabel: [clickedPlace.Stadt, clickedPlace.Adresse]
              .filter(Boolean)
              .join(", "),
            coords: clickedPlace.location.coordinates,
            placeId: clickedPlace.id,
          }
        : {
            type: "map-click",
            label: "Gewählter Punkt auf der Karte",
            sublabel: `${coords[1].toFixed(4)}° N, ${coords[0].toFixed(4)}° E`,
            coords,
          };

      setOrigin(nextOrigin);
      calculateRoute(nextOrigin, dest, profile, true);
    },
    [calculateRoute, profile],
  );

  // Zmiana środka transportu (Zu Fuß / Fahrrad / Auto)
  const changeProfile = useCallback(
    (nextProfile: RouteProfile) => {
      const dest = destinationRef.current;
      if (origin && dest) {
        const straightDist = distanceInMeters(
          origin.coords,
          dest.location.coordinates,
        );
        if (
          straightDist > MAX_ACTIVE_MOBILITY_DISTANCE_M &&
          (nextProfile === "walking" || nextProfile === "cycling")
        ) {
          setInfoNotice(
            `Fuß- und Fahrradrouten sind nur bis 120 km verfügbar. Ihr aktueller Startpunkt („${origin.label}“) ist ca. ${formatDistance(straightDist)} entfernt. Bitte wählen Sie oben einen Startpunkt in der Region (z. B. einen anderen Pin oder per Klick auf die Karte), um Fuß- oder Radwege zu berechnen.`,
          );
          return;
        }
      }

      setProfile(nextProfile);
      setInfoNotice(null);
      if (origin && dest) {
        calculateRoute(origin, dest, nextProfile, false);
      }
    },
    [origin, calculateRoute],
  );

  // Otwarcie planera w panelu
  const openPlanner = useCallback(() => {
    setIsPlannerOpen(true);
  }, []);

  // Zamknięcie planera i wyczyszczenie trasy z mapy
  const closeAndClearRoute = useCallback(() => {
    abortControllerRef.current?.abort();
    clearMapRouteGraphics();
    setIsPlannerOpen(false);
    setOrigin(null);
    setRouteResult(null);
    setStatus("idle");
    setErrorMessage(null);
    setInfoNotice(null);
  }, [clearMapRouteGraphics]);

  // Dopasowanie kamery do całej wyznaczonej trasy na żądanie użytkownika
  const fitRouteBounds = useCallback(() => {
    if (!origin || !destinationRef.current || !routeResult) return;
    renderRouteOnMap(
      origin,
      destinationRef.current,
      routeResult.geometry,
      true,
    );
  }, [origin, routeResult, renderRouteOnMap]);

  const straightLineDistanceMeters =
    origin && destination
      ? distanceInMeters(origin.coords, destination.location.coordinates)
      : null;

  const isOriginFarForActiveMobility =
    straightLineDistanceMeters !== null &&
    straightLineDistanceMeters > MAX_ACTIVE_MOBILITY_DISTANCE_M;

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (originMarkerRef.current) {
        originMarkerRef.current.remove();
        originMarkerRef.current = null;
      }
    };
  }, []);

  return {
    isPlannerOpen,
    profile,
    origin,
    status,
    errorMessage,
    infoNotice,
    routeResult,
    straightLineDistanceMeters,
    isOriginFarForActiveMobility,
    isPickingOnMapRef,
    openPlanner,
    closeAndClearRoute,
    changeProfile,
    selectGpsOrigin,
    selectCustomOrigin,
    startPickingOnMap,
    cancelPickingOnMap,
    handleMapClickForOrigin,
    handleDestinationChange,
    fitRouteBounds,
  };
}
