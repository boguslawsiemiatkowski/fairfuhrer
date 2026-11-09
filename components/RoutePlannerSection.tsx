// components/RoutePlannerSection.tsx
"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Route,
  X,
  LocateFixed,
  Search,
  MousePointerClick,
  Footprints,
  Bike,
  Car,
  Info,
  AlertCircle,
  Maximize2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useDebounce } from "../hooks/useDebounce";
import {
  buildSearchIndex,
  searchIndexedPins,
  fetchMapboxSuggestions,
  type SearchSuggestion,
} from "../utils/placeSearch";
import { formatDistance } from "../lib/orte-shared";
import {
  formatDuration,
  type RouteOrigin,
  type RouteProfile,
  type RouteResult,
  type RouteStatus,
} from "../hooks/useMapboxRoute";
import type { Place } from "../types";
import styles from "./RoutePlannerSection.module.css";

interface RoutePlannerSectionProps {
  destination: Place;
  allPlaces: Place[];
  profile: RouteProfile;
  origin: RouteOrigin | null;
  status: RouteStatus;
  errorMessage: string | null;
  infoNotice: string | null;
  routeResult: RouteResult | null;
  isOriginFarForActiveMobility: boolean;
  onChangeProfile: (profile: RouteProfile) => void;
  onSelectGpsOrigin: () => void;
  onSelectCustomOrigin: (origin: RouteOrigin) => void;
  onStartPickingOnMap: () => void;
  onCancelPickingOnMap: () => void;
  onFitRouteBounds: () => void;
  onCloseRoute: () => void;
}

export default function RoutePlannerSection({
  destination,
  allPlaces,
  profile,
  origin,
  status,
  errorMessage,
  infoNotice,
  routeResult,
  isOriginFarForActiveMobility,
  onChangeProfile,
  onSelectGpsOrigin,
  onSelectCustomOrigin,
  onStartPickingOnMap,
  onCancelPickingOnMap,
  onFitRouteBounds,
  onCloseRoute,
}: RoutePlannerSectionProps) {
  const [showOriginSearch, setShowOriginSearch] = useState(false);
  const [originQuery, setOriginQuery] = useState("");
  const [geoSuggestions, setGeoSuggestions] = useState<SearchSuggestion[]>([]);
  const [isSearchingGeo, setIsSearchingGeo] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debouncedOriginQuery = useDebounce(originQuery.trim(), 300);

  const indexedPlaces = useMemo(
    () => buildSearchIndex(allPlaces),
    [allPlaces],
  );

  // Natychmiastowe wyszukiwanie lokalnych pinów (z wykluczeniem obecnego celu)
  const { directPins, cityOnlyPins } = useMemo(
    () => searchIndexedPins(originQuery, indexedPlaces, destination.id),
    [originQuery, indexedPlaces, destination.id],
  );

  // Wyszukiwanie miast i adresów w Mapbox Geocoding v6
  useEffect(() => {
    if (!showOriginSearch || debouncedOriginQuery.length < 2) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const run = async () => {
      await Promise.resolve();
      setIsSearchingGeo(true);
      try {
        const res = await fetchMapboxSuggestions(
          debouncedOriginQuery,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setGeoSuggestions(res);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingGeo(false);
        }
      }
    };

    run();
    return () => controller.abort();
  }, [showOriginSearch, debouncedOriginQuery]);

  const combinedSuggestions = useMemo(
    () => [...directPins, ...geoSuggestions, ...cityOnlyPins],
    [directPins, geoSuggestions, cityOnlyPins],
  );

  const handleChooseSuggestion = (item: SearchSuggestion) => {
    const isPin = item.placeId !== undefined;
    onSelectCustomOrigin({
      type: isPin ? "pin" : "place",
      label: item.name,
      sublabel: item.place_formatted || undefined,
      coords: [item.lon, item.lat],
      placeId: item.placeId,
    });
    setShowOriginSearch(false);
    setOriginQuery("");
    setGeoSuggestions([]);
  };

  return (
    <section
      className={styles.plannerContainer}
      aria-label="Routenplaner auf der Karte"
    >
      <div className={styles.plannerHeader}>
        <div className={styles.plannerTitleGroup}>
          <Route size={18} aria-hidden="true" />
          <h3 className={styles.plannerTitle}>Routenplaner</h3>
        </div>

        <button
          type="button"
          className={styles.closeRouteBtn}
          onClick={onCloseRoute}
          title="Routenplaner schließen und Route von der Karte entfernen"
        >
          <X size={14} aria-hidden="true" />
          <span>Beenden</span>
        </button>
      </div>

      {/* Podgląd punktów Start -> Ziel */}
      <div className={styles.waypointsBox}>
        <div className={styles.waypointRow}>
          <span className={styles.badgeStart}>Start</span>
          <div className={styles.waypointInfo}>
            {origin ? (
              <>
                <span className={styles.waypointLabel}>{origin.label}</span>
                {origin.sublabel && (
                  <span className={styles.waypointSublabel}>
                    {origin.sublabel}
                  </span>
                )}
              </>
            ) : (
              <span className={styles.waypointPlaceholder}>
                Noch kein Startpunkt gewählt (siehe Schritt 1 unten)
              </span>
            )}
          </div>
        </div>

        <div className={styles.waypointDivider} aria-hidden="true" />

        <div className={styles.waypointRow}>
          <span className={styles.badgeDest}>Ziel</span>
          <div className={styles.waypointInfo}>
            <span className={styles.waypointLabel}>{destination.Name}</span>
            <span className={styles.waypointSublabel}>
              {[destination.Stadt, destination.Adresse]
                .filter(Boolean)
                .join(", ")}
            </span>
          </div>
        </div>
      </div>

      {/* Krok 1: Wybór punktu startowego */}
      <span className={styles.stepLabel}>1. Startpunkt wählen oder ändern</span>
      <div className={styles.originButtonsGrid}>
        <button
          type="button"
          className={`${styles.originOptionBtn} ${
            origin?.type === "gps" && !showOriginSearch && status !== "picking-on-map"
              ? styles.originOptionBtnActive
              : ""
          }`}
          onClick={() => {
            setShowOriginSearch(false);
            onSelectGpsOrigin();
          }}
        >
          <LocateFixed size={16} aria-hidden="true" />
          <span>Mein GPS</span>
        </button>

        <button
          type="button"
          className={`${styles.originOptionBtn} ${
            showOriginSearch ||
            ((origin?.type === "pin" || origin?.type === "place") &&
              status !== "picking-on-map")
              ? styles.originOptionBtnActive
              : ""
          }`}
          onClick={() => {
            if (status === "picking-on-map") {
              onCancelPickingOnMap();
            }
            const nextOpen = !showOriginSearch;
            setShowOriginSearch(nextOpen);
            if (nextOpen) {
              setTimeout(() => searchInputRef.current?.focus(), 40);
            }
          }}
        >
          <Search size={16} aria-hidden="true" />
          <span>Ort / Pin suchen</span>
        </button>

        <button
          type="button"
          className={`${styles.originOptionBtn} ${
            status === "picking-on-map" ||
            (origin?.type === "map-click" && !showOriginSearch)
              ? styles.originOptionBtnActive
              : ""
          }`}
          onClick={() => {
            setShowOriginSearch(false);
            if (status === "picking-on-map") {
              onCancelPickingOnMap();
            } else {
              onStartPickingOnMap();
            }
          }}
        >
          <MousePointerClick size={16} aria-hidden="true" />
          <span>Auf Karte tippen</span>
        </button>
      </div>

      {/* Rozwijane pole wyszukiwania punktu startowego (inny pin lub miasto/adres) */}
      {showOriginSearch && (
        <div className={styles.originSearchBox}>
          <div className={styles.originSearchInputWrap}>
            <input
              ref={searchInputRef}
              type="text"
              className={styles.originSearchInput}
              placeholder="Stadt, Adresse oder anderen Pin eingeben…"
              value={originQuery}
              onChange={(e) => {
                const val = e.target.value;
                setOriginQuery(val);
                if (val.trim().length < 2) {
                  abortRef.current?.abort();
                  setGeoSuggestions([]);
                  setIsSearchingGeo(false);
                }
              }}
              aria-label="Startpunkt suchen"
            />
            {originQuery && (
              <button
                type="button"
                className={styles.originSearchClear}
                onClick={() => {
                  setOriginQuery("");
                  setGeoSuggestions([]);
                  searchInputRef.current?.focus();
                }}
                aria-label="Eingabe löschen"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          <p className={styles.originSearchHint}>
            Tipp: Suchen Sie nach einer Stadt (z.&nbsp;B. Lindau, Konstanz,
            Bregenz), einem Bahnhof oder einem anderen FairFührer-Pin als
            Startpunkt.
          </p>

          {originQuery.trim().length >= 2 && (
            <div className={styles.originSuggestionsList} role="listbox">
              {combinedSuggestions.length > 0 ? (
                combinedSuggestions.map((item) => {
                  const isPin = item.placeId !== undefined;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={styles.originSuggestionItem}
                      onClick={() => handleChooseSuggestion(item)}
                    >
                      <span
                        className={
                          isPin
                            ? styles.originSuggestionBadgePin
                            : styles.originSuggestionBadgeGeo
                        }
                      >
                        {isPin ? "Pin" : "Ort"}
                      </span>
                      <div className={styles.originSuggestionText}>
                        <div className={styles.originSuggestionName}>
                          {item.name}
                        </div>
                        {item.place_formatted && (
                          <div className={styles.originSuggestionMeta}>
                            {item.place_formatted}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className={styles.originSearchHint}>
                  {isSearchingGeo
                    ? "Vorschläge werden geladen…"
                    : "Keine passenden Orte oder Pins gefunden."}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Krok 2: Wybór środka transportu */}
      <span className={styles.stepLabel}>2. Verkehrsmittel wählen</span>
      <div className={styles.profilesRow} role="radiogroup" aria-label="Verkehrsmittel">
        <button
          type="button"
          role="radio"
          aria-checked={profile === "walking"}
          aria-disabled={isOriginFarForActiveMobility}
          title={
            isOriginFarForActiveMobility
              ? "Fußrouten sind nur bis 120 km Entfernung verfügbar"
              : "Route zu Fuß berechnen"
          }
          className={`${styles.profileTab} ${
            profile === "walking" ? styles.profileTabActive : ""
          } ${isOriginFarForActiveMobility ? styles.profileTabDisabled : ""}`}
          onClick={() => onChangeProfile("walking")}
        >
          <Footprints size={16} aria-hidden="true" />
          <span>Zu Fuß</span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={profile === "cycling"}
          aria-disabled={isOriginFarForActiveMobility}
          title={
            isOriginFarForActiveMobility
              ? "Fahrradrouten sind nur bis 120 km Entfernung verfügbar"
              : "Fahrradroute berechnen"
          }
          className={`${styles.profileTab} ${
            profile === "cycling" ? styles.profileTabActive : ""
          } ${isOriginFarForActiveMobility ? styles.profileTabDisabled : ""}`}
          onClick={() => onChangeProfile("cycling")}
        >
          <Bike size={16} aria-hidden="true" />
          <span>Fahrrad</span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={profile === "driving"}
          title="Autoroute berechnen"
          className={`${styles.profileTab} ${
            profile === "driving" ? styles.profileTabActive : ""
          }`}
          onClick={() => onChangeProfile("driving")}
        >
          <Car size={16} aria-hidden="true" />
          <span>Auto</span>
        </button>
      </div>

      {/* Instrukcja gdy użytkownik jeszcze nie wybrał punktu startowego */}
      {status === "idle" && !origin && !showOriginSearch && (
        <div className={styles.noticeBox} role="status">
          <Info size={16} className={styles.noticeIcon} aria-hidden="true" />
          <span>
            <strong>Wie möchten Sie starten?</strong> Wählen Sie oben unter{" "}
            <em>1. Startpunkt</em> entweder <strong>Mein GPS</strong>, suchen
            Sie über <strong>Ort / Pin suchen</strong> nach einem Ausgangspunkt
            oder klicken Sie auf <strong>Auf Karte tippen</strong>.
          </span>
        </div>
      )}

      {/* Aktywny tryb klikania punktu startowego na mapie */}
      {status === "picking-on-map" && (
        <div className={styles.pickingBanner} role="status" aria-live="polite">
          <div className={styles.pickingBannerRow}>
            <MousePointerClick
              size={17}
              className={styles.noticeIcon}
              aria-hidden="true"
            />
            <span>
              <strong>Kartenauswahl aktiv:</strong> Klicken Sie jetzt direkt auf
              eine beliebige Stelle oder einen Pin auf der Karte, um dort Ihren
              Startpunkt zu setzen.
            </span>
          </div>
          <div className={styles.pickingBannerActions}>
            <button
              type="button"
              className={styles.pickingCancelBtn}
              onClick={onCancelPickingOnMap}
            >
              Auswahl abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Stan pobierania lokalizacji GPS */}
      {status === "locating-gps" && (
        <div className={styles.loadingBox} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <span>
            Ihr GPS-Standort wird ermittelt… Bitte bestätigen Sie ggf. die
            Standortabfrage Ihres Browsers.
          </span>
        </div>
      )}

      {/* Stan obliczania trasy w Mapbox Directions */}
      {status === "loading-route" && (
        <div className={styles.loadingBox} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <span>Route wird berechnet und auf der Karte eingezeichnet…</span>
        </div>
      )}

      {/* Informacja wyjaśniająca ograniczenie (np. > 120 km dla Zu Fuß / Fahrrad) */}
      {infoNotice && (
        <div className={styles.noticeBox} role="status" aria-live="polite">
          <Info size={16} className={styles.noticeIcon} aria-hidden="true" />
          <span>{infoNotice}</span>
        </div>
      )}

      {/* Wyraźny komunikat błędu wyjaśniający przyczynę i alternatywne rozwiązanie */}
      {status === "error" && errorMessage && (
        <div className={styles.errorBox} role="alert">
          <AlertCircle
            size={16}
            className={styles.noticeIcon}
            aria-hidden="true"
          />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Karta z wynikiem obliczonej trasy oraz nawigacją krok po kroku */}
      {status === "ready" && routeResult && (
        <div className={styles.resultCard}>
          <div className={styles.resultSummaryRow}>
            <div className={styles.metricsGroup}>
              <span className={styles.durationValue}>
                {formatDuration(routeResult.durationSeconds)}
              </span>
              <span className={styles.distanceValue}>
                {formatDistance(routeResult.distanceMeters)}
              </span>
            </div>

            <button
              type="button"
              className={styles.fitBoundsBtn}
              onClick={onFitRouteBounds}
              title="Kartenansicht auf die gesamte Route zentrieren"
            >
              <Maximize2 size={13} aria-hidden="true" />
              <span>Ganze Route zeigen</span>
            </button>
          </div>

          {routeResult.steps.length > 0 && (
            <>
              <button
                type="button"
                className={styles.stepsToggleBtn}
                onClick={() => setShowSteps((prev) => !prev)}
                aria-expanded={showSteps}
              >
                <span>
                  Wegbeschreibung ({routeResult.steps.length} Schritte)
                </span>
                {showSteps ? (
                  <ChevronUp size={15} aria-hidden="true" />
                ) : (
                  <ChevronDown size={15} aria-hidden="true" />
                )}
              </button>

              {showSteps && (
                <ol className={styles.stepsList}>
                  {routeResult.steps.map((step, idx) => (
                    <li key={idx} className={styles.stepItem}>
                      <span className={styles.stepIndex}>{idx + 1}</span>
                      <span className={styles.stepInstruction}>
                        {step.instruction}
                      </span>
                      {step.distanceMeters > 0 && (
                        <span className={styles.stepDistance}>
                          {formatDistance(step.distanceMeters)}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
