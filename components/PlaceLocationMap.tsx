// components/PlaceLocationMap.tsx
//
// Kleine Karte am Fuß der Detailseite: sie zeigt nur, wo der Ort liegt.
// Keine Suche, keine Filter, keine anderen Pins — dafür ist /karte da.
//
// Die Karte baut sich erst auf, wenn sie in Sichtweite kommt
// (IntersectionObserver). Ein Mapbox-Kartenaufruf zählt bei jeder
// Initialisierung von GL JS, nicht beim Scrollen: so zahlt nur, wer sie
// wirklich zu sehen bekommt, statt jeder Seitenaufruf.
"use client";

import { useEffect, useRef, useState } from "react";
// Eigener Import: MapBoxMap bringt dieses Stylesheet mit, steht auf der
// Detailseite aber nicht zur Verfügung. Ohne es sitzen Bedienelemente und
// Quellenangabe falsch.
import "mapbox-gl/dist/mapbox-gl.css";
import styles from "./PlaceLocationMap.module.css";

type PlaceLocationMapProps = {
  /** [Längengrad, Breitengrad] — Reihenfolge wie in GeoJSON. */
  coordinates: [number, number];
  name: string;
  /** Farbe der Kategorie, damit die Markierung zur Seite passt. */
  color: string;
};

export default function PlaceLocationMap({
  coordinates,
  name,
  color,
}: PlaceLocationMapProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  // Steht schon beim ersten Rendern fest und gehört deshalb nicht in einen
  // Effekt: ohne Zugangsschlüssel gibt es keine Karte.
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Erst beobachten, dann laden.
  useEffect(() => {
    const holder = holderRef.current;
    if (!holder || visible || !token) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // Etwas vor der Kante starten, damit die Karte fertig ist, wenn sie
      // tatsächlich im Blick liegt.
      { rootMargin: "200px" },
    );

    observer.observe(holder);
    return () => observer.disconnect();
  }, [visible, token]);

  useEffect(() => {
    if (!visible || mapRef.current || !token) return;

    let cancelled = false;

    // Mapbox GL erst hier laden: sonst läge die Bibliothek im Bundle jeder
    // Detailseite, auch wenn niemand bis zur Karte scrollt.
    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (cancelled || !holderRef.current) return;

        mapboxgl.accessToken = token;

        const map = new mapboxgl.Map({
          container: holderRef.current,
          // Derselbe Stil wie auf /karte, damit beide Karten gleich aussehen.
          style: "mapbox://styles/mapbox/streets-v12",
          center: coordinates,
          // Weiter weg als zuvor (13,5): so ist zu erkennen, wo der Ort im
          // Verhältnis zur Umgebung liegt, nicht nur die Straße davor.
          zoom: 11.5,
          // Nur ansehen, nicht erkunden: Drehen und Neigen bleiben aus,
          // Verschieben und Zoomen sind erlaubt.
          pitchWithRotate: false,
          dragRotate: false,
          attributionControl: true,
        });

        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        map.scrollZoom.disable(); // sonst fängt die Karte das Seiten-Scrollen ab

        // Deutsche Beschriftung, wie auf /karte: in jeder Textebene das Feld
        // auf `name_de` umstellen. Muss nach `load` geschehen, vorher sind
        // die Ebenen des Stils noch nicht da.
        map.on("load", () => {
          try {
            for (const layer of map.getStyle()?.layers ?? []) {
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
                  // Einzelne Ebenen lassen sich nicht umstellen — die
                  // übrigen sollen deshalb nicht ausfallen.
                }
              }
            }
          } catch (error) {
            console.error("Deutsche Beschriftung fehlgeschlagen:", error);
          }
        });

        new mapboxgl.Marker({ color }).setLngLat(coordinates).addTo(map);

        mapRef.current = map;
      } catch (error) {
        console.error("Karte konnte nicht geladen werden:", error);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, coordinates, color, token]);

  // Beim Verlassen der Seite abräumen, sonst bleiben WebGL-Kontexte liegen.
  useEffect(() => {
    return () => {
      const map = mapRef.current as { remove?: () => void } | null;
      map?.remove?.();
      mapRef.current = null;
    };
  }, []);

  if (failed || !token) return null;

  return (
    <div
      ref={holderRef}
      className={styles.map}
      role="img"
      aria-label={`Karte mit der Lage von ${name}`}
    />
  );
}
