// components/Lightbox.tsx
//
// Galerie mit Vollbild-Ansicht. Zwei Dinge unterscheiden sie von der alten
// FullscreenGallery:
//
// 1. Alle Bilder stehen gleichzeitig im DOM, nebeneinander in einem
//    horizontalen Scroll-Container mit `scroll-snap-type: x mandatory`.
//    Das Blättern ist damit echtes Browser-Scrolling — derselbe Mechanismus,
//    der PlaceRail auf /liste flüssig macht. Wischen auf dem Handy kostet
//    keine Zeile JavaScript und behält den System-Impuls.
//
// 2. Jeder Slide hat seine Größe von Anfang an (100dvw × 100dvh, `contain`
//    am <img> selbst). Die alte Galerie legte ein `<Image fill>` in einen
//    Container ohne ausgerechnete Höhe — daher der Balken am oberen Rand und
//    der Sprung, sobald das Layout stand.
//
// Das Öffnen animiert `@starting-style` in CSS, nicht JS.
"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Lightbox.module.css";

type LightboxProps = {
  images: string[];
  /** Für die Alt-Texte: „<name> — Bild 2 von 5". */
  name: string;
  /** Welches Bild beim Öffnen sichtbar ist; null heißt geschlossen. */
  openAt: number | null;
  onCloseAction: () => void;
};

export default function Lightbox({
  images,
  name,
  openAt,
  onCloseAction,
}: LightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(openAt ?? 0);

  const isOpen = openAt !== null;

  // showModal() statt eines eigenen Overlays: der Browser übernimmt
  // Fokus-Falle, Escape und ::backdrop. Das <dialog> bleibt gemountet,
  // damit die Schließ-Animation laufen kann.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      setCurrent(openAt);
      // Ohne `instant` würde der Browser vom ersten Slide zum Ziel
      // scrollen — sichtbar als Durchblättern beim Öffnen.
      trackRef.current?.scrollTo({
        left: trackRef.current.clientWidth * openAt,
        behavior: "instant",
      });
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen, openAt]);

  // Escape und der Klick auf ::backdrop lösen `cancel`/`close` am <dialog>
  // aus, nicht unseren Button — der Zustand oben muss mitkommen.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onCloseAction();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onCloseAction]);

  // Der Zähler „2 / 5" liest den Scroll-Zustand ab, statt ihn zu steuern.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !isOpen) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Number(
              (entry.target as HTMLElement).dataset.index ?? 0,
            );
            setCurrent(index);
          }
        }
      },
      { root: track, threshold: 0.6 },
    );

    for (const slide of track.children) observer.observe(slide);
    return () => observer.disconnect();
  }, [isOpen, images.length]);

  const goTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({
      left: track.clientWidth * index,
      behavior: "smooth",
    });
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowRight" && current < images.length - 1) {
        event.preventDefault();
        goTo(current + 1);
      } else if (event.key === "ArrowLeft" && current > 0) {
        event.preventDefault();
        goTo(current - 1);
      }
    },
    [current, goTo, images.length],
  );

  // Hintergrund-Scrollen sperren. <dialog> tut das nicht von selbst.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (images.length === 0) return null;

  const multiple = images.length > 1;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label={`Bildergalerie ${name}`}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className={styles.close}
        onClick={onCloseAction}
        aria-label="Galerie schließen"
        title="Schließen (Esc)"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      {multiple && (
        <p className={styles.counter} aria-live="polite">
          {current + 1} / {images.length}
        </p>
      )}

      <div ref={trackRef} className={styles.track}>
        {images.map((url, index) => (
          <div key={url} className={styles.slide} data-index={index}>
            <Image
              src={url}
              alt={`${name} — Bild ${index + 1} von ${images.length}`}
              fill
              className={styles.image}
              // Der Slide hat seitlich `clamp(0.75rem, 3vw, 3rem)` Abstand,
              // das Bild ist also schmaler als das Fenster. `94vw` trifft
              // das über alle Breiten hinreichend genau.
              sizes="94vw"
              // Das aktive Bild und seine Nachbarn vorab laden: wer wischt,
              // findet das nächste Bild schon da. Alle übrigen bleiben lazy.
              //
              // Kein `priority` daneben: next/image wirft, wenn `priority`
              // und `loading` zusammen gesetzt sind. Das fiel erst beim
              // Blättern auf, weil `priority` am festen `openAt` hing und
              // `loading` am wandernden `current` — sobald das zuerst
              // geöffnete Bild aus dem Fenster `<= 1` lief, widersprachen
              // sich beide. Das geöffnete Bild liegt ohnehin in diesem
              // Fenster und lädt damit `eager`.
              loading={Math.abs(index - current) <= 1 ? "eager" : "lazy"}
            />
          </div>
        ))}
      </div>

      {multiple && (
        <>
          <button
            type="button"
            className={`${styles.nav} ${styles.prev}`}
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            aria-label="Vorheriges Bild"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className={`${styles.nav} ${styles.next}`}
            onClick={() => goTo(current + 1)}
            disabled={current === images.length - 1}
            aria-label="Nächstes Bild"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </>
      )}
    </dialog>
  );
}
