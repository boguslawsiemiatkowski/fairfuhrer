"use client";

// Liste-Ansicht, so nah am Liste-Tab der App wie im Browser möglich.
//
// Reihenfolge wie dort — und das ist der Kern: die KARTEN stehen oben, die
// Bedienelemente darunter. Wer die Seite öffnet, sieht zuerst Orte, nicht
// Filter.
//
//   1. Kartenband (waagerecht)
//   2. Länder-Chips
//   3. Suchfeld (oranger Balken)
//   4. Kategorie-Balken (öffnet ein Menü von unten)
//
// Der Filterzustand steht in der URL (?land=&kategorie=&q=), damit ein
// gefilterter Blick teilbar ist und der Zurück-Button funktioniert.
import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Category, Place } from "@/types";
import PlaceRail from "@/components/PlaceRail";
import CategoryIcon, { CATEGORY_COLORS } from "@/components/CategoryIcon";
import { cityToSegment, normalizeForSearch } from "@/lib/orte-shared";
import styles from "./page.module.css";

interface OrteListeProps {
  places: Place[];
  categories: Category[];
}

/** Dieselben Länder wie in CityChips der App. */
const LAENDER = ["Deutschland", "Österreich", "Schweiz"] as const;

export default function OrteListe({ places, categories }: OrteListeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const landParam = searchParams.get("land") ?? "";
  const kategorieParam = searchParams.get("kategorie") ?? "";
  const queryParam = searchParams.get("q") ?? "";

  const [queryDraft, setQueryDraft] = useState(queryParam);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const categoryCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const cat of categories) {
      map.set(
        cat.id,
        places.filter(
          (p) =>
            (!activeLand || p.Land === activeLand) &&
            p.Kategorie.some((c) => c.id === cat.id),
        ).length,
      );
    }
    return map;
  }, [categories, places, activeLand]);

  const barColor = activeCategory
    ? activeCategory.color || CATEGORY_COLORS[activeCategory.id] || "#fc6c14"
    : undefined;

  const railLabel = [
    activeCategory?.name,
    activeLand,
    queryParam ? `Suche „${queryParam}“` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const chooseCategory = useCallback(
    (cat: Category | null) => {
      setMenuOpen(false);
      setParam("kategorie", cat ? cityToSegment(cat.name) : "");
    },
    [setParam],
  );

  return (
    <div className={styles.screen}>
      {/* ── 1. Karten ─────────────────────────────────────────────────── */}
      <div className={styles.cardsArea}>
        {filtered.length === 0 ? (
          <p className={styles.emptyState}>Keine Ergebnisse gefunden.</p>
        ) : (
          <PlaceRail places={filtered} label={railLabel || "Alle Orte"} />
        )}
      </div>

      {/* ── 2. Länder-Chips ───────────────────────────────────────────── */}
      <div className={styles.belowCards}>
        <div className={styles.chipRow}>
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
                {l.count > 0 ? ` (${l.count})` : ""}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. Suche + 4. Kategorie-Balken ────────────────────────────── */}
      <div className={styles.bottomSection}>
        <form
          className={styles.searchBar}
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
            placeholder="Suchen"
            aria-label="Orte durchsuchen"
            className={styles.searchInput}
          />
          {(queryDraft || queryParam) && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                setQueryDraft("");
                setParam("q", "");
              }}
              aria-label="Suche löschen"
            >
              ✕
            </button>
          )}
        </form>

        <div className={styles.kategorieBarWrap}>
          <button
            type="button"
            className={styles.kategorieBar}
            style={barColor ? { backgroundColor: barColor } : undefined}
            onClick={() => setMenuOpen(true)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            {activeCategory ? (
              <>
                <span className={styles.kategorieBarIcon}>
                  <CategoryIcon
                    categoryId={activeCategory.id}
                    color="#fff"
                    strokeColor={barColor}
                    size={28}
                  />
                </span>
                <span className={styles.kategorieBarTextActive}>
                  {activeCategory.name}
                </span>
                <span
                  className={styles.kategorieClear}
                  role="button"
                  tabIndex={0}
                  aria-label="Kategorie zurücksetzen"
                  onClick={(e) => {
                    e.stopPropagation();
                    setParam("kategorie", "");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      setParam("kategorie", "");
                    }
                  }}
                >
                  ✕
                </span>
              </>
            ) : (
              <span className={styles.kategorieBarText}>
                Kategorie wählen ›
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Kategorie-Menü, fährt wie in der App von unten herein. */}
      {menuOpen && (
        <>
          <div
            className={styles.backdrop}
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className={styles.menu} role="menu" aria-label="Kategorie wählen">
            <button
              type="button"
              role="menuitem"
              className={`${styles.menuItem} ${!activeCategory ? styles.menuItemActive : ""}`}
              onClick={() => chooseCategory(null)}
            >
              <span className={styles.menuIcon}>
                <CategoryIcon categoryId={null} color="#fff" strokeColor="#000" />
              </span>
              <span className={styles.menuText}>Alle</span>
              <span className={styles.menuCount}>{places.length}</span>
            </button>

            {categories.map((cat) => {
              const active = activeCategory?.id === cat.id;
              const count = categoryCounts.get(cat.id) ?? 0;
              if (count === 0) return null;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="menuitem"
                  className={`${styles.menuItem} ${active ? styles.menuItemActive : ""}`}
                  onClick={() => chooseCategory(cat)}
                >
                  <span className={styles.menuIcon}>
                    <CategoryIcon
                      categoryId={cat.id}
                      color={cat.color || CATEGORY_COLORS[cat.id] || "#666"}
                      size={36}
                    />
                  </span>
                  <span className={styles.menuText}>{cat.name}</span>
                  <span className={styles.menuCount}>{count}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
