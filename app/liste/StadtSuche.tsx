"use client";

// app/liste/StadtSuche.tsx
//
// Suchfeld mit Vorschlagsliste — nach dem Vorbild der SearchSection der App,
// aber bewusst auf STÄDTE beschränkt: wer tippt, sucht einen Ort, nicht einen
// einzelnen Pin. Nach der Auswahl zeigt das Kartenband nur noch diese Stadt.
//
// Die 155 Städte wären als Chips eine Wand; als Vorschlagsliste sind sie in
// zwei Tastendrücken erreichbar.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeForSearch } from "@/lib/orte-shared";
import styles from "./page.module.css";

export interface CityOption {
  /** URL-Segment, z. B. "lindau". */
  segment: string;
  /** Anzeigename, z. B. "Lindau". */
  name: string;
  land?: string;
  count: number;
}

interface StadtSucheProps {
  cities: CityOption[];
  /** Segment der gewählten Stadt, oder "" für alle. */
  selected: string;
  onSelect: (segment: string) => void;
}

/** Wie viele Vorschläge höchstens erscheinen. */
const MAX_SUGGESTIONS = 8;

export default function StadtSuche({
  cities,
  selected,
  onSelect,
}: StadtSucheProps) {
  const selectedCity = cities.find((c) => c.segment === selected);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Steht eine Stadt fest, zeigt das Feld deren Namen; sonst das Getippte.
  const inputValue = open ? query : (selectedCity?.name ?? query);

  const suggestions = useMemo(() => {
    const q = normalizeForSearch(query);
    const pool = q
      ? cities.filter((c) => normalizeForSearch(c.name).includes(q))
      : // Ohne Eingabe die Städte mit den meisten Orten — so ist die Liste
        // auch beim ersten Antippen nützlich.
        cities;
    return pool.slice(0, MAX_SUGGESTIONS);
  }, [cities, query]);

  // Klick außerhalb schließt die Vorschläge.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const choose = useCallback(
    (segment: string) => {
      onSelect(segment);
      setQuery("");
      setOpen(false);
      setHighlight(0);
    },
    [onSelect],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const pick = suggestions[highlight];
        if (pick) choose(pick.segment);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [suggestions, highlight, choose],
  );

  return (
    <div className={styles.searchWrap} ref={wrapRef}>
      {open && suggestions.length > 0 && (
        <ul className={styles.suggestions} role="listbox" aria-label="Städte">
          {suggestions.map((city, index) => (
            <li key={city.segment}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlight}
                className={`${styles.suggestionItem} ${
                  index === highlight ? styles.suggestionItemActive : ""
                }`}
                onPointerDown={(e) => {
                  // pointerdown statt click: der Klick-außerhalb-Handler
                  // würde die Liste sonst schließen, bevor der Klick ankommt.
                  e.preventDefault();
                  choose(city.segment);
                }}
                onMouseEnter={() => setHighlight(index)}
              >
                <span className={styles.suggestionName}>{city.name}</span>
                <span className={styles.suggestionMeta}>
                  {city.land ? `${city.land} · ` : ""}
                  {city.count} {city.count === 1 ? "Ort" : "Orte"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.searchBar}>
        <svg
          className={styles.searchIcon}
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>

        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Stadt suchen"
          aria-label="Stadt suchen"
          aria-autocomplete="list"
          aria-expanded={open}
          className={styles.searchInput}
          // Browser-Autofill würde hier Adressen vorschlagen.
          autoComplete="off"
        />

        {(selectedCity || query) && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => {
              setQuery("");
              setOpen(false);
              onSelect("");
            }}
            aria-label="Stadt zurücksetzen"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
