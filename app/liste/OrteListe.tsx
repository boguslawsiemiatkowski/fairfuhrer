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


  // Sortierung nach Entfernung — wie im Liste-Tab der App, aber per Knopf:
  // der Browser fragt erst nach Erlaubnis, wenn der Nutzer sie anfordert.
  const [gps, setGps] = useState<
    | { state: "off" }
    | { state: "locating" }
    | { state: "on"; lat: number; lon: number }
    | { state: "error"; message: string }
  >({ state: "off" });

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGps({ state: "error", message: "Standort wird nicht unterstützt." });
      return;
    }
    setGps({ state: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGps({
          state: "on",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        }),
      () =>
        setGps({
          state: "error",
          message: "Standort konnte nicht ermittelt werden.",
        }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }, []);

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

  // Nach Entfernung sortieren, wenn ein Standort vorliegt. Gerechnet wird
  // hier im Browser statt über die Supabase-Funktion nearby_orte: die
  // Koordinaten sind schon geladen, das spart einen Netzaufruf.
  const ordered = useMemo(() => {
    if (gps.state !== "on") return filtered;
    const withDistance = filtered.map((place) => {
      const [lon, lat] = place.location.coordinates;
      // Äquirektangulare Näherung — für ein paar hundert Kilometer am
      // Bodensee genau genug, um richtig zu sortieren.
      const dLat = ((lat - gps.lat) * Math.PI) / 180;
      const dLon =
        (((lon - gps.lon) * Math.PI) / 180) *
        Math.cos(((lat + gps.lat) / 2 * Math.PI) / 180);
      return { place, d: dLat * dLat + dLon * dLon };
    });
    withDistance.sort((a, b) => a.d - b.d);
    return withDistance.map((w) => w.place);
  }, [filtered, gps]);

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

      {/* ── Über den Karten: Standort-Sortierung (wie in der App) ─────── */}
      <div className={styles.aboveCards}>
        {gps.state === "on" ? (
          <span className={styles.gpsLabel}>Nach Entfernung sortiert</span>
        ) : (
          <button
            type="button"
            className={styles.gpsBtn}
            onClick={requestLocation}
            disabled={gps.state === "locating"}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" stroke="#fc6c14" strokeWidth="2" />
              <circle cx="12" cy="12" r="3.5" fill="#fc6c14" />
            </svg>
            {gps.state === "locating"
              ? "Standort wird ermittelt …"
              : gps.state === "error"
                ? "Erneut versuchen"
                : "Nach Entfernung sortieren"}
          </button>
        )}
        {gps.state === "error" && (
          <span className={styles.gpsError}>{gps.message}</span>
        )}
      </div>

      {/* ── 1. Karten ─────────────────────────────────────────────────── */}
      <div className={styles.cardsArea}>
        {filtered.length === 0 ? (
          <p className={styles.emptyState}>Keine Ergebnisse gefunden.</p>
        ) : (
          <PlaceRail
            places={ordered}
            label={railLabel || "Alle Orte"}
            resetKey={`${stadtParam}|${landParam}|${kategorieParam}|${gps.state}`}
          />
        )}
      </div>

      {/* ── 2. Länder-Chips ───────────────────────────────────────────── */}
      <div className={styles.belowCards}>
        <div className={styles.chipRow}>
          {/* „Alle" als eigener Chip: vorher musste man den aktiven Chip
              erneut antippen, um die Auswahl zu lösen — das musste man erst
              erraten. Jetzt schaltet jeder Chip nur EIN, zurückgesetzt wird
              über „Alle". */}
          <button
            type="button"
            className={`${styles.chip} ${!landParam ? styles.chipActive : ""}`}
            onClick={() => setParam("land", "")}
            aria-pressed={!landParam}
          >
            Alle ({places.length})
          </button>
          {landChips.map((l) => {
            const active = l.segment === landParam;
            return (
              <button
                key={l.land}
                type="button"
                className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                onClick={() => setParam("land", l.segment)}
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
        {/* Rahmen, der das geschlossene Menü abschneidet: es liegt per
            translate3d unterhalb seiner eigenen Unterkante, und ohne dieses
            overflow:hidden würde es über Suchfeld und Balken hinausragen. */}
        <div
          className={`${styles.menuClip} ${menuOpen ? styles.menuClipOpen : ""}`}
        >
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

    </div>
  );
}
