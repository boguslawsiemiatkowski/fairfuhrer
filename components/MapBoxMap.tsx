"use client";

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
  lazy,
  Suspense,
  Activity,
} from "react";
import mapboxgl from "mapbox-gl";
// Explizit importiert, statt sich auf den globalen `GeoJSON`-Namespace zu
// verlassen: den zog bisher `@types/mapbox-gl` per
// `/// <reference types="geojson" />` herein. Das Paket ist überflüssig,
// seit mapbox-gl eigene Typen mitbringt.
import type { FeatureCollection, Point } from "geojson";
import DOMPurify from "dompurify";
import "mapbox-gl/dist/mapbox-gl.css";
import styles from "./MapBoxMap.module.css";
import MapSearch from "./MapSearch";
import type { Place, SightsLockModalContent } from "../types";
import { placesToGeoJSON, loadCategoryMarkerSDFs } from "../utils/mapHelpers";
import { generatePopupHTML } from "../utils/popupGenerator";
import { useGallery } from "../hooks/useGallery";
import { useGeolocation } from "../hooks/useGeolocation";

// LAZY LOADING komponentów
const PlaceInfoPanel = lazy(() => import("./PlaceInfoPanel"));
const FullscreenGallery = lazy(() => import("./FullscreenGallery"));

// Fallback-Texte, falls die Directus-Kollektion (noch) leer ist. Werden nur
// verwendet, wenn getSightsLockModalContent() null zurückgibt.
const SIGHTS_LOCK_FALLBACK = {
  title: "🔒 Nur in der App verfügbar",
  body: 'Das ist nur ein Vorgeschmack! Auf der Website siehst du {{ratio_percent}} % der Audiopins aus der Kategorie „Sehenswertes". Mit der kostenlosen Fairführer-App und optionalem FAIRFÜHRER+ hörst du alle Audioguides — plus Offline-Karten und die Möglichkeit, eigene Orte vorzuschlagen.',
  cta_headline: "Jetzt kostenlos laden:",
  app_store_label: "App Store",
  google_play_label: "Google Play",
  app_store_url: "https://apps.apple.com/de/app/fairf%C3%BChrer/id6778095803",
  google_play_url:
    "https://play.google.com/store/apps/details?id=com.fairfuehrer.app",
  sync_note:
    "Bereits gekauft? Die Web-Synchronisation deines mobilen Abos kommt bald.",
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Baut das HTML der Sperr-Blase, die beim Hover/Klick auf einen gesperrten
// Sehenswertes-Pin erscheint. Verwendet Texte aus Directus, fällt bei
// fehlenden Feldern auf SIGHTS_LOCK_FALLBACK zurück und ersetzt den
// {{ratio_percent}}-Platzhalter durch den aktuellen Wert aus sightsGating.ts.
function buildSightsLockPopupHtml(
  content: SightsLockModalContent | null,
  freePercent: number,
  cssModule: { readonly [k: string]: string },
): string {
  const c = content ?? SIGHTS_LOCK_FALLBACK;
  const percentSafe = String(Math.round(freePercent));
  const bodyWithPercent = c.body.replace(/\{\{\s*ratio_percent\s*\}\}/g, percentSafe);
  const syncBlock = c.sync_note
    ? `<p class="${cssModule.popupLockSync}">${escapeHtml(c.sync_note)}</p>`
    : "";

  const html = `<div class="${cssModule.modernPopup}">
    <p class="${cssModule.popupLockTitle}">${escapeHtml(c.title)}</p>
    <p class="${cssModule.popupLockBody}">${escapeHtml(bodyWithPercent)}</p>
    <p class="${cssModule.popupLockCta}">${escapeHtml(c.cta_headline)}</p>
    <div class="${cssModule.popupLockLinks}">
      <a class="${cssModule.popupLockBadge}" href="${escapeHtml(c.app_store_url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(c.app_store_label)}">
        <img class="${cssModule.popupLockBadgeImg}" src="/app-store-badge.svg" alt="${escapeHtml(c.app_store_label)}" width="119" height="40" />
      </a>
      <a class="${cssModule.popupLockBadge}" href="${escapeHtml(c.google_play_url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(c.google_play_label)}">
        <img class="${cssModule.popupLockBadgeImg}" src="/android-store-badge.svg" alt="${escapeHtml(c.google_play_label)}" width="239" height="71" />
      </a>
    </div>
    ${syncBlock}
  </div>`;

  return DOMPurify.sanitize(html, {
    ADD_ATTR: ["target", "rel"],
  });
}

interface MapBoxMapProps {
  places: Place[];
  disableGeolocation?: boolean;
  embedded?: boolean;
  /** Directus-Text für die Info-Blase über gesperrten Sehenswertes-Pins. */
  sightsLockContent?: SightsLockModalContent | null;
  /** Prozentsatz sichtbarer Sehenswertes-Pins für Free-Nutzer. */
  sightsFreePercent?: number;
}

// ========================================
// KOMPONENT
// ========================================

export default function MapBoxMap({
  places,
  disableGeolocation = false,
  embedded = false,
  sightsLockContent,
  sightsFreePercent = 50,
}: MapBoxMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userLocationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const lastFittedPlacesRef = useRef<string>("");

  // Kein Gating mehr im Web: Einzelnutzer sehen alle Audiopins. Die App wird
  // für sie kostenlos, mit freiwilligen Beiträgen statt FAIRFÜHRER+ (Absprache
  // mit Frank, Okt. 2026). Jeder Pin hat jetzt zudem eine eigene, von Google
  // indexierbare Seite unter /orte/[stadt]/[slug] — Inhalte zurückzuhalten
  // würde dem direkt widersprechen.
  //
  // Die Sperr-Popup-Maschinerie unten bleibt bewusst erhalten, nur ohne Daten:
  // Sollte das Modell wieder wechseln, genügt es, hier wieder IDs zu liefern.
  // Partner-Abos (PayPal) sind davon NICHT betroffen — die laufen über
  // profiles.premium_until und /konto/partner/premium.
  const lockedIds = useMemo<Set<number>>(() => new Set<number>(), []);

  // GL Layers refs (zastępują markersRef)
  const layersInitializedRef = useRef(false);
  const hoverPopupRef = useRef<mapboxgl.Popup | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Refy dla stabilnych closures w eventach Mapboxa
  const placesRef = useRef<Place[]>(places);
  const lockedIdsRef = useRef<Set<number>>(lockedIds);
  const popupDataMapRef = useRef<Map<number, string>>(new Map());
  // Directus-Content + %-Anteil für die Sperr-Popups (via ref, damit die
  // stabile Map-Callback sie nicht in Closure kapselt).
  const sightsLockContentRef = useRef<SightsLockModalContent | null>(
    sightsLockContent ?? null,
  );
  const sightsFreePercentRef = useRef<number>(sightsFreePercent);
  // Race condition prevention
  const closePanelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPanelOpenRef = useRef(false);
  const isMapAnimatingRef = useRef(false);
  const selectedPlaceIdRef = useRef<number | null>(null);
  const pinSizeAnimFrameRef = useRef<number | null>(null);

  // Panel state
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(false);

  // Gallery state
  const {
    selectedGalleryImage,
    currentImageIndex,
    setSelectedGalleryImage,
    setCurrentImageIndex,
    handleImageClick,
    handleNextImage,
    handlePrevImage,
    closeGalleryOnly,
  } = useGallery(selectedPlace);

  // Map state
  const [mapLoadingState, setMapLoadingState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  // Geolocation state
  const handleLocationFound = useCallback((location: [number, number]) => {
    if (mapRef.current) {
      isMapAnimatingRef.current = true;
      mapRef.current.easeTo({
        center: location,
        zoom: 14,
        duration: 1800,
        easing: (t) => 1 - Math.pow(1 - t, 3),
        essential: true,
      });
      setTimeout(() => {
        isMapAnimatingRef.current = false;
      }, 1900);
    }
  }, []);

  const {
    userLocation,
    setUserLocation,
    userLocationRequestedRef,
    getUserLocation,
  } = useGeolocation(handleLocationFound);

  // ========================================
  // BASIC UTILITIES
  // ========================================

  const isValidMapboxToken = () => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    return Boolean(token && token.startsWith("pk."));
  };

  // ========================================
  // CORE MAP FUNCTIONS
  // ========================================

  const animateToLocation = useCallback(
    (location: [number, number], zoom: number, duration = 1500) => {
      if (mapRef.current) {
        isMapAnimatingRef.current = true;
        mapRef.current.easeTo({
          center: location,
          zoom: zoom,
          duration: duration,
          easing: (t) => 1 - Math.pow(1 - t, 3),
          essential: true,
        });
        // Zdejmij flagę po zakończeniu animacji (z marginesem 100ms)
        setTimeout(() => {
          isMapAnimatingRef.current = false;
        }, duration + 100);
      }
    },
    [],
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
    [],
  );

  const addUserLocationMarker = useCallback(
    (map: mapboxgl.Map, location: [number, number]) => {
      try {
        if (userLocationMarkerRef.current) {
          userLocationMarkerRef.current.remove();
          userLocationMarkerRef.current = null;
        }

        if (!map || !map.loaded()) {
          console.warn("⚠️ Map not loaded, skipping marker");
          return;
        }

        if (!document.head.querySelector("#user-location-styles")) {
          const style = document.createElement("style");
          style.id = "user-location-styles";
          style.textContent = `
            .user-location-marker {
              position: relative;
              width: 20px;
              height: 20px;
              cursor: pointer;
            }
            .user-location-marker .marker-dot {
              position: absolute;
              top: 0;
              left: 0;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: #4285F4;
              border: 3px solid white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              z-index: 2;
            }
            .user-location-marker .marker-pulse {
              position: absolute;
              top: 50%;
              left: 50%;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: rgba(66, 133, 244, 0.4);
              transform: translate(-50%, -50%);
              animation: user-location-pulse 2s infinite;
              z-index: 1;
            }
            @keyframes user-location-pulse {
              0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
            }
          `;
          document.head.appendChild(style);
        }

        const userMarkerElement = document.createElement("div");
        userMarkerElement.className = "user-location-marker";
        userMarkerElement.innerHTML = `
          <div class="marker-dot"></div>
          <div class="marker-pulse"></div>
        `;

        const userPopupHTML = DOMPurify.sanitize(`
          <div>
            <h3>Ihre Position</h3>
            <p>Sie sind hier</p>
          </div>
        `);

        const popup = new mapboxgl.Popup({
          offset: [0, -15],
          closeButton: false,
          className: styles.popup,
        }).setHTML(userPopupHTML);

        const userMarker = new mapboxgl.Marker({ element: userMarkerElement })
          .setLngLat(location)
          .setPopup(popup)
          .addTo(map);

        userMarkerElement.addEventListener("mouseenter", () => {
          if (userMarker.getPopup()) userMarker.togglePopup();
        });

        userMarkerElement.addEventListener("mouseleave", () => {
          setTimeout(() => {
            if (userMarker.getPopup()?.isOpen()) userMarker.togglePopup();
          }, 300);
        });

        userLocationMarkerRef.current = userMarker;
      } catch (error) {
        console.error("❌ Błąd podczas dodawania markera użytkownika:", error);
      }
    },
    [],
  );

  // ========================================
  // PANEL FUNCTIONS
  // ========================================

  const openPanel = useCallback(
    (place: Place) => {
      // Anuluj aktywny timeout zamknięcia — zapobiega race condition
      // gdy nowa pinezka jest klikana zanim 600ms timeout z closePanel dobiegnie końca
      if (closePanelTimeoutRef.current) {
        clearTimeout(closePanelTimeoutRef.current);
        closePanelTimeoutRef.current = null;
      }

      setSelectedPlace(place);
      setIsPanelOpen(true);
      isPanelOpenRef.current = true;
      selectedPlaceIdRef.current = place.id;

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
    [animateToLocation, animatePinSize],
  );

  const closePanel = useCallback(() => {
    isPanelOpenRef.current = false;
    selectedPlaceIdRef.current = null;
    setIsPanelVisible(false);
    setSelectedGalleryImage(null);
    setCurrentImageIndex(0);

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

    // Zapisz timeout do refa — openPanel może go anulować jeśli nowa pinezka
    // zostanie kliknięta przed upływem 600ms (race condition fix)
    closePanelTimeoutRef.current = setTimeout(() => {
      closePanelTimeoutRef.current = null;
      setIsPanelOpen(false);
    }, 600);
  }, [animatePinSize, setSelectedGalleryImage, setCurrentImageIndex]);

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
          [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
          { padding: 60, duration: 800, ...(maxZoom !== undefined && { maxZoom }) },
        );
      } else {
        map.flyTo({ center: coords, zoom, duration: 800 });
      }
    },
    [],
  );



  // ========================================
  // POPUP DATA (pre-computed, używane w hover tooltip)
  // ========================================

  const popupDataMap = useMemo<Map<number, string>>(() => {
    const dataMap = new Map<number, string>();
    places.forEach((place) => {
      dataMap.set(place.id, generatePopupHTML(place));
    });
    return dataMap;
  }, [places]);

  // ========================================
  // MAP INITIALIZATION
  // ========================================

  const initializeMap = useCallback(() => {
    if (mapRef.current || !containerRef.current) return;
    if (layersInitializedRef.current) return;

    if (!isValidMapboxToken()) {
      setMapLoadingState("error");
      return;
    }

    try {
      setMapLoadingState("loading");
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

        // Ustaw język na niemiecki
        try {
          const layers = map.getStyle().layers;
          if (layers) {
            layers.forEach((layer) => {
              if (
                layer.type === "symbol" &&
                layer.layout &&
                "text-field" in layer.layout
              ) {
                try {
                  map.setLayoutProperty(layer.id, "text-field", [
                    "get",
                    "name_de",
                  ]);
                } catch {
                  // Ignoruj błędy dla konkretnych warstw
                }
              }
            });
          }
        } catch (error) {
          console.error("Error setting German language on map:", error);
        }

        // Ukryj oznaczenia dróg
        try {
          const layers = map.getStyle().layers;
          if (layers) {
            layers.forEach((layer) => {
              if (
                layer.id.includes("shield") ||
                layer.id.includes("road-number")
              ) {
                map.setLayoutProperty(layer.id, "visibility", "none");
              }
            });
          }
        } catch (error) {
          console.warn("Could not hide road shields:", error);
        }

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
            const { longitude, latitude } = e.coords;
            const location: [number, number] = [longitude, latitude];
            setUserLocation(location);
            setTimeout(() => {
              animateToLocation(location, 14, 1800);
            }, 150);
          });
        }

        // Załaduj piny dla każdej kategorii, następnie zainicjalizuj warstwy i eventy
        const categoryMap = new Map<number, string>();
        placesRef.current.forEach((p) =>
          p.Kategorie.forEach((cat) => categoryMap.set(cat.id, cat.color)),
        );
        const categories = Array.from(categoryMap.entries()).map(
          ([id, color]) => ({ id, color }),
        );
        loadCategoryMarkerSDFs(map, categories, () => {
          initializePlacesLayer(map);
          attachLayerEvents(map);
        });
      });

      map.on("error", (e) => {
        console.error("Błąd mapy:", e);
        setMapLoadingState("error");
      });

      mapRef.current = map;
    } catch (error) {
      console.error("Błąd inicjalizacji mapy:", error);
      setMapLoadingState("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Inicjalizuj tylko raz przy mount

  // ========================================
  // GL LAYERS: initializePlacesLayer
  // ========================================

  const initializePlacesLayer = useCallback(
    (map: mapboxgl.Map) => {
      if (layersInitializedRef.current) return;

      // SOURCE z klastrowaniem
      map.addSource("places-source", {
        type: "geojson",
        data: placesToGeoJSON(placesRef.current),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // LAYER: klastry (circle)
      map.addLayer({
        id: "places-clusters",
        type: "circle",
        source: "places-source",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#51bbd6",
            10,
            "#f1f075",
            30,
            "#f28cb1",
          ],
          "circle-radius": ["step", ["get", "point_count"], 20, 10, 30, 30, 40],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });

      // LAYER: liczba w klastrze (symbol)
      map.addLayer({
        id: "places-cluster-count",
        type: "symbol",
        source: "places-source",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#fff",
        },
      });

      // LAYER: kompletny pin per kategoria (białe tło + kolorowy stroke + ikona)
      map.addLayer({
        id: "places-unclustered",
        type: "symbol",
        source: "places-source",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": [
            "match",
            ["get", "categoryId"],
            1,
            "pin-1",
            2,
            "pin-2",
            3,
            "pin-3",
            5,
            "pin-5",
            8,
            "pin-8",
            "pin-0",
          ],
          "icon-size": 1,
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
        },
        paint: {},
      });

      // LAYER: wybrany pin — powiększony z obramowaniem, renderowany na wierzchu
      map.addLayer({
        id: "places-selected",
        type: "symbol",
        source: "places-source",
        filter: ["==", ["get", "placeId"], -1],
        layout: {
          "icon-image": [
            "match",
            ["get", "categoryId"],
            1,
            "pin-1-selected",
            2,
            "pin-2-selected",
            3,
            "pin-3-selected",
            5,
            "pin-5-selected",
            8,
            "pin-8-selected",
            "pin-0-selected",
          ],
          "icon-size": 1.45,
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
        },
        paint: {},
      });

      layersInitializedRef.current = true;

      // fitBounds przy pierwszym renderze
      updatePlacesData();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // Inicjalizuj tylko raz
  );

  // ========================================
  // GL LAYERS: updatePlacesData (zastępuje updateMarkers)
  // ========================================

  const updatePlacesData = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !layersInitializedRef.current) return;

    const source = map.getSource("places-source") as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (!source) return;

    // Używamy placesRef.current zamiast places z closure — bo ta funkcja
    // może być wywołana z initializePlacesLayer (stała closure bez dostępu do places).
    const currentPlaces = placesRef.current;

    source.setData(
      placesToGeoJSON(
        currentPlaces,
      ) as FeatureCollection<Point>,
    );

    // fitBounds tylko gdy zmienił się zestaw miejsc.
    const placesKey = currentPlaces
      .map((p) => p.id)
      .sort()
      .join(",");
    if (currentPlaces.length > 0 && placesKey !== lastFittedPlacesRef.current) {
      lastFittedPlacesRef.current = placesKey;

      const bounds = new mapboxgl.LngLatBounds();
      currentPlaces
        .filter((p) => p.location?.coordinates)
        .forEach((p) => bounds.extend(p.location.coordinates));
      if (userLocation) bounds.extend(userLocation);

      const padding =
        window.innerWidth > 768
          ? { top: 80, bottom: 80, left: 80, right: 80 }
          : { top: 50, bottom: 50, left: 20, right: 20 };

      map.fitBounds(bounds, { padding, duration: 1000 });
    }
  }, [userLocation]);

  // ========================================
  // GL LAYERS: attachLayerEvents
  // ========================================

  const attachLayerEvents = useCallback(
    (map: mapboxgl.Map) => {
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

        // Wyczyść debounce (jeśli kursor wrócił szybko)
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }

        // Zamknij poprzedni popup
        if (hoverPopupRef.current) {
          hoverPopupRef.current.remove();
          hoverPopupRef.current = null;
        }

        const geometry = feature.geometry as Point;
        const coords = geometry.coordinates as [number, number];

        const isLocked = lockedIdsRef.current.has(placeId);
        const html = isLocked
          ? buildSightsLockPopupHtml(
              sightsLockContentRef.current,
              sightsFreePercentRef.current,
              styles,
            )
          : popupDataMapRef.current.get(placeId);

        if (!html) return;

        hoverPopupRef.current = new mapboxgl.Popup({
          offset: [0, -36],
          closeButton: false,
          className: styles.popup,
          maxWidth: "320px",
        })
          .setLngLat(coords)
          .setHTML(html)
          .addTo(map);

        // Hover-Hold: Wenn der Cursor auf das Popup wandert, wird der
        // Schließ-Timer abgebrochen — so kann der Nutzer die Store-Links
        // anklicken, ohne dass die Blase verschwindet. Sobald er das
        // Popup wieder verlässt, startet der Timer erneut.
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

      // ---- KLIK na unclustered pin → locked = popup CTA, odblokowany = panel ----
      map.on("click", "places-unclustered", (e) => {
        if (!e.features?.length) return;
        const placeId = e.features[0].properties?.placeId as number;
        e.originalEvent.stopPropagation();

        // Bei gesperrten Pins: Hover-Popup NICHT schließen — der Nutzer soll
        // die Store-Links (im Popup) anklicken können. Nur bei
        // freigeschalteten Pins schließen wir und öffnen das Info-Panel.
        if (lockedIdsRef.current.has(placeId)) {
          // Cancel eventuellen Schließ-Timer, damit der Klick das Popup nicht
          // sofort danach entfernt.
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
          }
          return;
        }

        if (hoverPopupRef.current) {
          hoverPopupRef.current.remove();
          hoverPopupRef.current = null;
        }

        const place = placesRef.current.find((p) => p.id === placeId);
        if (!place) return;
        openPanel(place);
      });

      // ---- KLIK na klaster → zoom in ----
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
        // Ignoruj kliknięcia podczas programowej animacji mapy
        // (easeTo emituje synthetic click events które zamknęłyby świeżo otwarty panel)
        if (isMapAnimatingRef.current) return;
        // Ignoruj jeśli panel i tak nie jest otwarty
        if (!isPanelOpenRef.current) return;

        const features = map.queryRenderedFeatures(e.point, {
          layers: ["places-unclustered", "places-clusters"],
        });
        if (!features.length) {
          closePanel();
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // Stabilne — używa ref zamiast closures na places/openPanel/closePanel
  );

  // ========================================
  // EFFECTS
  // ========================================

  // Synchronizuj placesRef, lockedIdsRef i popupDataMapRef z aktualnymi wartościami
  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  useEffect(() => {
    lockedIdsRef.current = lockedIds;
  }, [lockedIds]);

  useEffect(() => {
    popupDataMapRef.current = popupDataMap;
  }, [popupDataMap]);

  useEffect(() => {
    sightsLockContentRef.current = sightsLockContent ?? null;
  }, [sightsLockContent]);

  useEffect(() => {
    sightsFreePercentRef.current = sightsFreePercent;
  }, [sightsFreePercent]);

  // Request user location po załadowaniu mapy
  useEffect(() => {
    if (disableGeolocation) return;
    if (mapLoadingState === "success" && !userLocationRequestedRef.current) {
      const timer = setTimeout(() => {
        getUserLocation();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [mapLoadingState, getUserLocation, disableGeolocation, userLocationRequestedRef]);

  // Inicjalizacja mapy
  useEffect(() => {
    initializeMap();

    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (closePanelTimeoutRef.current)
        clearTimeout(closePanelTimeoutRef.current);
      if (hoverPopupRef.current) {
        hoverPopupRef.current.remove();
        hoverPopupRef.current = null;
      }
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      layersInitializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Inicjalizuj tylko raz przy mount, cleanup przy unmount

  // Aktualizuj dane GL source gdy places się zmienią (np. filtry kategorii)
  useEffect(() => {
    if (!mapRef.current || !layersInitializedRef.current) return;
    if (mapRef.current.isStyleLoaded()) updatePlacesData();
  }, [places, updatePlacesData]);

  // Dodaj user location marker po każdej zmianie lokalizacji
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;

    const map = mapRef.current;
    if (map.isStyleLoaded()) {
      addUserLocationMarker(map, userLocation);
    } else {
      map.once("idle", () => {
        addUserLocationMarker(map, userLocation);
      });
    }
  }, [userLocation, addUserLocationMarker]);

  // ========================================
  // RENDER
  // ========================================

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
              onClick={initializeMap}
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
            // Karte auf den Pin zoomen UND Panel öffnen.
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
            onImageClickAction={handleImageClick}
          />
        </Suspense>
      </Activity>

      {selectedGalleryImage &&
        (selectedPlace?.Galerie?.length ||
          selectedPlace?.Galerie_Bilder?.length) && (
          <Suspense
            fallback={
              <div className={styles.loadingOverlayGallery}>
                <div className={styles.loadingSpinner}>
                  Galerie wird geladen...
                </div>
              </div>
            }
          >
            <FullscreenGallery
              place={selectedPlace}
              currentIndex={currentImageIndex}
              isOpen={!!selectedGalleryImage}
              onCloseAction={closeGalleryOnly}
              onNextAction={handleNextImage}
              onPrevAction={handlePrevImage}
            />
          </Suspense>
        )}
    </div>
  );
}
