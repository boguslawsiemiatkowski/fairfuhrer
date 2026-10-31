// components/CategoryFilter.tsx - With proper modal switching
import React, { useCallback, useState } from "react";
import CategoryInfoModal from "./CategoryInfoModal";
import styles from "./CategoryFilter.module.css";
import type { Category } from "../types";
import { getCategoryIconPaths, DEFAULT_ICON_PATHS } from "../lib/categoryIcons";
import { categoryColorFor } from "./CategoryIcon";

function CategoryPin({
  category,
  isActive,
}: {
  category: Category;
  isActive: boolean;
}) {
  const iconPaths = getCategoryIconPaths(category.id) ?? DEFAULT_ICON_PATHS;
  const color = isActive ? categoryColorFor(category) : "#ccc";

  return (
    <svg
      width="28"
      height="38"
      viewBox="0 0 40 56"
      aria-hidden="true"
      className={`${styles.categoryPin} ${isActive ? styles.categoryPinActive : styles.categoryPinInactive}`}
    >
      <path
        d="M20,2 C10.611,2 3,9.611 3,19 C3,31 20,54 20,54 C20,54 37,31 37,19 C37,9.611 29.389,2 20,2 Z"
        fill={color}
      />
      <circle cx="20" cy="19" r="11" fill="white" />
      <g
        transform="translate(12,11) scale(0.667)"
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: iconPaths }}
      />
    </svg>
  );
}

interface CategoryFilterProps {
  categories: Category[];
  selectedIds: number[];
  onToggle: (id: number) => void;
}

const CategoryFilter = ({
  categories,
  selectedIds,
  onToggle,
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
      } else {
        if (isModalOpen && openCategoryId !== category.id) {
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

  return (
    <>
      <div className={styles.filterContainer}>
        {categories.map((category) => {
          const isActive = selectedIds.includes(category.id);
          const hasDescription = Boolean(category.description?.trim());
          const isModalOpenForThis =
            openCategoryId === category.id && isModalOpen;

          // Früher erschien der Info-Button auch bei „Sehenswertes" ohne
          // Beschreibung, um auf das Gating hinzuweisen. Das Gating ist weg,
          // also zeigt er jetzt nur noch echte Kategorie-Beschreibungen.
          const showInfoButton = hasDescription;

          return (
            <div key={category.id} className={styles.filterWrapper}>
              <div className={styles.filterWrapperRow}>
                <button
                  type="button"
                  className={styles.filterItem}
                  onClick={() => onToggle(category.id)}
                  aria-pressed={isActive}
                  aria-label={`Kategorie ${category.name} ${
                    isActive ? "ausblenden" : "anzeigen"
                  }`}
                >
                  <CategoryPin category={category} isActive={isActive} />
                  <span className={styles.filterName}>{category.name}</span>
                </button>

                {showInfoButton && (
                  <button
                    className={`${styles.infoButton} ${isModalOpenForThis ? styles.infoButtonActive : ""}`}
                    onClick={(e) => handleInfoClick(e, category)}
                    aria-label={`Informationen zu ${category.name} ${
                      isModalOpenForThis ? "schließen" : "öffnen"
                    }`}
                    aria-expanded={isModalOpenForThis ? "true" : "false"}
                    type="button"
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
