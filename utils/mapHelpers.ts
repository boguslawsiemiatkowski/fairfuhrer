import mapboxgl from "mapbox-gl";
import type { Place } from "../types";
import { getCategoryIconPaths, DEFAULT_ICON_PATHS } from "../lib/categoryIcons";

export const PIN_W = 40;
export const PIN_H = 56;

export function isValidMapboxToken(): boolean {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  return Boolean(token && token.startsWith("pk."));
}

export function placesToGeoJSON(places: Place[]) {
  return {
    type: "FeatureCollection" as const,
    features: places
      .filter((p) => p.location?.coordinates)
      .map((p) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: p.location.coordinates,
        },
        properties: {
          placeId: p.id,
          categoryColor: p.Kategorie[0]?.color || "#3388ff",
          categoryId: p.Kategorie[0]?.id ?? 0,
        },
      })),
  };
}

export function buildPinSVG(
  color: string,
  iconPaths: string,
  selected = false,
): string {
  const stroke = selected ? ` stroke="rgba(0,0,0,0.75)" stroke-width="2"` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_W}" height="${PIN_H}" viewBox="0 0 40 56">` +
    `<path d="M20,2 C10.611,2 3,9.611 3,19 C3,31 20,54 20,54 C20,54 37,31 37,19 C37,9.611 29.389,2 20,2 Z" fill="${color}"${stroke}/>` +
    `<circle cx="20" cy="19" r="11" fill="white"/>` +
    `<g transform="translate(12,11) scale(0.667)" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">` +
    iconPaths +
    `</g>` +
    `</svg>`
  );
}

export function loadImageFromSVG(
  map: mapboxgl.Map,
  imageId: string,
  svg: string,
  w: number,
  h: number,
  onDone: () => void,
): void {
  if (map.hasImage(imageId)) {
    onDone();
    return;
  }
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const img = new Image(w, h);
  img.onload = () => {
    if (!map.hasImage(imageId)) {
      map.addImage(imageId, img, { sdf: false });
    }
    URL.revokeObjectURL(url);
    onDone();
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    onDone();
  };
  img.src = url;
}

export function loadCategoryMarkerSDFs(
  map: mapboxgl.Map,
  categories: Array<{ id: number; color: string }>,
  onLoaded: () => void,
): void {
  const allCategories = [{ id: 0, color: "#3388ff" }, ...categories];
  let remaining = allCategories.length;

  const done = () => {
    remaining--;
    if (remaining === 0) onLoaded();
  };

  allCategories.forEach(({ id, color }) => {
    const paths = id === 0 ? DEFAULT_ICON_PATHS : getCategoryIconPaths(id);
    loadImageFromSVG(
      map,
      `pin-${id}`,
      buildPinSVG(color, paths),
      PIN_W,
      PIN_H,
      done,
    );
    remaining++;
    loadImageFromSVG(
      map,
      `pin-${id}-selected`,
      buildPinSVG(color, paths, true),
      PIN_W,
      PIN_H,
      done,
    );
  });
}

/**
 * Ustawia niemieckie etykiety warstw (`name_de`) oraz ukrywa oznaczenia numerów dróg (`shield` / `road-number`).
 */
export function applyGermanMapStyle(map: mapboxgl.Map): void {
  try {
    const layers = map.getStyle()?.layers;
    if (!layers) return;

    layers.forEach((layer) => {
      if (
        layer.type === "symbol" &&
        layer.layout &&
        "text-field" in layer.layout
      ) {
        try {
          map.setLayoutProperty(layer.id, "text-field", ["get", "name_de"]);
        } catch {
          // Ignoruj błędy dla warstw nieobsługujących zmiany text-field
        }
      }

      if (layer.id.includes("shield") || layer.id.includes("road-number")) {
        try {
          map.setLayoutProperty(layer.id, "visibility", "none");
        } catch {
          // Ignoruj błędy ukrywania tarcz drogowych
        }
      }
    });
  } catch (error) {
    console.warn("Could not customize map style layers:", error);
  }
}

/**
 * Inicjalizuje źródło GeoJSON z klastrowaniem oraz 4 warstwy pinów/klastrów w Mapbox GL.
 */
export function setupPlacesClusterLayers(
  map: mapboxgl.Map,
  initialPlaces: Place[],
): void {
  map.addSource("places-source", {
    type: "geojson",
    data: placesToGeoJSON(initialPlaces),
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  });

  // LAYER: klastry (circle) w palecie barw marki FairFührer (#2e7d32, #fc6c14, #18222f)
  map.addLayer({
    id: "places-clusters",
    type: "circle",
    source: "places-source",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": [
        "step",
        ["get", "point_count"],
        "#2e7d32",
        10,
        "#fc6c14",
        30,
        "#18222f",
      ],
      "circle-radius": ["step", ["get", "point_count"], 21, 10, 26, 30, 32],
      "circle-stroke-width": 3,
      "circle-stroke-color": "#ffffff",
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
      "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
      "text-size": 13,
    },
    paint: {
      "text-color": "#ffffff",
    },
  });

  // LAYER: pojedynczy pin per kategoria
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
}
