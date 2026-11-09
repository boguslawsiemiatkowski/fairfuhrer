// components/CategoryFilter.tsx
// Nowoczesny filtr kategorii dla strony /karte:
// - na desktopie: czytelna lista z kolorowymi ikonami CategoryIcon, licznikami miejsc i przyciskiem info
// - na mobile: poziomy, przewijany pasek chipów kategorii z szybkim przełącznikiem „Alle”
import React, { useCallback, useState } from "react";
import CategoryInfoModal from "./CategoryInfoModal";
import CategoryIcon, { categoryColorFor } from "./CategoryIcon";
import styles from "./CategoryFilter.module.css";
import type { Category } from "../types";

interface CategoryFilterProps {
  categories: Category[];
  selectedIds: number[];
  categoryCounts?: Record<number, number>;
  totalPlacesCount?: number;
  onToggle: (id: number) => void;
  onSelectAll?: () => void;
  onToggleAll?: () => void;
}

const CategoryFilter = ({
  categories,
  selectedIds,
  categoryCounts,
  totalPlacesCount,
  onToggle,
  onToggleAll,
}: CategoryFilterProps) => {
  const [modalCategory, setModalCategory] = useState<Category | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openCategoryId, setOpenCategoryId] = useState<number | null>(null);

  const handleInfoClick = useCallback(
    (e: React.MouseEvent, category: Category) => {
      e.stopPropagation();

      if (openCategoryId === category.id && isModalOpen) {
        setIsModalOpen(false);
        setModalCategory(null);
        setOpenCategoryId(null);
      } else if (isModalOpen && openCategoryId !== category.id) {
        setIsModalOpen(false);
        setTimeout(() => {
          setModalCategory(category);
          setIsModalOpen(true);
          setOpenCategoryId(category.id);
        }, 200);
      } else {
        setModalCategory(category);
        setIsModalOpen(true);
        setOpenCategoryId(category.id);
      }
    },
    [openCategoryId, isModalOpen],
  );

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setModalCategory(null);
    setOpenCategoryId(null);
  }, []);

  if (!categories.length) {
    return (
      <div className={styles.filterContainer}>
        <p className={styles.noCategories}>Keine Kategorien verfügbar</p>
      </div>
    );
  }

  const allSelected = selectedIds.length === categories.length;

  return (
    <>
      <div className={styles.filterContainer}>
        {/* Chip „Alle” widoczny w poziomym pasku mobilnym */}
        {onToggleAll && (
          <div className={`${styles.filterWrapper} ${styles.mobileOnlyChip}`}>
            <div
              className={`${styles.filterWrapperRow} ${
                allSelected ? styles.filterWrapperRowActive : styles.filterWrapperRowInactive
              }`}
            >
              <button
                type="button"
                className={styles.filterItem}
                onClick={onToggleAll}
                aria-pressed={allSelected}
                aria-label={
                  allSelected
                    ? "Alle Kategorien abwählen"
                    : "Alle Kategorien auswählen"
                }
              >
                <CategoryIcon
                  categoryId={null}
                  color={allSelected ? "#18222f" : "#94a3b8"}
                  size={24}
                  className={styles.categoryIcon}
                />
                <span className={styles.filterName}>Alle</span>
                {typeof totalPlacesCount === "number" && (
                  <span className={styles.categoryCount}>{totalPlacesCount}</span>
                )}
              </button>
            </div>
          </div>
        )}

        {categories.map((category) => {
          const isActive = selectedIds.includes(category.id);
          const hasDescription = Boolean(category.description?.trim());
          const isModalOpenForThis =
            openCategoryId === category.id && isModalOpen;
          const color = categoryColorFor(category);
          const count = categoryCounts?.[category.id];

          return (
            <div key={category.id} className={styles.filterWrapper}>
              <div
                className={`${styles.filterWrapperRow} ${
                  isActive
                    ? styles.filterWrapperRowActive
                    : styles.filterWrapperRowInactive
                }`}
                style={{ "--cat-color": color } as React.CSSProperties}
              >
                <button
                  type="button"
                  className={styles.filterItem}
                  onClick={() => onToggle(category.id)}
                  aria-pressed={isActive}
                  aria-label={`Kategorie ${category.name} ${
                    isActive ? "ausblenden" : "anzeigen"
                  }`}
                >
                  <CategoryIcon
                    categoryId={category.id}
                    color={isActive ? color : "#94a3b8"}
                    size={26}
                    className={styles.categoryIcon}
                  />
                  <span className={styles.filterName}>{category.name}</span>
                  {typeof count === "number" && (
                    <span className={styles.categoryCount}>{count}</span>
                  )}
                </button>

                {hasDescription && (
                  <button
                    className={`${styles.infoButton} ${
                      isModalOpenForThis ? styles.infoButtonActive : ""
                    }`}
                    onClick={(e) => handleInfoClick(e, category)}
                    aria-label={`Informationen zu ${category.name} ${
                      isModalOpenForThis ? "schließen" : "öffnen"
                    }`}
                    aria-expanded={isModalOpenForThis ? "true" : "false"}
                    title={`Info zu ${category.name}`}
                    type="button"
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <CategoryInfoModal
        category={modalCategory}
        isOpen={isModalOpen}
        onClose={handleModalClose}
      />
    </>
  );
};

export default CategoryFilter;
