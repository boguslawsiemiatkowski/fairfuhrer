"use client";

// components/PlaceRail.tsx
//
// Waagerecht scrollbares Kartenband wie im Liste-Tab der App, mit denselben
// Maßen: Lücke 12px, 44px der nächsten Karte bleiben sichtbar, Karte maximal
// 420px breit, Höhe 1,1 × Breite (begrenzt auf 38 % der Fensterhöhe).
//
// Für den Browser ergänzt, weil es dort kein Wischen gibt:
//   · Ziehen mit der Maus (Desktop-Mäuse scrollen nicht waagerecht)
//   · Pfeiltasten links/rechts
//   · Pfeil-Buttons, die an den Enden verschwinden
import { useCallback, useEffect, useRef, useState } from "react";
import type { Place } from "@/types";
import PinCard from "./PinCard";
import styles from "./PlaceRail.module.css";

interface PlaceRailProps {
  places: Place[];
  /** Vorlesbarer Name des Bandes, z. B. „Orte in Lindau“. */
  label: string;
  /**
   * Ändert sich dieser Wert, springt das Band an den Anfang zurück. Nötig,
   * weil der Nutzer sonst nach einem Filterwechsel mitten in der neuen Liste
   * stünde — er hatte zehn Karten weitergeblättert und sah dann die zehnte
   * Karte der neuen Auswahl statt der ersten.
   */
  resetKey?: string;
}

/** Maße aus app/(tabs)/index.tsx der App. */
const CARD_GAP = 12;
const CARD_PEEK = 44;
const MAX_CARD_WIDTH = 420;

/** Ab welcher Mausbewegung ein Ziehen als Scrollen gilt (statt als Klick). */
const DRAG_THRESHOLD = 6;

export default function PlaceRail({ places, label, resetKey }: PlaceRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [dragging, setDragging] = useState(false);

  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: 0 });

  // Die Kartenmaße stehen im CSS (clamp + aspect-ratio), nicht hier. Vorher
  // starteten sie mit festen 320×400 und wurden erst nach dem Mounten aus
  // window.innerWidth neu berechnet — deshalb erschienen die Kacheln zuerst
  // schmal und sprangen dann auf ihre endgültige Breite. Im CSS stimmt die
  // Größe schon im ersten Bild.

  const updateEdges = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateEdges();
  }, [updateEdges, places.length]);

  // Nach einem Filterwechsel zurück zum Anfang. `behavior: "instant"`, damit
  // es wie ein neues Ergebnis wirkt und nicht wie ein Zurückscrollen.
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    el.scrollTo({ left: 0, behavior: "instant" });
    updateEdges();
  }, [resetKey, updateEdges]);

  const scrollByCards = useCallback((direction: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    // Kartenbreite aus dem DOM lesen, statt sie zu berechnen — so bleibt das
    // Blättern richtig, egal was das CSS gerade ergibt.
    const first = el.firstElementChild as HTMLElement | null;
    const step = (first?.offsetWidth ?? 300) + CARD_GAP;
    const cards = Math.max(1, Math.floor(el.clientWidth / step));
    el.scrollBy({ left: direction * step * cards, behavior: "smooth" });
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Nur Maus: Touch und Stift scrollen von sich aus.
    if (e.pointerType !== "mouse") return;
    const el = railRef.current;
    if (!el) return;
    drag.current = {
      active: true,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      moved: 0,
    };
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = railRef.current;
      if (!el || !drag.current.active) return;
      const delta = e.clientX - drag.current.startX;
      drag.current.moved = Math.abs(delta);
      if (drag.current.moved > DRAG_THRESHOLD) {
        // Erst ab der Schwelle als Ziehen behandeln, sonst würde jeder Klick
        // auf eine Karte den Link blockieren.
        if (!dragging) setDragging(true);
        el.scrollLeft = drag.current.startScroll - delta;
      }
    },
    [dragging],
  );

  const endDrag = useCallback(() => {
    if (!drag.current.active) return;
    drag.current.active = false;
    setDragging(false);
    updateEdges();
  }, [updateEdges]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollByCards(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollByCards(-1);
      }
    },
    [scrollByCards],
  );

  if (places.length === 0) return null;

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowLeft} ${atStart ? styles.arrowHidden : ""}`}
        onClick={() => scrollByCards(-1)}
        aria-label="Nach links blättern"
        tabIndex={atStart ? -1 : 0}
      >
        <span aria-hidden="true">‹</span>
      </button>

      <div
        ref={railRef}
        className={`${styles.rail} ${dragging ? styles.dragging : ""}`}
        onScroll={updateEdges}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onKeyDown={onKeyDown}
        role="group"
        aria-label={label}
        tabIndex={0}
      >
        {places.map((place) => (
          <div key={place.id} className={styles.item}>
            <PinCard place={place} />
          </div>
        ))}
      </div>

      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowRight} ${atEnd ? styles.arrowHidden : ""}`}
        onClick={() => scrollByCards(1)}
        aria-label="Nach rechts blättern"
        tabIndex={atEnd ? -1 : 0}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
