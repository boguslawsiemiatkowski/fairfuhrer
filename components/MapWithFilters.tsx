// components/MapWithFilters.tsx
// Komponent łączący mapę Mapbox z nowoczesnym filtrem kategorii oraz synchronizacją
// stanu filtrów w parametrze URL (?kategorie=...) na stronie /karte.
"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { LocateFixed } from "lucide-react";
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

  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);

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

  const handleToggleAll = useCallback(() => {
    setSelectedCategoryIds((prev) => {
      const allSelected = prev.length === allCategoryIds.length;
      const next = allSelected ? [] : allCategoryIds;
      syncUrlWithCategories(next);
      return next;
    });
  }, [allCategoryIds, syncUrlWithCategories]);

  const handleResetAll = useCallback(() => {
    setSelectedCategoryIds(allCategoryIds);
    syncUrlWithCategories(allCategoryIds);
  }, [allCategoryIds, syncUrlWithCategories]);

  // Gdy użytkownik wybierze w wyszukiwarce (lub przez ?pin=...) miejsce,
  // którego kategoria była wyłączona w Legendzie, automatycznie ją włączamy
  const handleEnsurePlaceVisible = useCallback(
    (place: Place) => {
      if (embedded || place.Kategorie.length === 0) return;
      setSelectedCategoryIds((prev) => {
        const isAlreadyVisible = place.Kategorie.some((cat) =>
          prev.includes(cat.id),
        );
        if (isAlreadyVisible) return prev;
        const primaryCatId = place.Kategorie[0].id;
        const next = [...prev, primaryCatId];
        syncUrlWithCategories(next);
        return next;
      });
    },
    [embedded, syncUrlWithCategories],
  );

  // Liczba miejsc przypisanych do każdej kategorii
  const categoryCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const cat of categories) {
      counts[cat.id] = 0;
    }
    for (const place of places) {
      for (const cat of place.Kategorie) {
        counts[cat.id] = (counts[cat.id] ?? 0) + 1;
      }
    }
    return counts;
  }, [places, categories]);

  const filteredPlaces = useMemo(() => {
    if (selectedCategoryIds.length === 0) {
      return [];
    }
    return places.filter((place) =>
      place.Kategorie.some((cat) => selectedCategoryIds.includes(cat.id)),
    );
  }, [places, selectedCategoryIds]);

  const allSelected = selectedCategoryIds.length === categories.length;

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
        allPlaces={places}
        onEnsurePlaceVisible={handleEnsurePlaceVisible}
        disableGeolocation={disableGeolocation}
        embedded={embedded}
      />

      {!embedded && (
        <aside
          className={`${styles.filtersContainer} ${
            isLegendCollapsed ? styles.filtersContainerCollapsed : ""
          }`}
          aria-label="Kategorien und Legende"
        >
          {/* Nagłówek karty na desktopie (zwijany/rozwijany) */}
          <div className={styles.legendHeader}>
            <div className={styles.legendTitleGroup}>
              <h3 className={styles.legendTitle}>Legende</h3>
              <span className={styles.placesCounter}>
                {allSelected
                  ? `${places.length} Orte`
                  : `${filteredPlaces.length} / ${places.length} Orte`}
              </span>
            </div>

            <button
              type="button"
              className={styles.collapseButton}
              onClick={() => setIsLegendCollapsed((prev) => !prev)}
              aria-expanded={!isLegendCollapsed}
              aria-label={
                isLegendCollapsed ? "Legende ausklappen" : "Legende einklappen"
              }
              title={
                isLegendCollapsed ? "Legende ausklappen" : "Legende einklappen"
              }
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={
                  isLegendCollapsed
                    ? styles.chevronCollapsed
                    : styles.chevronExpanded
                }
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          <div
            className={`${styles.legendBody} ${
              isLegendCollapsed ? styles.legendBodyCollapsed : ""
            }`}
          >
            <div className={styles.legendToolbar}>
              <span className={styles.legendSubtitle}>Nach Kategorie filtern</span>
              <button
                type="button"
                className={styles.resetButton}
                onClick={handleToggleAll}
              >
                {allSelected ? "Alle abwählen" : "Alle auswählen"}
              </button>
            </div>

            <CategoryFilter
              categories={categories}
              selectedIds={selectedCategoryIds}
              categoryCounts={categoryCounts}
              totalPlacesCount={places.length}
              onToggle={handleToggleCategory}
              onSelectAll={handleResetAll}
              onToggleAll={handleToggleAll}
            />
          </div>
        </aside>
      )}

      {/* Osobny boks w prawym dolnym rogu mapy (nad atrybucją Mapbox, na wysokości Legendy):
          informacja i szybki przycisk wycentrowania mapy na lokalizacji GPS użytkownika */}
      {!embedded && !disableGeolocation && (
        <div className={styles.geolocateHintBox}>
          <button
            type="button"
            className={styles.geolocateHintBtn}
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("fairfuehrer:trigger-geolocate"),
              );
            }}
            title="Karte auf meinen aktuellen GPS-Standort zentrieren"
          >
            <span className={styles.geolocateHintIconWrap} aria-hidden="true">
              <LocateFixed size={15} />
            </span>
            <span className={styles.geolocateHintText}>
              <strong>Meinen Standort anzeigen</strong>
              <span>
                Hier klicken oder das Standortsymbol oben links nutzen
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
