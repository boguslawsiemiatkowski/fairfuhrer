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
import StadtSuche, { type CityOption } from "./StadtSuche";
import { cityToSegment } from "@/lib/orte-shared";
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
  const stadtParam = searchParams.get("stadt") ?? "";

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

  const filtered = useMemo(
    () =>
      places.filter((place) => {
        if (stadtParam && cityToSegment(place.Stadt) !== stadtParam) return false;
        if (activeLand && place.Land !== activeLand) return false;
        if (
          activeCategory &&
          !place.Kategorie.some((c) => c.id === activeCategory.id)
        ) {
          return false;
        }
        return true;
      }),
    [places, stadtParam, activeLand, activeCategory],
  );

  // Städte für die Vorschlagsliste — nach Anzahl der Orte, damit die
  // ergiebigsten oben stehen. Zähler berücksichtigen die übrigen Filter.
  const cityOptions = useMemo<CityOption[]>(() => {
    const map = new Map<string, CityOption>();
    for (const place of places) {
      if (activeLand && place.Land !== activeLand) continue;
      if (
        activeCategory &&
        !place.Kategorie.some((c) => c.id === activeCategory.id)
      ) {
        continue;
      }
      const segment = cityToSegment(place.Stadt);
      if (!segment) continue;
      const entry = map.get(segment);
      if (entry) entry.count++;
      else
        map.set(segment, {
          segment,
          name: place.Stadt!.trim(),
          land: place.Land,
          count: 1,
        });
    }
    return [...map.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, "de"),
    );
  }, [places, activeLand, activeCategory]);

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

  const selectedCityName = cityOptions.find((c) => c.segment === stadtParam)?.name;

  const railLabel = [selectedCityName, activeCategory?.name, activeLand]
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
        <StadtSuche
          cities={cityOptions}
          selected={stadtParam}
          onSelect={(segment) => setParam("stadt", segment)}
        />

        <div className={styles.kategorieBarWrap}>
          <button
            type="button"
            className={styles.kategorieBar}
            style={barColor ? { backgroundColor: barColor } : undefined}
            onClick={() => setMenuOpen((v) => !v)}
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

      {/* Kategorie-Menü: bleibt im DOM und wird über eine Klasse animiert,
          damit es sich auch beim SCHLIESSEN nach unten zurückschiebt. Wäre es
          bedingt gerendert, verschwände es abrupt. Kein abdunkelnder
          Hintergrund — der Balken sitzt unten, das Menü direkt darüber. */}
      <div
        className={`${styles.menu} ${menuOpen ? styles.menuOpen : ""}`}
        role="menu"
        aria-label="Kategorie wählen"
        aria-hidden={!menuOpen}
        // Im geschlossenen Zustand nicht per Tab erreichbar.
        inert={!menuOpen}
      >
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
    </div>
  );
}
