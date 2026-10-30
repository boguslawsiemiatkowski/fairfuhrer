"use client";

// Filter für /liste, nach dem Vorbild des Liste-Tabs der App:
//
//   · Suche
//   · EINE Kategorie zur Zeit (nicht mehrere) — ruhiger als zwei Reihen Chips
//   · Land statt Stadt: drei Chips statt 155
//   · Karten in einem waagerecht scrollbaren Band
//
// Der Filterzustand steht in der URL (?land=&kategorie=&q=), damit ein
// gefilterter Blick teilbar ist und der Zurück-Button funktioniert.
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Category, Place } from "@/types";
import PlaceRail from "@/components/PlaceRail";
import { cityToSegment, normalizeForSearch } from "@/lib/orte-shared";
import styles from "./page.module.css";

interface OrteListeProps {
  places: Place[];
  categories: Category[];
}

/** Dieselben Länder wie in der App (CityChips). */
const LAENDER = ["Deutschland", "Österreich", "Schweiz"] as const;

export default function OrteListe({ places, categories }: OrteListeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const landParam = searchParams.get("land") ?? "";
  const kategorieParam = searchParams.get("kategorie") ?? "";
  const queryParam = searchParams.get("q") ?? "";

  // Das Eingabefeld reagiert sofort; die URL ändert sich erst beim Abschicken,
  // sonst entstünde pro Tastendruck ein History-Eintrag.
  const [queryDraft, setQueryDraft] = useState(queryParam);

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      router.replace(qs ? `/liste?${qs}` : "/liste", { scroll: false });
    },
    [router, searchParams],
  );

  const activeCategory = kategorieParam
    ? categories.find((c) => cityToSegment(c.name) === kategorieParam)
    : undefined;

  const activeLand = LAENDER.find((l) => cityToSegment(l) === landParam);

  const filtered = useMemo(() => {
    const q = normalizeForSearch(queryParam);
    return places.filter((place) => {
      if (activeLand && place.Land !== activeLand) return false;
      if (
        activeCategory &&
        !place.Kategorie.some((c) => c.id === activeCategory.id)
      ) {
        return false;
      }
      if (q) {
        const haystack = normalizeForSearch(
          `${place.Name} ${place.Stadt ?? ""} ${place.Adresse}`,
        );
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [places, activeLand, activeCategory, queryParam]);

  // Zähler zeigen, was bei den ÜBRIGEN Filtern noch möglich ist — so führt
  // kein Chip in ein leeres Ergebnis.
  const landChips = useMemo(
    () =>
      LAENDER.map((land) => ({
        land,
        segment: cityToSegment(land),
        count: places.filter(
          (p) =>
            p.Land === land &&
            (!activeCategory ||
              p.Kategorie.some((c) => c.id === activeCategory.id)),
        ).length,
      })).filter((l) => l.count > 0),
    [places, activeCategory],
  );

  const categoryChips = useMemo(
    () =>
      categories
        .map((cat) => ({
          ...cat,
          segment: cityToSegment(cat.name),
          count: places.filter(
            (p) =>
              (!activeLand || p.Land === activeLand) &&
              p.Kategorie.some((c) => c.id === cat.id),
          ).length,
        }))
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count),
    [categories, places, activeLand],
  );

  const hasFilters = Boolean(landParam || kategorieParam || queryParam);

  const railLabel = [
    activeCategory?.name,
    activeLand,
    queryParam ? `Suche „${queryParam}“` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className={styles.controls}>
        <form
          className={styles.searchRow}
          onSubmit={(e) => {
            e.preventDefault();
            setParam("q", queryDraft.trim());
          }}
          role="search"
        >
          <input
            type="search"
            value={queryDraft}
            onChange={(e) => setQueryDraft(e.target.value)}
            placeholder="Ort, Stadt oder Adresse suchen …"
            aria-label="Orte durchsuchen"
            className={styles.searchInput}
          />
          <button type="submit" className={styles.searchButton}>
            Suchen
          </button>
        </form>

        <div className={styles.chipRow}>
          <button
            type="button"
            className={`${styles.chip} ${!kategorieParam ? styles.chipActive : ""}`}
            onClick={() => setParam("kategorie", "")}
            aria-pressed={!kategorieParam}
          >
            Alle Kategorien
            <span className={styles.chipCount}>{places.length}</span>
          </button>
          {categoryChips.map((cat) => {
            const active = cat.segment === kategorieParam;
            return (
              <button
                key={cat.id}
                type="button"
                className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                style={active ? { backgroundColor: cat.color } : undefined}
                onClick={() => setParam("kategorie", active ? "" : cat.segment)}
                aria-pressed={active}
              >
                {cat.name}
                <span className={styles.chipCount}>{cat.count}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.chipRow}>
          <button
            type="button"
            className={`${styles.chip} ${!landParam ? styles.chipActive : ""}`}
            onClick={() => setParam("land", "")}
            aria-pressed={!landParam}
          >
            Alle Länder
          </button>
          {landChips.map((l) => {
            const active = l.segment === landParam;
            return (
              <button
                key={l.land}
                type="button"
                className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                onClick={() => setParam("land", active ? "" : l.segment)}
                aria-pressed={active}
              >
                {l.land}
                <span className={styles.chipCount}>{l.count}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.resultBar}>
          <p className={styles.resultCount}>
            {filtered.length === places.length
              ? `${places.length} Orte`
              : `${filtered.length} von ${places.length} Orten`}
          </p>
          {hasFilters && (
            <Link href="/liste" className={styles.resetLink} scroll={false}>
              Filter zurücksetzen
            </Link>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.emptyState}>
          Keine Orte gefunden. Versuchen Sie einen anderen Suchbegriff oder
          setzen Sie die Filter zurück.
        </p>
      ) : (
        <PlaceRail places={filtered} label={railLabel || "Alle Orte"} />
      )}

      <p className={styles.hint}>
        Tipp: Karten lassen sich wischen, ziehen oder mit den Pfeiltasten
        durchblättern. Alle Orte einer Stadt finden Sie auf der jeweiligen
        Stadtseite.
      </p>
    </>
  );
}
