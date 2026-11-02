// fairfuhrer/components/ConditionalMapbox.tsx
"use client";

import React from "react";
import { useCookies } from "../context/CookieContext";
import styles from "./MapWithFilters.module.css";

interface ConditionalMapboxProps {
  children: React.ReactNode;
}

export function ConditionalMapbox({ children }: ConditionalMapboxProps) {
  const { hasConsented } = useCookies();

  // Mapbox wymaga zgody na pliki cookie — zanim zostanie wyrażona (lub zanim kontekst
  // zhydratuje się w przeglądarce), wyświetlamy pełnowymiarowy szkielet mapy (CLS = 0).
  if (!hasConsented) {
    return (
      <div className={styles.mapSkeleton} role="status" aria-live="polite">
        <div className={styles.mapSkeletonGrid} aria-hidden="true" />
        <div className={styles.mapSkeletonBadge}>
          <span className={styles.mapSkeletonText}>
            Karte wird geladen, nachdem Sie den Cookie-Einstellungen zugestimmt
            haben.
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
