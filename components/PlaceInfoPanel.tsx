"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { DirectusImage, PlaceImage } from "./MediaComponents";
import ColumnAudioPlayer from "./ColumnAudioPlayer";
import CategoryIcon, { categoryColorFor } from "./CategoryIcon";
import PlaceGallery from "./PlaceGallery";
import { getAudioUrl } from "../lib/supabase";
import {
  cityToSegment,
  galleryUrls,
  sanitizeExternalUrl,
  sanitizeWordHtml,
} from "../lib/orte-shared";
import type { Place } from "../types";
import styles from "./PlaceInfoPanel.module.css";

// Klientowy cache opisów pobranych on-demand po kliknięciu w pin na /karte
const descriptionCache = new Map<number, string | null>();

function resolveAudioSrc(place: Place): string | null {
  const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL;
  if (place.Audio && directusUrl) {
    return `${directusUrl}/assets/${place.Audio}`;
  }
  if (place.Audio_Datei) {
    return getAudioUrl(place.id, place.Audio_Datei);
  }
  return null;
}

function resolveDetailHref(place: Place): string | null {
  const segment = cityToSegment(place.Stadt);
  if (!segment || !place.slug) return null;
  return `/liste/${segment}/${place.slug}`;
}

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
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onCloseAction();
      setIsClosing(false);
    }, 380);
  }, [onCloseAction]);

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
      {/* Backdrop widoczny wyłącznie na ekranach mobilnych (<= 860px).
          Na desktopie mapa pozostaje w pełni interaktywna i pozwala klikać kolejne piny. */}
      <div
        className={`${styles.panelBackdrop} ${isActuallyOpen ? styles.visible : ""}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel zawsze istnieje w DOM — <Activity> w MapBoxMap może trzymać go w pamięci.
          Widoczność kontroluje wyłącznie CSS transform (.open) oraz pointer-events. */}
      <aside
        ref={panelRef}
        className={`${styles.infoPanel} ${isActuallyOpen ? styles.open : ""}`}
        role="dialog"
        aria-modal={false}
        aria-hidden={!isActuallyOpen}
        aria-labelledby={place ? `place-title-${place.id}` : undefined}
        inert={!isActuallyOpen || undefined}
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={handleClose}
          aria-label="Schließen"
          title="Schließen"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
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

        <div className={styles.panelContent}>
          {place ? (
            <PlaceContent key={place.id} place={place} />
          ) : (
            <EmptyState />
          )}
        </div>
      </aside>
    </>
  );
}

function PlaceContent({ place }: { place: Place }) {
  const galerie = galleryUrls(place);
  const safeLinkUrl = sanitizeExternalUrl(place.Link_URL);
  const audioUrl = resolveAudioSrc(place);
  const detailHref = resolveDetailHref(place);
  const firstCategory = place.Kategorie[0];
  const headerColor = categoryColorFor(firstCategory);

  // Jeśli opis przyszedł bezpośrednio w obiekcie Place lub jest już w cache, używamy go od razu
  const initialDescription =
    place.Vollbeschreibung !== undefined
      ? place.Vollbeschreibung
        ? sanitizeWordHtml(place.Vollbeschreibung)
        : null
      : descriptionCache.get(place.id);

  const [lazyDescription, setLazyDescription] = useState<
    string | null | undefined
  >(initialDescription);

  useEffect(() => {
    if (place.Vollbeschreibung !== undefined || descriptionCache.has(place.id)) {
      return;
    }

    const controller = new AbortController();

    fetch(`/api/orte/${place.id}/description`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ description: string | null }>;
      })
      .then((data) => {
        const sanitized = data.description
          ? sanitizeWordHtml(data.description)
          : null;
        descriptionCache.set(place.id, sanitized);
        setLazyDescription(sanitized);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(
          `Nie udało się pobrać opisu dla miejsca ${place.id}:`,
          err,
        );
        setLazyDescription(null);
      });

    return () => controller.abort();
  }, [place.id, place.Vollbeschreibung]);

  const safeDescription =
    initialDescription !== undefined ? initialDescription : lazyDescription;
  const isLoadingDescription = safeDescription === undefined;

  return (
    <>
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

      {/* Kolorowy nagłówek w barwie kategorii — spójny z lewą kolumną strony /liste/[stadt]/[slug] */}
      <header
        className={styles.placeHeader}
        style={{ backgroundColor: headerColor }}
      >
        {place.Kategorie && place.Kategorie.length > 0 && (
          <div className={styles.categoryBadges}>
            {place.Kategorie.map((cat) => (
              <span key={cat.id} className={styles.categoryBadge}>
                <CategoryIcon
                  categoryId={cat.id}
                  color="rgba(255,255,255,0.22)"
                  strokeColor="#fff"
                  size={22}
                />
                <span>{cat.name}</span>
              </span>
            ))}
          </div>
        )}

        <h2 id={`place-title-${place.id}`} className={styles.placeName}>
          {place.Name}
        </h2>

        <p className={styles.placeAddress}>
          {place.Adresse}
          {place.Stadt && (
            <>
              <br />
              {place.Stadt}
              {place.Land ? `, ${place.Land}` : ""}
            </>
          )}
        </p>

        {place.Telefon && (
          <a
            href={`tel:${place.Telefon.replace(/\s+/g, "")}`}
            className={styles.placePhone}
          >
            📞 {place.Telefon}
          </a>
        )}

        {audioUrl && (
          <div className={styles.audioPlayerWrap}>
            <ColumnAudioPlayer src={audioUrl} title={place.Name} />
          </div>
        )}
      </header>

      {/* Pasek akcji: przejście do pełnej strony Audiopinu oraz strona www partnera */}
      {(detailHref || safeLinkUrl) && (
        <div className={styles.actionsBar}>
          {detailHref && (
            <Link href={detailHref} className={styles.primaryCta}>
              <span>Zur vollständigen Seite</span>
              <span className={styles.ctaArrow} aria-hidden="true">
                →
              </span>
            </Link>
          )}

          {safeLinkUrl && (
            <div className={styles.secondaryActions}>
              <a
                href={safeLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.secondaryCta}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                <span>{place.Link_Text || "Website besuchen"}</span>
              </a>
            </div>
          )}
        </div>
      )}

      {isLoadingDescription ? (
        <div
          className={styles.infoSection}
          aria-busy="true"
          aria-label="Beschreibung wird geladen"
        >
          <div className={styles.descriptionSkeleton}>
            <span className={styles.skeletonLine} />
            <span className={styles.skeletonLine} />
            <span className={styles.skeletonLine} />
            <span className={styles.skeletonLineShort} />
          </div>
        </div>
      ) : (
        safeDescription && (
          <section className={styles.infoSection}>
            <div
              className={styles.description}
              dangerouslySetInnerHTML={{ __html: safeDescription }}
            />
          </section>
        )
      )}

      {galerie.length > 0 && (
        <section className={styles.infoSection}>
          <h4 className={styles.sectionTitle}>Bildergalerie</h4>
          <PlaceGallery images={galerie} name={place.Name} variant="panel" />
        </section>
      )}

      {place.Zertifizierungen && place.Zertifizierungen.length > 0 && (
        <section className={styles.infoSection}>
          <h4 className={styles.sectionTitle}>Zertifizierungen &amp; Labels</h4>
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
                    <span className={styles.zertifizierungName}>
                      {zert.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
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
