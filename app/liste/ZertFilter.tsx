// app/liste/ZertFilter.tsx
//
// Filter nach Zertifikat, im Streifen über dem Kartenband. Die Zertifikate
// sind das Eigentliche des Fairführers — bisher ließ sich nach ihnen nicht
// suchen, obwohl 16 Siegel im Bestand sind.
//
// Gestaltung aus der Legende auf /karte übernommen, damit beide Ansichten
// dieselbe Sprache sprechen: Kopfzeile in Markenorange mit handgezogenem
// Rahmen, Zeilen mit Logo links, Name und Zähler rechts, aktive Zeile mit
// farbiger Kante (vgl. CategoryFilter).
//
// Der Knopf sitzt IM FLUSS des Streifens, nur das Menü liegt absolut
// darüber: `.screen` auf /liste hat `overflow: hidden` und würde ein absolut
// gesetztes Menü abschneiden — dieselbe Falle hat auf der Detailseite schon
// zweimal Zeit gekostet.
"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import styles from "./ZertFilter.module.css";

export type ZertOption = {
  /** URL-Segment, z. B. "demeter". */
  slug: string;
  name: string;
  imageUuid?: string;
  /** Wie viele Orte dieses Zertifikat tragen. */
  count: number;
};

type ZertFilterProps = {
  options: ZertOption[];
  /** Gewähltes Zertifikat (slug) oder "" für alle. */
  selected: string;
  onSelectAction: (slug: string) => void;
  open: boolean;
  onToggleAction: () => void;
};

export default function ZertFilter({
  options,
  selected,
  onSelectAction,
  open,
  onToggleAction,
}: ZertFilterProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const directusUrl = process.env.NEXT_PUBLIC_DIRECTUS_URL ?? "";

  // Klick daneben und Escape schließen das Menü — wie bei der Städte-Suche
  // und beim Kategorie-Menü.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) onToggleAction();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onToggleAction();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onToggleAction]);

  const active = options.find((o) => o.slug === selected);

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        type="button"
        className={`${styles.trigger} ${active ? styles.triggerActive : ""}`}
        onClick={onToggleAction}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {/* Logo des gewählten Siegels schon im Knopf: so ist die Auswahl
            sichtbar, ohne das Menü zu öffnen. */}
        {active?.imageUuid && directusUrl && (
          <Image
            src={`${directusUrl}/assets/${active.imageUuid}`}
            alt=""
            width={120}
            height={60}
            sizes="34px"
            className={styles.triggerLogo}
          />
        )}
        <span className={styles.triggerLabel}>
          {active ? active.name : "Zertifikate"}
        </span>
        {active ? (
          <span className={styles.triggerCount}>{active.count}</span>
        ) : (
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={open ? styles.chevronOpen : styles.chevron}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {/* Bleibt im DOM und wird über eine Klasse bewegt, damit es sich auch
          beim Schließen zurückschiebt. Bedingt gerendert verschwände es
          abrupt. Bewegt wird `transform`, nicht `height`. */}
      <div
        className={`${styles.menu} ${open ? styles.menuOpen : ""}`}
        role="menu"
        aria-label="Zertifikat wählen"
        aria-hidden={!open}
        inert={!open}
      >
        <div className={styles.menuHeader}>
          <h3 className={styles.menuTitle}>Zertifikate</h3>
          {selected ? (
            // Aufheben im Kopf, nicht als Zeile in der Liste: dort läge es
            // in der Auswahlgruppe der Siegel, wo es nicht hingehört.
            <button
              type="button"
              className={styles.resetButton}
              onClick={() => onSelectAction("")}
            >
              Aufheben
            </button>
          ) : (
            <span className={styles.menuCounter}>{options.length}</span>
          )}
        </div>

        {/* `group` umschließt die menuitemradio-Einträge: so weiß ein
            Screenreader, dass die Siegel eine Auswahlgruppe bilden. */}
        <div className={styles.menuBody} role="group">
          {options.map((option) => {
            const isActive = option.slug === selected;
            return (
              <div
                key={option.slug}
                className={`${styles.row} ${
                  isActive ? styles.rowActive : styles.rowInactive
                }`}
              >
                <button
                  type="button"
                  // menuitemradio statt menuitem: es wird genau ein
                  // Zertifikat gewählt. `aria-pressed` gehört zu einem
                  // Schalter, nicht zu einem Menüeintrag.
                  role="menuitemradio"
                  aria-checked={isActive}
                  className={styles.rowButton}
                  onClick={() => onSelectAction(isActive ? "" : option.slug)}
                >
                  <span className={styles.logoBox}>
                    {option.imageUuid && directusUrl && (
                      <Image
                        src={`${directusUrl}/assets/${option.imageUuid}`}
                        alt=""
                        width={160}
                        height={80}
                        sizes="44px"
                        className={styles.logo}
                      />
                    )}
                  </span>
                  <span className={styles.rowName}>{option.name}</span>
                  {/* Die Zahl verrät vorab, wie viel dahinter steckt: vier
                      Siegel haben nur einen oder zwei Orte, und ohne Hinweis
                      wirkt so ein Ergebnis wie ein Fehler. */}
                  <span className={styles.rowCount}>{option.count}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
