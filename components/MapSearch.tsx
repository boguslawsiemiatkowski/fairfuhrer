// components/MapSearch.tsx
"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useDebounce } from "../hooks/useDebounce";
import type { Place } from "../types/map";
import styles from "./MapSearch.module.css";

// Vereinheitlichter Suggestion-Typ: entweder ein lokaler Pin (placeId gesetzt)
// oder ein geografischer Treffer aus Mapbox (placeId = null, bbox optional).
interface Suggestion {
  id: string;
  name: string;
  place_formatted: string;
  lat: number;
  lon: number;
  bbox: [number, number, number, number] | null;
  feature_type: string; // place / region / pin
  placeId?: number; // gesetzt → lokaler Pin
}

interface MapSearchProps {
  onLocationSelect: (
    coords: [number, number],
    zoom: number,
    bbox?: [number, number, number, number],
    maxZoom?: number,
  ) => void;
  onPinSelect?: (placeId: number) => void;
  places?: Place[];
  disabled?: boolean;
  panelOpen?: boolean;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// Dodatkowe słowa kluczowe dla kategorii Directus, ułatwiające wyszukiwanie po typie miejsca
const CATEGORY_SYNONYMS: Record<number, string> = {
  1: "sehenswertes erlebnisse kultur ausflug sehenswuerdigkeit museum natur",
  2: "essen uebernachten gastronomie restaurant cafe bistro hotel pension unterkunft",
  3: "einkaufen laden geschaeft shop mode hofladen baeckerei kaeserei weltladen",
  5: "engagement verein initiative bildung soziales nachhaltigkeit",
  8: "unternehmen handwerk betrieb firma dienstleistung",
};

function cleanBase(input: string): string {
  return input
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss");
}

/** Wariant uproszczony: ä→a, ö→o, ü→u oraz usunięcie znaków diakrytycznych (np. Café→cafe). */
function foldAscii(input: string): string {
  return cleanBase(input)
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Wariant z niemieckimi dwuznakami: ä→ae, ö→oe, ü→ue (np. Allgäu→allgaeu, Füssen→fuessen). */
function foldGerman(input: string): string {
  return cleanBase(input)
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface IndexedPlace {
  place: Place;
  nameAscii: string;
  nameGerman: string;
  nameWordsAscii: string[];
  nameWordsGerman: string[];
  nameCompactAscii: string;
  nameCompactGerman: string;
  cityAscii: string;
  cityGerman: string;
  landAscii: string;
  landGerman: string;
  addressAscii: string;
  addressGerman: string;
  categoriesAscii: string;
  categoriesGerman: string;
  certsAscii: string;
  certsGerman: string;
  nonGeoAscii: string;
  nonGeoGerman: string;
  fullAscii: string;
  fullGerman: string;
  hasAudio: boolean;
  formattedSubtitle: string;
}

function buildSearchIndex(places: Place[]): IndexedPlace[] {
  return places
    .filter((p) => Boolean(p.location?.coordinates))
    .map((place) => {
      const rawName = place.Name ?? "";
      const rawCity = place.Stadt ?? "";
      const rawLand = place.Land ?? "";
      const rawAddress = place.Adresse ?? "";
      const rawCategories = place.Kategorie.map(
        (c) => `${c.name} ${CATEGORY_SYNONYMS[c.id] ?? ""}`,
      ).join(" ");
      const rawCerts = (place.Zertifizierungen ?? [])
        .map((z) => z.name)
        .join(" ");
      const hasAudio = Boolean(place.Audio || place.Audio_Datei);
      const audioTerms = hasAudio ? "audio audioguide hoeren" : "";

      const nameAscii = foldAscii(rawName);
      const nameGerman = foldGerman(rawName);
      const cityAscii = foldAscii(rawCity);
      const cityGerman = foldGerman(rawCity);
      const landAscii = foldAscii(rawLand);
      const landGerman = foldGerman(rawLand);
      const addressAscii = foldAscii(rawAddress);
      const addressGerman = foldGerman(rawAddress);
      const categoriesAscii = foldAscii(rawCategories);
      const categoriesGerman = foldGerman(rawCategories);
      const certsAscii = foldAscii(rawCerts);
      const certsGerman = foldGerman(rawCerts);

      const nonGeoAscii = [
        nameAscii,
        addressAscii,
        categoriesAscii,
        certsAscii,
        audioTerms,
      ]
        .filter(Boolean)
        .join(" ");
      const nonGeoGerman = [
        nameGerman,
        addressGerman,
        categoriesGerman,
        certsGerman,
        audioTerms,
      ]
        .filter(Boolean)
        .join(" ");

      const fullAscii = [nonGeoAscii, cityAscii, landAscii]
        .filter(Boolean)
        .join(" ");
      const fullGerman = [nonGeoGerman, cityGerman, landGerman]
        .filter(Boolean)
        .join(" ");

      const primaryCat = place.Kategorie[0]?.name;
      const locationPart = [place.Stadt, place.Adresse]
        .filter(Boolean)
        .join(", ");
      const formattedSubtitle = [primaryCat, locationPart]
        .filter(Boolean)
        .join(" · ");

      return {
        place,
        nameAscii,
        nameGerman,
        nameWordsAscii: nameAscii.split(/\s+/).filter(Boolean),
        nameWordsGerman: nameGerman.split(/\s+/).filter(Boolean),
        nameCompactAscii: nameAscii.replace(/\s+/g, ""),
        nameCompactGerman: nameGerman.replace(/\s+/g, ""),
        cityAscii,
        cityGerman,
        landAscii,
        landGerman,
        addressAscii,
        addressGerman,
        categoriesAscii,
        categoriesGerman,
        certsAscii,
        certsGerman,
        nonGeoAscii,
        nonGeoGerman,
        fullAscii,
        fullGerman,
        hasAudio,
        formattedSubtitle:
          formattedSubtitle ||
          [place.Stadt, place.Land].filter(Boolean).join(", "),
      };
    });
}

function searchIndexedPins(
  query: string,
  indexedPlaces: IndexedPlace[],
): { directPins: Suggestion[]; cityOnlyPins: Suggestion[] } {
  const qAscii = foldAscii(query);
  const qGerman = foldGerman(query);
  if (qAscii.length < 2) {
    return { directPins: [], cityOnlyPins: [] };
  }

  const tokensAscii = qAscii.split(/\s+/).filter(Boolean);
  const tokensGerman = qGerman.split(/\s+/).filter(Boolean);
  if (tokensAscii.length === 0) {
    return { directPins: [], cityOnlyPins: [] };
  }

  const scoredDirect: { score: number; item: IndexedPlace }[] = [];
  const scoredCityOnly: { score: number; item: IndexedPlace }[] = [];

  for (const item of indexedPlaces) {
    let allMatched = true;
    let matchedNonGeo = false;
    let score = 0;

    for (let i = 0; i < tokensAscii.length; i++) {
      const tA = tokensAscii[i];
      const tG = tokensGerman[i] ?? tA;

      const inFull =
        item.fullAscii.includes(tA) ||
        item.fullGerman.includes(tG) ||
        item.fullGerman.includes(tA) ||
        item.fullAscii.includes(tG) ||
        (tA.length >= 4 &&
          (item.nameCompactAscii.includes(tA) ||
            item.nameCompactGerman.includes(tG) ||
            item.nameCompactGerman.includes(tA)));

      if (!inFull) {
        allMatched = false;
        break;
      }

      const tokenInNonGeo =
        item.nonGeoAscii.includes(tA) ||
        item.nonGeoGerman.includes(tG) ||
        item.nonGeoGerman.includes(tA) ||
        (tA.length >= 4 &&
          (item.nameCompactAscii.includes(tA) ||
            item.nameCompactGerman.includes(tG) ||
            item.nameCompactGerman.includes(tA)));

      if (tokenInNonGeo) {
        matchedNonGeo = true;
      }

      // Punktacja za dopasowanie tokenu w poszczególnych polach
      if (
        item.nameWordsAscii.some((w) => w.startsWith(tA) || w.startsWith(tG)) ||
        item.nameWordsGerman.some((w) => w.startsWith(tG) || w.startsWith(tA))
      ) {
        score += 45;
      } else if (
        item.nameAscii.includes(tA) ||
        item.nameGerman.includes(tG) ||
        item.nameGerman.includes(tA) ||
        (tA.length >= 4 &&
          (item.nameCompactAscii.includes(tA) ||
            item.nameCompactGerman.includes(tG)))
      ) {
        score += 28;
      }

      if (
        item.categoriesAscii.includes(tA) ||
        item.categoriesGerman.includes(tG) ||
        item.certsAscii.includes(tA) ||
        item.certsGerman.includes(tG)
      ) {
        score += 22;
      }

      if (
        item.addressAscii.includes(tA) ||
        item.addressGerman.includes(tG) ||
        item.addressGerman.includes(tA)
      ) {
        score += 18;
      }

      if (
        item.cityAscii === tA ||
        item.cityGerman === tG ||
        item.cityGerman === tA
      ) {
        score += 25;
      } else if (
        item.cityAscii.startsWith(tA) ||
        item.cityGerman.startsWith(tG) ||
        item.cityGerman.startsWith(tA)
      ) {
        score += 16;
      } else if (
        item.cityAscii.includes(tA) ||
        item.cityGerman.includes(tG) ||
        item.landAscii.includes(tA) ||
        item.landGerman.includes(tG)
      ) {
        score += 10;
      }
    }

    if (!allMatched) continue;

    // Bonusy za dopasowanie całej frazy w nazwie pinu
    if (
      item.nameAscii === qAscii ||
      item.nameGerman === qGerman ||
      item.nameGerman === qAscii
    ) {
      score += 150;
    } else if (
      item.nameAscii.startsWith(qAscii) ||
      item.nameGerman.startsWith(qGerman) ||
      item.nameGerman.startsWith(qAscii)
    ) {
      score += 100;
    } else if (
      item.nameAscii.includes(qAscii) ||
      item.nameGerman.includes(qGerman) ||
      item.nameGerman.includes(qAscii)
    ) {
      score += 65;
    }

    if (item.hasAudio) {
      score += 2;
    }

    if (matchedNonGeo) {
      scoredDirect.push({ score, item });
    } else {
      scoredCityOnly.push({ score, item });
    }
  }

  const sortByScoreAndName = (
    a: { score: number; item: IndexedPlace },
    b: { score: number; item: IndexedPlace },
  ) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.item.place.Name ?? "").localeCompare(
      b.item.place.Name ?? "",
      "de",
    );
  };

  scoredDirect.sort(sortByScoreAndName);
  scoredCityOnly.sort(sortByScoreAndName);

  const toSuggestion = ({ item }: { item: IndexedPlace }): Suggestion => ({
    id: `pin-${item.place.id}`,
    name: item.place.Name ?? "",
    place_formatted: item.formattedSubtitle,
    lat: item.place.location.coordinates[1],
    lon: item.place.location.coordinates[0],
    bbox: null,
    feature_type: "pin",
    placeId: item.place.id,
  });

  return {
    directPins: scoredDirect.slice(0, 8).map(toSuggestion),
    cityOnlyPins: scoredCityOnly.slice(0, 6).map(toSuggestion),
  };
}

export default function MapSearch({
  onLocationSelect,
  onPinSelect,
  places = [],
  disabled = false,
  panelOpen = false,
}: MapSearchProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [geoResults, setGeoResults] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const debouncedQuery = useDebounce(searchQuery.trim(), 300);

  // Skrót klawiszowy "/" aktywuje pole wyszukiwania na mapie
  useEffect(() => {
    if (disabled) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      setIsExpanded(true);
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [disabled]);

  // Fetch suggestions from Mapbox Geocoding v6
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      return;
    }

    if (!MAPBOX_TOKEN) {
      return;
    }

    abortRef.current?.abort();
    const currentAbort = new AbortController();
    abortRef.current = currentAbort;

    const fetchSuggestions = async () => {
      await Promise.resolve();
      setIsLoading(true);

      const url =
        `https://api.mapbox.com/search/geocode/v6/forward` +
        `?q=${encodeURIComponent(debouncedQuery)}` +
        `&language=de` +
        `&country=DE,AT,CH,FR,LI,IT` +
        `&proximity=9.5,47.65` +
        `&limit=5` +
        `&types=country,region,district,place,locality,address` +
        `&autocomplete=true` +
        `&access_token=${MAPBOX_TOKEN}`;

      try {
        const r = await fetch(url, { signal: currentAbort.signal });
        const json = await r.json();
        if (currentAbort.signal.aborted) return;

        const features = (json.features ?? []) as Record<string, unknown>[];
        setGeoResults(
          features.map((f) => {
            const props = f.properties as Record<string, unknown>;
            const geom = f.geometry as { coordinates: [number, number] };
            const rawBbox = props.bbox as number[] | undefined;
            const bbox: [number, number, number, number] | null =
              rawBbox?.length === 4
                ? [rawBbox[0], rawBbox[1], rawBbox[2], rawBbox[3]]
                : null;
            return {
              id: (props.mapbox_id as string) ?? String(Math.random()),
              name: props.name as string,
              place_formatted: (props.place_formatted as string) ?? "",
              lat: geom.coordinates[1],
              lon: geom.coordinates[0],
              bbox,
              feature_type: (props.feature_type as string) ?? "place",
            };
          }),
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
      } finally {
        if (!currentAbort.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchSuggestions();

    return () => {
      abortRef.current?.abort();
    };
  }, [debouncedQuery]);

  const indexedPlaces = useMemo(() => buildSearchIndex(places), [places]);

  // Natychmiastowe wyszukiwanie lokalnych pinów (0 ms opóźnienia) na podstawie searchQuery
  const { directPins, cityOnlyPins } = useMemo(
    () => searchIndexedPins(searchQuery, indexedPlaces),
    [searchQuery, indexedPlaces],
  );

  // Kolejność wyników:
  // 1. Piny dopasowane bezpośrednio po nazwie/kategorii/adresie/certyfikacie
  // 2. Lokalizacje geograficzne z Mapbox (Ort — np. całe miasto Lindau / Konstanz)
  // 3. Piny dopasowane wyłącznie po nazwie miasta/kraju (dzięki czemu wpisanie "Lindau"
  //    nie chowa opcji wycentrowania na miasto pod 40 pojedynczymi pinami)
  const results = useMemo(
    () => [...directPins, ...geoResults, ...cityOnlyPins],
    [directPins, geoResults, cityOnlyPins],
  );

  const handleSelect = useCallback(
    (result: Suggestion) => {
      abortRef.current?.abort();
      if (result.placeId !== undefined) {
        onPinSelect?.(result.placeId);
      } else {
        const maxZoom = result.feature_type === "place" ? 13 : undefined;
        onLocationSelect(
          [result.lon, result.lat],
          13,
          result.bbox ?? undefined,
          maxZoom,
        );
      }
      setSearchQuery(result.name);
      setIsExpanded(false);
      setGeoResults([]);
      setIsLoading(false);
      setSelectedIndex(-1);
      inputRef.current?.blur();
    },
    [onLocationSelect, onPinSelect],
  );

  const handleSearchIconClick = useCallback(() => {
    if (disabled) return;
    if (!isExpanded) {
      setIsExpanded(true);
      inputRef.current?.focus();
    } else if (!searchQuery.trim()) {
      setIsExpanded(false);
      setSelectedIndex(-1);
      inputRef.current?.blur();
    } else {
      inputRef.current?.focus();
    }
  }, [disabled, isExpanded, searchQuery]);

  const handleSuggestionsClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const itemEl = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-suggestion-index]",
      );
      if (!itemEl) return;
      const idx = Number(itemEl.dataset.suggestionIndex);
      const selected = results[idx];
      if (selected) {
        handleSelect(selected);
      }
    },
    [results, handleSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        abortRef.current?.abort();
        setSearchQuery("");
        setIsExpanded(false);
        setGeoResults([]);
        setIsLoading(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        return;
      }

      if (!isExpanded || results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((p) => (p < results.length - 1 ? p + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((p) => (p > 0 ? p - 1 : results.length - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0) handleSelect(results[selectedIndex]);
          else if (results.length > 0) handleSelect(results[0]);
          break;
      }
    },
    [isExpanded, results, selectedIndex, handleSelect],
  );

  // Close on outside click
  useEffect(() => {
    if (!isExpanded) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsExpanded(false);
        setSelectedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isExpanded]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const el = suggestionsRef.current.children[selectedIndex] as HTMLElement;
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  const trimmedQuery = searchQuery.trim();
  const showSuggestions =
    isExpanded && trimmedQuery.length >= 2 && results.length > 0;
  const showNoResults =
    isExpanded &&
    trimmedQuery.length >= 2 &&
    debouncedQuery.length >= 2 &&
    !isLoading &&
    results.length === 0 &&
    geoResults.length === 0;

  const containerClasses = [
    styles.searchContainer,
    isExpanded && styles.expanded,
    panelOpen && styles.panelOpen,
    disabled && styles.disabled,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={containerRef} className={containerClasses}>
      <div className={styles.searchBox}>
        <button
          className={styles.searchIcon}
          onClick={handleSearchIconClick}
          disabled={disabled}
          aria-label={isExpanded ? "Suche schließen" : "Ort oder Pin suchen"}
          type="button"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>

        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder="Ort, Pin oder Zertifizierungen suchen…"
          value={searchQuery}
          onChange={(e) => {
            const val = e.target.value;
            setSearchQuery(val);
            setIsExpanded(true);
            setSelectedIndex(-1);
            if (val.trim().length < 2) {
              abortRef.current?.abort();
              setGeoResults([]);
              setIsLoading(false);
            }
          }}
          onKeyDown={handleKeyDown}
          onFocus={(e) => {
            setIsExpanded(true);
            e.target.select();
          }}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          aria-label="Ort, Pin oder Zertifizierungen suchen"
        />

        {isLoading && (
          <div className={styles.loadingIndicator} aria-hidden="true">
            <div className={styles.spinner} />
          </div>
        )}

        {searchQuery && (
          <button
            className={styles.clearButton}
            onClick={() => {
              abortRef.current?.abort();
              setSearchQuery("");
              setGeoResults([]);
              setIsLoading(false);
              setSelectedIndex(-1);
              inputRef.current?.focus();
            }}
            aria-label="Eingabe löschen"
            type="button"
          >
            <svg
              width="14"
              height="14"
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
        )}
      </div>

      {(showSuggestions || showNoResults) && (
        <div
          className={styles.suggestions}
          ref={suggestionsRef}
          onClick={handleSuggestionsClick}
          role="listbox"
          aria-label="Suchvorschläge"
        >
          {showNoResults ? (
            <div className={styles.noResults}>
              <div className={styles.noResultsIcon}>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </div>
              <p>Keine Ergebnisse gefunden</p>
              <span>Versuchen Sie einen anderen Suchbegriff</span>
            </div>
          ) : (
            results.map((result, index) => {
              const isPin = result.placeId !== undefined;
              return (
                <div
                  key={result.id}
                  data-suggestion-index={index}
                  role="option"
                  aria-selected={index === selectedIndex}
                  className={`${styles.suggestionItem} ${
                    index === selectedIndex ? styles.selected : ""
                  }`}
                >
                  <div
                    className={`${styles.suggestionIcon} ${
                      isPin
                        ? styles.suggestionIconPin
                        : styles.suggestionIconGeo
                    }`}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div className={styles.suggestionContent}>
                    <div className={styles.suggestionTitleRow}>
                      <span
                        className={`${styles.suggestionBadge} ${
                          isPin
                            ? styles.suggestionBadgePin
                            : styles.suggestionBadgeGeo
                        }`}
                      >
                        {isPin ? "Audiopin" : "Ort"}
                      </span>
                      <div className={styles.suggestionTitle}>
                        {result.name}
                      </div>
                    </div>
                    {result.place_formatted && (
                      <div className={styles.suggestionMeta}>
                        {result.place_formatted}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
