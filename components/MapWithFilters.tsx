// components/MapWithFilters.tsx - Z dodanym podtytułem
"use client";

import { useState, useCallback, useMemo } from "react";
import MapBoxMap from "./MapBoxMap";
import CategoryFilter from "./CategoryFilter";
import styles from "./MapWithFilters.module.css";
import type { Place, Category, SightsLockModalContent } from "../types";

interface MapWithFiltersProps {
  places: Place[];
  categories: Category[];
  disableGeolocation?: boolean;
  embedded?: boolean;
  /** Directus-Text für die Info-Blase über gesperrten Sehenswertes-Pins. */
  sightsLockContent?: SightsLockModalContent | null;
  /** Ungenutzt, seit das Gating entfallen ist — siehe MapBoxMap.tsx. */
  sightsFreePercent?: number;
}

export default function MapWithFilters({
  places,
  categories,
  disableGeolocation = false,
  embedded = false,
  sightsLockContent,
  sightsFreePercent,
}: MapWithFiltersProps) {
  // Inicjalizacja z wszystkimi kategoriami
  const allCategoryIds = useMemo(
    () => categories.map((c) => c.id),
    [categories]
  );

  const [selectedCategoryIds, setSelectedCategoryIds] =
    useState<number[]>(allCategoryIds);

  const handleToggleCategory = useCallback((categoryId: number) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  }, []);

  // Nur nach Kategorie filtern. Ein Gating für Einzelnutzer gibt es nicht mehr
  // (siehe Kommentar in MapBoxMap.tsx).
  const filteredPlaces = useMemo(() => {
    if (selectedCategoryIds.length === 0) {
      return [];
    }
    return places.filter((place) =>
      place.Kategorie.some((cat) => selectedCategoryIds.includes(cat.id))
    );
  }, [places, selectedCategoryIds]);

  const containerClass = [styles.container, embedded && styles.containerEmbedded].filter(Boolean).join(" ");

  // Handle przypadku gdy brak kategorii
  if (categories.length === 0) {
    return (
      <div className={containerClass}>
        <div className={styles.errorMessage}>Keine Kategorien verfügbar</div>
      </div>
    );
  }

  // Handle przypadku gdy brak miejsc
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
        sightsLockContent={sightsLockContent}
        sightsFreePercent={sightsFreePercent}
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
