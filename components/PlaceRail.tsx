"use client";

// components/PlaceRail.tsx
//
// Waagerecht scrollbares Band mit Ortskarten — das Muster aus der App, für den
// Browser erweitert:
//   · Wischen auf Touch-Geräten (wie in der App)
//   · Ziehen mit der Maus, weil Desktop-Mäuse nicht waagerecht scrollen
//   · Pfeiltasten links/rechts und Tab-Navigation
//   · Pfeil-Buttons, die sich an den Enden ausblenden
//
// Die Karten sind breiter als hoch, damit möglichst viele gleichzeitig zu
// sehen sind.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Place } from "@/types";
import {
  cityToSegment,
  htmlToPlainText,
  mainImageUrl,
  truncateAtWord,
} from "@/lib/orte-shared";
import styles from "./PlaceRail.module.css";

interface PlaceRailProps {
  places: Place[];
  /** Vorlesbarer Name des Bandes, z. B. „Orte in Lindau“. */
  label: string;
}

/** Ab welcher Mausbewegung ein Ziehen als Scrollen gilt (statt als Klick). */
const DRAG_THRESHOLD = 6;

export default function PlaceRail({ places, label }: PlaceRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Ziehen mit der Maus. In Refs, damit die Handler stabil bleiben.
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: 0 });

  const updateEdges = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateEdges();
    const el = railRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateEdges, places.length]);

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    // Etwas weniger als die volle Breite, damit die angrenzende Karte
    // sichtbar bleibt und klar ist, dass es weitergeht.
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Nur Maus: Touch und Stift scrollen schon von sich aus.
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

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
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
  }, [dragging]);

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
        scrollByPage(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollByPage(-1);
      }
    },
    [scrollByPage],
  );

  if (places.length === 0) return null;

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowLeft} ${atStart ? styles.arrowHidden : ""}`}
        onClick={() => scrollByPage(-1)}
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
          <RailCard key={place.id} place={place} />
        ))}
      </div>

      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowRight} ${atEnd ? styles.arrowHidden : ""}`}
        onClick={() => scrollByPage(1)}
        aria-label="Nach rechts blättern"
        tabIndex={atEnd ? -1 : 0}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}

function RailCard({ place }: { place: Place }) {
  const segment = cityToSegment(place.Stadt);
  const href = segment && place.slug ? `/orte/${segment}/${place.slug}` : null;
  const imageUrl = mainImageUrl(place);
  const teaser = truncateAtWord(htmlToPlainText(place.Vollbeschreibung), 180);

  const body = (
    <>
      <div className={styles.image}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={place.Name}
            width={320}
            height={240}
            loading="lazy"
            sizes="(max-width: 700px) 40vw, 240px"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span className={styles.imageFallback} aria-hidden="true" />
        )}
      </div>

      <div className={styles.body}>
        {place.Kategorie.length > 0 && (
          <div className={styles.badges}>
            {place.Kategorie.map((cat) => (
              <span
                key={cat.id}
                className={styles.badge}
                style={{ backgroundColor: cat.color }}
              >
                {cat.name}
              </span>
            ))}
          </div>
        )}
        <h3 className={styles.title}>{place.Name}</h3>
        {place.Stadt && <p className={styles.city}>{place.Stadt}</p>}
        {teaser && <p className={styles.teaser}>{teaser}</p>}
        {(place.Audio || place.Audio_Datei) && (
          <p className={styles.audio}>
            <span aria-hidden="true">▶</span> Audioguide
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className={styles.card}>
      {href ? (
        <Link href={href} className={styles.link}>
          {body}
        </Link>
      ) : (
        <div className={styles.link}>{body}</div>
      )}
    </div>
  );
}
