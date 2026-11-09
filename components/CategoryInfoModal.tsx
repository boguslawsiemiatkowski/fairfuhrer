// components/CategoryInfoModal.tsx
"use client";

import React, { useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { FocusTrap } from "focus-trap-react";
import CategoryIcon, { categoryColorFor } from "./CategoryIcon";
import { sanitizeWordHtml } from "../lib/orte-shared";
import styles from "./CategoryInfoModal.module.css";
import type { Category } from "../types";

interface CategoryInfoModalProps {
  category: Category | null;
  isOpen: boolean;
  onClose: () => void;
}

const CategoryInfoModal: React.FC<CategoryInfoModalProps> = ({
  category,
  isOpen,
  onClose,
}) => {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [closeTimeoutId, setCloseTimeoutId] = useState<NodeJS.Timeout | null>(
    null,
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && mounted) {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
    }
  }, [isOpen, mounted]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleClose = useCallback(() => {
    if (!isClosing) {
      setIsClosing(true);
      setIsVisible(false);

      if (closeTimeoutId) {
        clearTimeout(closeTimeoutId);
      }

      const timeoutId = setTimeout(() => {
        setIsClosing(false);
        onClose();
      }, 250);
      setCloseTimeoutId(timeoutId);
    }
  }, [onClose, isClosing, closeTimeoutId]);

  useEffect(() => {
    return () => {
      if (closeTimeoutId) {
        clearTimeout(closeTimeoutId);
      }
    };
  }, [closeTimeoutId]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose],
  );

  useEffect(() => {
    if (isOpen) {
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${scrollbarWidth}px`;

      return () => {
        document.body.style.overflow = "";
        document.body.style.paddingRight = "";
      };
    }
  }, [isOpen]);

  if (!mounted || !isOpen || !category) {
    return null;
  }

  const safeDescription = category.description
    ? sanitizeWordHtml(category.description)
    : "";

  const modalContent = (
    <div
      className={`${styles.backdrop} ${isVisible ? styles.visible : ""} ${
        isClosing ? styles.closing : ""
      }`}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <FocusTrap
        active={isOpen && !isClosing}
        focusTrapOptions={{
          initialFocus: `button.${styles.closeButton}`,
          allowOutsideClick: true,
          escapeDeactivates: (event) => {
            handleClose();
            event.preventDefault();
            return false;
          },
          returnFocusOnDeactivate: true,
        }}
      >
        <div
          className={`${styles.modal} ${isVisible ? styles.visible : ""} ${
            isClosing ? styles.closing : ""
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-modal-title"
          aria-describedby="category-modal-description"
        >
          <div className={styles.modalHeader}>
            <div className={styles.modalTitleGroup}>
              <CategoryIcon
                categoryId={category.id}
                color={categoryColorFor(category)}
                size={28}
              />
              <h3 id="category-modal-title" className={styles.modalTitle}>
                {category.name}
              </h3>
            </div>

            <button
              className={styles.closeButton}
              onClick={handleClose}
              aria-label="Schließen"
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
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div
            id="category-modal-description"
            className={styles.content}
            dangerouslySetInnerHTML={{
              __html: safeDescription,
            }}
          />
        </div>
      </FocusTrap>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default CategoryInfoModal;
