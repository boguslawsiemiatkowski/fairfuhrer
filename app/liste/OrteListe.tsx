"use client";

// Filter + Gruppierung für /liste.
//
// Der Filterzustand steht in der URL (?stadt=&kategorie=&q=), damit ein
// gefilterter Blick teilbar ist und der Zurück-Button funktioniert. Die
// Gruppierung nach Stadt hält die Seite überschaubar: 592 Orte auf einmal
// wären eine Wand, die niemand liest.
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Category, Place } from "@/types";
import PlaceCard from "@/components/PlaceCard";
import { cityToSegment, normalizeForSearch } from "@/lib/orte-shared";
import styles from "./page.module.css";

interface OrteListeProps {
  places: Place[];
  categories: Category[];
}

/** Ab wie vielen Treffern die Städte eingeklappt starten. */
const COLLAPSE_THRESHOLD = 60;

export default function OrteListe({ places, categories }: OrteListeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const stadtParam = searchParams.get("stadt") ?? "";
  const kategorieParam = searchParams.get("kategorie") ?? "";
  const queryParam = searchParams.get("q") ?? "";

  // Das Eingabefeld braucht sofortige Reaktion; die URL wird erst beim
  // Abschicken aktualisiert, sonst entsteht pro Tastendruck ein History-Eintrag.
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

  // Treffer nach allen drei Filtern. Gesucht wird gegen den Wert in der URL,
  // nicht gegen das Eingabefeld — sonst würde die Liste bei jedem Tastendruck
  // über 592 Orte neu rechnen.
  const filtered = useMemo(() => {
    const q = normalizeForSearch(queryParam);
    return places.filter((place) => {
      if (stadtParam && cityToSegment(place.Stadt) !== stadtParam) return false;
      if (activeCategory && !place.Kategorie.some((c) => c.id === activeCategory.id)) {
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
  }, [places, stadtParam, activeCategory, queryParam]);

  // Städte-Chips zeigen die Zahlen, die bei den ÜBRIGEN Filtern noch möglich
  // sind — so führt kein Chip in ein leeres Ergebnis.
  const cityChips = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const place of places) {
      if (activeCategory && !place.Kategorie.some((c) => c.id === activeCategory.id)) {
        continue;
      }
      const segment = cityToSegment(place.Stadt);
      if (!segment) continue;
      const entry = counts.get(segment);
      if (entry) entry.count++;
      else counts.set(segment, { name: place.Stadt!.trim(), count: 1 });
    }
    return [...counts.entries()]
      .map(([segment, v]) => ({ segment, ...v }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de"));
  }, [places, activeCategory]);

  const categoryChips = useMemo(() => {
    return categories
      .map((cat) => ({
        ...cat,
        segment: cityToSegment(cat.name),
        count: places.filter(
          (p) =>
            (!stadtParam || cityToSegment(p.Stadt) === stadtParam) &&
            p.Kategorie.some((c) => c.id === cat.id),
        ).length,
      }))
      .filter((c) => c.count > 0);
  }, [categories, places, stadtParam]);

  // Treffer nach Stadt gruppieren, größte Stadt zuerst.
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; places: Place[] }>();
    for (const place of filtered) {
      const segment = cityToSegment(place.Stadt) || "ohne-stadt";
      const entry = map.get(segment);
      if (entry) entry.places.push(place);
      else
        map.set(segment, {
          name: place.Stadt?.trim() || "Ohne Stadtangabe",
          places: [place],
        });
    }
    return [...map.entries()]
      .map(([segment, v]) => ({ segment, ...v }))
      .sort(
        (a, b) =>
          b.places.length - a.places.length || a.name.localeCompare(b.name, "de"),
      );
  }, [filtered]);

  // Bei wenigen Treffern alles offen, bei vielen zugeklappt.
  const startExpanded = filtered.length <= COLLAPSE_THRESHOLD;
  const [manuallyToggled, setManuallyToggled] = useState<Set<string>>(new Set());

  const isExpanded = useCallback(
    (segment: string) =>
      manuallyToggled.has(segment) ? !startExpanded : startExpanded,
    [manuallyToggled, startExpanded],
  );

  const toggleCity = useCallback((segment: string) => {
    setManuallyToggled((prev) => {
      const next = new Set(prev);
      if (next.has(segment)) next.delete(segment);
      else next.add(segment);
      return next;
    });
  }, []);

  const hasFilters = Boolean(stadtParam || kategorieParam || queryParam);

  return (
    <>
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

      <div className={styles.filterBlock}>
        <h2 className={styles.filterLabel}>Kategorie</h2>
        <div className={styles.chipRow}>
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
      </div>

      <div className={styles.filterBlock}>
        <h2 className={styles.filterLabel}>Stadt</h2>
        <div className={styles.chipRow}>
          {cityChips.map((city) => {
            const active = city.segment === stadtParam;
            return (
              <button
                key={city.segment}
                type="button"
                className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                onClick={() => setParam("stadt", active ? "" : city.segment)}
                aria-pressed={active}
              >
                {city.name}
                <span className={styles.chipCount}>{city.count}</span>
              </button>
            );
          })}
        </div>
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

      {filtered.length === 0 ? (
        <p className={styles.emptyState}>
          Keine Orte gefunden. Versuchen Sie einen anderen Suchbegriff oder
          setzen Sie die Filter zurück.
        </p>
      ) : (
        groups.map((group) => {
          const expanded = isExpanded(group.segment);
          return (
            <section key={group.segment} className={styles.cityGroup}>
              <h2 className={styles.cityHeading}>
                <button
                  type="button"
                  className={styles.cityToggle}
                  onClick={() => toggleCity(group.segment)}
                  aria-expanded={expanded}
                >
                  <span className={styles.cityChevron} aria-hidden="true">
                    {expanded ? "▾" : "▸"}
                  </span>
                  {group.name}
                  <span className={styles.cityCount}>
                    {group.places.length}
                  </span>
                </button>
              </h2>

              {expanded && (
                <ul className={styles.cards}>
                  {group.places.map((place) => (
                    <PlaceCard key={place.id} place={place} hideCity />
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </>
  );
}
