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
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

function normalizeSearch(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .trim();
}

function searchLocalPins(query: string, places: Place[]): Suggestion[] {
  const q = normalizeSearch(query);
  if (!q) return [];
  return places
    .filter((p) => {
      if (!p.location?.coordinates) return false;
      const haystack = normalizeSearch(
        `${p.Name ?? ""} ${p.Stadt ?? ""} ${p.Adresse ?? ""}`,
      );
      return haystack.includes(q);
    })
    .map((p) => ({
      id: `pin-${p.id}`,
      name: p.Name ?? "",
      place_formatted: [p.Stadt, p.Land].filter(Boolean).join(", "),
      lat: p.location.coordinates[1],
      lon: p.location.coordinates[0],
      bbox: null,
      feature_type: "pin",
      placeId: p.id,
    }));
}

export default function MapSearch({
  onLocationSelect,
  onPinSelect,
  places = [],
  disabled = false,
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
      // Unikamy synchronicznego wywołania setState wewnątrz useEffect za pomocą Promise.resolve()
      await Promise.resolve();
      setIsLoading(true);

      const url =
        `https://api.mapbox.com/search/geocode/v6/forward` +
        `?q=${encodeURIComponent(debouncedQuery)}` +
        `&language=de` +
        `&limit=6` +
        `&types=country,region,district,place` +
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

  // Lokale Pin-Treffer (synchron, vom Parent übergeben) zuerst, dann
  // geografische Mapbox-Ergebnisse.
  const localPinResults = useMemo(
    () => searchLocalPins(debouncedQuery, places),
    [debouncedQuery, places],
  );
  const results = useMemo(
    () => [...localPinResults, ...geoResults],
    [localPinResults, geoResults],
  );

  const handleSelect = useCallback(
    (result: Suggestion) => {
      abortRef.current?.abort();
      if (result.placeId !== undefined) {
        // Lokaler Pin → Panel öffnen (Map-Zoom übernimmt der Parent).
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
      setTimeout(() => inputRef.current?.focus(), 200);
    } else {
      if (!searchQuery.trim()) {
        setIsExpanded(false);
        setSelectedIndex(-1);
      } else {
        inputRef.current?.focus();
      }
    }
  }, [disabled, isExpanded, searchQuery]);

  // Delegacja zdarzeń kliknięcia na poziomie listy podpowiedzi — unika tworzenia domknięć
  // odwołujących się do refów wewnątrz .map() podczas renderowania (reguła react-hooks/refs).
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
        case "Escape":
          e.preventDefault();
          abortRef.current?.abort();
          setSearchQuery("");
          setIsExpanded(false);
          setGeoResults([]);
          setIsLoading(false);
          setSelectedIndex(-1);
          inputRef.current?.blur();
          break;
      }
    },
    [isExpanded, results, selectedIndex, handleSelect],
  );

  // Close on outside click
  useEffect(() => {
    if (!isExpanded) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  const showSuggestions = isExpanded && debouncedQuery.length >= 2 && results.length > 0;
  const showNoResults =
    isExpanded &&
    debouncedQuery.length >= 2 &&
    !isLoading &&
    results.length === 0 &&
    geoResults.length === 0;

  return (
    <div
      ref={containerRef}
      className={`${styles.searchContainer} ${isExpanded ? styles.expanded : ""} ${
        disabled ? styles.disabled : ""
      }`}
    >
      <div className={styles.searchBox}>
        <button
          className={styles.searchIcon}
          onClick={handleSearchIconClick}
          disabled={disabled}
          aria-label="Suche öffnen"
          type="button"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>

        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder="Stadt, Region oder Pin suchen…"
          value={searchQuery}
          onChange={(e) => {
            const val = e.target.value;
            setSearchQuery(val);
            setSelectedIndex(-1);
            if (val.trim().length < 2) {
              abortRef.current?.abort();
              setGeoResults([]);
              setIsLoading(false);
            }
          }}
          onKeyDown={handleKeyDown}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
        />

        {isLoading && (
          <div className={styles.loadingIndicator}>
            <div className={styles.spinner} />
          </div>
        )}

        {isExpanded && searchQuery && (
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
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
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
        >
          {showNoResults ? (
            <div className={styles.noResults}>
              <div className={styles.noResultsIcon}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </div>
              <p>Keine Ergebnisse</p>
              <span>Versuchen Sie einen anderen Suchbegriff</span>
            </div>
          ) : (
            results.map((result, index) => {
              const isPin = result.placeId !== undefined;
              return (
                <div
                  key={result.id}
                  data-suggestion-index={index}
                  className={`${styles.suggestionItem} ${
                    index === selectedIndex ? styles.selected : ""
                  }`}
                >
                  <div className={styles.suggestionIcon}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div className={styles.suggestionContent}>
                    <div className={styles.suggestionTitleRow}>
                      <span
                        className={`${styles.suggestionBadge} ${
                          isPin ? styles.suggestionBadgePin : styles.suggestionBadgeGeo
                        }`}
                      >
                        {isPin ? "Pin" : "Ort"}
                      </span>
                      <div className={styles.suggestionTitle}>{result.name}</div>
                    </div>
                    {result.place_formatted && (
                      <div className={styles.suggestionMeta}>{result.place_formatted}</div>
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
