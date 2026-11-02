// components/MapWithFilters.tsx
// Komponent łączący mapę Mapbox z filtrem kategorii oraz synchronizacją stanu
// filtrów w parametrze URL (?kategorie=...) na stronie /karte.
"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import CategoryFilter from "./CategoryFilter";
import { cityToSegment } from "../lib/orte-shared";
import styles from "./MapWithFilters.module.css";
import type { Place, Category } from "../types";

export function MapSkeleton({ embedded = false }: { embedded?: boolean }) {
  return (
    <div
      className={`${styles.mapSkeleton} ${embedded ? styles.mapSkeletonEmbedded : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Karte wird geladen"
    >
      <div className={styles.mapSkeletonGrid} aria-hidden="true" />
      <div className={styles.mapSkeletonBadge}>
        <span className={styles.mapSkeletonSpinner} aria-hidden="true" />
        <span className={styles.mapSkeletonText}>Karte wird geladen…</span>
      </div>
    </div>
  );
}

// Dynamiczny import MapBoxMap (wraz z ciężkim silnikiem WebGL mapbox-gl ~280 kB gzip)
// wyłącza SSR i wydziela bibliotekę do osobnego chunka ładowanego asynchronicznie w przeglądarce.
const MapBoxMap = dynamic(() => import("./MapBoxMap"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

interface MapWithFiltersProps {
  places: Place[];
  categories: Category[];
  disableGeolocation?: boolean;
  embedded?: boolean;
}

/**
 * Odczytuje wybrane ID kategorii z parametru `?kategorie=...` w adresie URL.
 * Obsługuje zarówno slugi nazw (np. `essen-und-uebernachten,einkaufen` — spójnie z `/liste`),
 * jak i numeryczne ID kategorii. Gdy brak parametru, zwraca wszystkie kategorie.
 */
export function parseCategoriesFromSearch(
  search: string,
  categories: Category[],
): number[] {
  const allIds = categories.map((c) => c.id);
  if (!search) return allIds;

  const params = new URLSearchParams(search);
  const raw = params.get("kategorie");
  if (raw === null) return allIds;
  if (raw === "none" || raw.trim() === "") return [];

  const tokens = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const matched = categories
    .filter(
      (cat) =>
        tokens.includes(cityToSegment(cat.name)) ||
        tokens.includes(String(cat.id)),
    )
    .map((cat) => cat.id);

  return matched.length > 0 ? matched : allIds;
}

/**
 * Buduje wartość parametru `?kategorie=...` na podstawie zaznaczonych ID kategorii.
 * Zwraca `null`, gdy zaznaczone są wszystkie kategorie (czysty URL `/karte`).
 */
export function buildCategoriesQueryParam(
  selectedIds: number[],
  categories: Category[],
): string | null {
  if (categories.length === 0) return null;
  if (selectedIds.length === 0) return "none";
  if (selectedIds.length >= categories.length) return null;

  const slugs = categories
    .filter((cat) => selectedIds.includes(cat.id))
    .map((cat) => cityToSegment(cat.name));

  return slugs.join(",");
}

export default function MapWithFilters({
  places,
  categories,
  disableGeolocation = false,
  embedded = false,
}: MapWithFiltersProps) {
  const allCategoryIds = useMemo(
    () => categories.map((c) => c.id),
    [categories],
  );

  // Inicjalizacja wybranych kategorii (z URL na pełnej stronie /karte lub wszystkie w trybie embedded)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(() =>
    !embedded && typeof window !== "undefined"
      ? parseCategoriesFromSearch(window.location.search, categories)
      : allCategoryIds,
  );

  // Obsługa przycisków Wstecz/Dalej przeglądarki (popstate)
  useEffect(() => {
    if (embedded) return;
    const handlePopState = () => {
      setSelectedCategoryIds(
        parseCategoriesFromSearch(window.location.search, categories),
      );
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [embedded, categories]);

  const syncUrlWithCategories = useCallback(
    (nextIds: number[]) => {
      if (embedded || typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const paramValue = buildCategoriesQueryParam(nextIds, categories);
      if (paramValue === null) {
        params.delete("kategorie");
      } else {
        params.set("kategorie", paramValue);
      }
      const qs = params.toString();
      const nextUrl = qs
        ? `${window.location.pathname}?${qs}`
        : window.location.pathname;
      window.history.replaceState(null, "", nextUrl);
    },
    [embedded, categories],
  );

  const handleToggleCategory = useCallback(
    (categoryId: number) => {
      setSelectedCategoryIds((prev) => {
        const next = prev.includes(categoryId)
          ? prev.filter((id) => id !== categoryId)
          : [...prev, categoryId];
        syncUrlWithCategories(next);
        return next;
      });
    },
    [syncUrlWithCategories],
  );

  const filteredPlaces = useMemo(() => {
    if (selectedCategoryIds.length === 0) {
      return [];
    }
    return places.filter((place) =>
      place.Kategorie.some((cat) => selectedCategoryIds.includes(cat.id)),
    );
  }, [places, selectedCategoryIds]);

  const containerClass = [
    styles.container,
    embedded && styles.containerEmbedded,
  ]
    .filter(Boolean)
    .join(" ");

  if (categories.length === 0) {
    return (
      <div className={containerClass}>
        <div className={styles.errorMessage}>Keine Kategorien verfügbar</div>
      </div>
    );
  }

  if (places.length === 0) {
    return (
      <div className={containerClass}>
        <div className={styles.errorMessage}>Keine Orte verfügbar</div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <MapBoxMap
        places={embedded ? places : filteredPlaces}
        disableGeolocation={disableGeolocation}
        embedded={embedded}
      />

      {!embedded && (
        <div className={styles.filtersContainer}>
          <h3 className={styles.legendTitle}>Legende</h3>
          <p className={styles.legendSubtitle}>
            Filtern Sie Orte nach Kategorien
          </p>
          <CategoryFilter
            categories={categories}
            selectedIds={selectedCategoryIds}
            onToggle={handleToggleCategory}
          />
        </div>
      )}
    </div>
  );
}
