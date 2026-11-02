"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { AudioPlayer, DirectusAudioPlayer, DirectusImage, PlaceImage } from "./MediaComponents";
import type { Place } from "../types";
import styles from "./PlaceInfoPanel.module.css";
import { categoryColorFor } from "./CategoryIcon";
import PlaceGallery from "./PlaceGallery";
import { galleryUrls, sanitizeExternalUrl, sanitizeWordHtml } from "../lib/orte-shared";

interface PlaceInfoPanelProps {
  place: Place | null;
  isOpen: boolean;
  isVisible: boolean;
  onCloseAction: () => void;
}

export default function PlaceInfoPanel({
  place,
  isOpen,
  isVisible,
  onCloseAction,
}: PlaceInfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onCloseAction();
      setIsClosing(false);
    }, 500);
  }, [onCloseAction]);

  useEffect(() => {
    if (!isOpen || !isVisible || isClosing) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (backdropRef.current && backdropRef.current.contains(target)) {
        handleClose();
        return;
      }

      if (
        target.closest('[data-gallery-modal="true"]') ||
        (panelRef.current && panelRef.current.contains(target)) ||
        target.closest(".mapboxgl-ctrl") ||
        target.closest(".mapboxgl-popup")
      ) {
        return;
      }

      handleClose();
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isOpen, isVisible, isClosing, handleClose]);

  useEffect(() => {
    if (!isOpen || isClosing) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isClosing, handleClose]);

  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.scrollTop = 0;
    }
  }, [place?.id]);

  const isActuallyOpen = isVisible && !isClosing;

  return (
    <>
      <div
        ref={backdropRef}
        className={`${styles.panelBackdrop} ${isActuallyOpen ? styles.visible : ""}`}
      />

      {/* Panel zawsze istnieje w DOM — <Activity> w MapBoxMap może trzymać go w pamięci.
          Widoczność kontroluje wyłącznie CSS transform (.open) oraz pointer-events. */}
      <div
        ref={panelRef}
        className={`${styles.infoPanel} ${isActuallyOpen ? styles.open : ""}`}
        role="dialog"
        aria-modal={isActuallyOpen}
        aria-hidden={!isActuallyOpen}
        aria-labelledby={place ? `place-title-${place.id}` : undefined}
        inert={!isActuallyOpen || undefined}
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={handleClose}
          aria-label="Schließen"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className={styles.panelContent}>
          {place ? (
            <PlaceContent key={place.id} place={place} />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </>
  );
}

function PlaceContent({ place }: { place: Place }) {
  const galerie = galleryUrls(place);
  const safeLinkUrl = sanitizeExternalUrl(place.Link_URL);
  const safeDescription = place.Vollbeschreibung
    ? sanitizeWordHtml(place.Vollbeschreibung)
    : undefined;

  return (
    <>
      <div className={styles.imageAudioContainer}>
        {(place.Titelbild || place.Hauptbild) && (
          <div className={styles.mainImageSection}>
            {place.Titelbild ? (
              <DirectusImage
                uuid={place.Titelbild}
                alt={place.Name}
                className={styles.mainImage}
              />
            ) : (
              <PlaceImage
                placeId={place.id}
                filename={place.Hauptbild!}
                alt={place.Name}
                type="main"
                className={styles.mainImage}
              />
            )}
          </div>
        )}

        {(place.Audio || place.Audio_Datei) && (
          <div className={styles.audioSection}>
            {place.Audio ? (
              <DirectusAudioPlayer uuid={place.Audio} />
            ) : (
              <AudioPlayer placeId={place.id} filename={place.Audio_Datei!} />
            )}
          </div>
        )}
      </div>

      {place.Kategorie && place.Kategorie.length > 0 && (
        <div className={styles.categoryBadges}>
          {place.Kategorie.map((cat) => (
            <span
              key={cat.id}
              className={styles.categoryBadge}
              style={{ "--badge-color": categoryColorFor(cat) } as React.CSSProperties}
            >
              {cat.name}
            </span>
          ))}
        </div>
      )}

      <div className={styles.placeNameSection}>
        <h2 id={`place-title-${place.id}`} className={styles.placeName}>
          {place.Name}
        </h2>
        <p className={styles.placeAddress}>
          {place.Adresse}
          {place.Stadt ? ` ${place.Stadt}` : ""}
          {place.Land ? ` (${place.Land})` : ""}
        </p>
        {place.Telefon && (
          <a href={`tel:${place.Telefon.replace(/\s+/g, "")}`} className={styles.placePhone}>
            📞 {place.Telefon}
          </a>
        )}
      </div>

      {safeDescription && (
        <div className={styles.infoSection}>
          <div
            className={styles.description}
            dangerouslySetInnerHTML={{ __html: safeDescription }}
          />
        </div>
      )}

      {safeLinkUrl && (
        <div className={styles.infoSection}>
          <a
            href={safeLinkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.externalLink}
          >
            {place.Link_Text || "Website besuchen"}
          </a>
        </div>
      )}

      {galerie.length > 0 && (
        <div className={styles.infoSection}>
          <h4>Bildergalerie</h4>
          {/* Dieselbe Galerie wie auf der Detailseite. galleryUrls() führt
            * Directus- und Supabase-Bilder zusammen, statt sich wie vorher
            * für eine der beiden Quellen zu entscheiden. */}
          <PlaceGallery images={galerie} name={place.Name} variant="panel" />
        </div>
      )}

      {place.Zertifizierungen && place.Zertifizierungen.length > 0 && (
        <div className={styles.infoSection}>
          <h4>Zertifizierungen &amp; Labels</h4>
          <div className={styles.zertifizierungenGrid}>
            {place.Zertifizierungen.map((zert) => {
              const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL;
              return (
                <div key={zert.id} className={styles.zertifizierungItem}>
                  {zert.imageUuid && directusUrl ? (
                    <Image
                      src={`${directusUrl}/assets/${zert.imageUuid}`}
                      alt={zert.name}
                      fill
                      sizes="120px"
                      className={styles.zertifizierungLogo}
                      title={zert.name}
                      style={{ objectFit: "contain" }}
                    />
                  ) : (
                    <span className={styles.zertifizierungName}>{zert.name}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <h2>Kein Ort ausgewählt</h2>
      <p>Wählen Sie einen Punkt auf der Karte aus, um Details zu sehen.</p>
    </div>
  );
}
