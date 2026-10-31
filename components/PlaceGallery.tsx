// components/PlaceGallery.tsx
//
// Die Vorschau-Kacheln samt Vollbild-Ansicht. Die Detailseite bleibt eine
// Server-Komponente; nur dieser Teil braucht Zustand.
"use client";

import Image from "next/image";
import { useState } from "react";
import Lightbox from "./Lightbox";
import styles from "./PlaceGallery.module.css";

type PlaceGalleryProps = {
  images: string[];
  name: string;
  /**
   * `page` für die Detailseite (breite Spalte), `panel` für das schmale
   * Kartenpanel. Unterscheidet nur die Kachelgröße — die Vollbild-Ansicht
   * ist in beiden Fällen dieselbe.
   */
  variant?: "page" | "panel";
};

export default function PlaceGallery({
  images,
  name,
  variant = "page",
}: PlaceGalleryProps) {
  const [openAt, setOpenAt] = useState<number | null>(null);

  if (images.length === 0) return null;

  return (
    <>
      <div className={`${styles.grid} ${styles[variant]}`}>
        {images.map((url, index) => (
          <button
            key={url}
            type="button"
            className={styles.tile}
            onClick={() => setOpenAt(index)}
            aria-label={`Bild ${index + 1} von ${images.length} vergrößern`}
          >
            {/* `fill`, weil die Kachel das Seitenverhältnis vorgibt —
              * nicht das Bild. */}
            <Image
              src={url}
              alt={`${name} — Bild ${index + 1}`}
              fill
              loading="lazy"
              sizes={
                variant === "panel"
                  ? "150px"
                  : "(max-width: 900px) 45vw, 260px"
              }
              className={styles.image}
            />
          </button>
        ))}
      </div>

      <Lightbox
        images={images}
        name={name}
        openAt={openAt}
        onCloseAction={() => setOpenAt(null)}
      />
    </>
  );
}
