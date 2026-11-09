// fairfuhrer/components/ConditionalMapbox.tsx
"use client";

import React from "react";
import { useCookies } from "../context/CookieContext";
import { MapSkeleton } from "./MapWithFilters";
import styles from "./MapWithFilters.module.css";

interface ConditionalMapboxProps {
  children: React.ReactNode;
}

export function ConditionalMapbox({ children }: ConditionalMapboxProps) {
  const { hasConsented, showBanner } = useCookies();

  // Podczas pierwszej klatki hydratacji (zanim useEffect w CookieContext odczyta
  // zapisaną zgodę z ciasteczek/localStorage) zarówno hasConsented, jak i showBanner
  // mają wartość false. Wyświetlamy wtedy identyczny MapSkeleton ze spinnerem,
  // aby uniknąć mignięcia komunikatu o cookies u użytkowników, którzy już wyrazili zgodę.
  if (!hasConsented && !showBanner) {
    return <MapSkeleton />;
  }

  // Jeśli użytkownik faktycznie nie wyraził jeszcze zgody (baner cookies jest widoczny),
  // pokazujemy informację o wymaganej zgodzie w tym samym układzie szkieletu (CLS = 0).
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
