// components/MapSearch.tsx
"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useDebounce } from "../hooks/useDebounce";
import {
  buildSearchIndex,
  searchIndexedPins,
  fetchMapboxSuggestions,
  type SearchSuggestion as Suggestion,
} from "../utils/placeSearch";
import type { Place } from "../types/map";
import styles from "./MapSearch.module.css";

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

    abortRef.current?.abort();
    const currentAbort = new AbortController();
    abortRef.current = currentAbort;

    const fetchSuggestions = async () => {
      await Promise.resolve();
      setIsLoading(true);

      try {
        const suggestions = await fetchMapboxSuggestions(
          debouncedQuery,
          currentAbort.signal,
        );
        if (currentAbort.signal.aborted) return;
        setGeoResults(suggestions);
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
