// fairfuhrer/app/components/CookieBanner.tsx
"use client";

import React, { useState } from "react";
import { useCookies } from "../context/CookieContext";
import styles from "./CookieBanner.module.css";

export default function CookieBanner() {
  const {
    showBanner,
    acceptAll,
    rejectAll,
    updatePreferences,
    preferences,
    hideBanner,
  } = useCookies();
  const [showDetails, setShowDetails] = useState(false);
  const [tempPreferences, setTempPreferences] = useState(preferences);

  if (!showBanner) return null;

  const handleSavePreferences = () => {
    updatePreferences(tempPreferences);
    hideBanner();
  };

  const toggleDetails = () => {
    setShowDetails(!showDetails);
    setTempPreferences(preferences);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.banner}>
        <div className={styles.content}>
          <h3 className={styles.title}>Cookie-Einstellungen</h3>

          {!showDetails ? (
            <>
              <p className={styles.description}>
                Wir verwenden Cookies, um Ihnen die bestmögliche Erfahrung auf
                unserer Website zu bieten. Einige Cookies sind für das
                Funktionieren der Website erforderlich, während andere uns
                helfen, unsere Dienste zu verbessern.
              </p>

              <div className={styles.actions}>
                <button
                  className={styles.buttonSecondary}
                  onClick={toggleDetails}
                >
                  Einstellungen
                </button>
                <button className={styles.buttonSecondary} onClick={rejectAll}>
                  Nur notwendige
                </button>
                <button className={styles.buttonPrimary} onClick={acceptAll}>
                  Alle akzeptieren
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.cookieDetails}>
                <div className={styles.cookieCategory}>
                  <div className={styles.categoryHeader}>
                    <h4>Notwendige Cookies</h4>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={true}
                        disabled
                        className={styles.checkbox}
                        aria-label="Notwendige Cookies sind immer aktiviert"
                        title="Notwendige Cookies können nicht deaktiviert werden"
                      />
                      <span className={styles.visuallyHidden}>
                        Notwendige Cookies sind immer aktiviert
                      </span>
                    </label>
                  </div>
                  <p className={styles.categoryDescription}>
                    Diese Cookies sind für das Funktionieren der Website
                    erforderlich. Dazu gehören PayPal für Zahlungen und Mapbox
                    für Kartenanzeige.
                  </p>
                  <div className={styles.cookieList}>
                    <span className={styles.cookieTag}>PayPal</span>
                    <span className={styles.cookieTag}>Mapbox</span>
                    <span className={styles.cookieTag}>Supabase</span>
                    <span className={styles.cookieTag}>Directus</span>
                  </div>
                </div>

                <div className={styles.cookieCategory}>
                  <div className={styles.categoryHeader}>
                    <h4>Funktionale Cookies</h4>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={tempPreferences.functional}
                        onChange={(e) =>
                          setTempPreferences({
                            ...tempPreferences,
                            functional: e.target.checked,
                          })
                        }
                        className={styles.checkbox}
                        aria-label="Funktionale Cookies aktivieren oder deaktivieren"
                        title="Funktionale Cookies für erweiterte Funktionen wie Videos"
                      />
                      <span className={styles.visuallyHidden}>
                        Funktionale Cookies{" "}
                        {tempPreferences.functional
                          ? "aktiviert"
                          : "deaktiviert"}
                      </span>
                    </label>
                  </div>
                  <p className={styles.categoryDescription}>
                    Diese Cookies ermöglichen erweiterte Funktionen wie
                    Videostreaming und verbessern Ihr Benutzererlebnis.
                  </p>
                  <div className={styles.cookieList}>
                    <span className={styles.cookieTag}>Mux</span>
                  </div>
                </div>

                <div className={styles.cookieCategory}>
                  <div className={styles.categoryHeader}>
                    <h4>Analytische Cookies</h4>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={tempPreferences.analytics}
                        onChange={(e) =>
                          setTempPreferences({
                            ...tempPreferences,
                            analytics: e.target.checked,
                          })
                        }
                        className={styles.checkbox}
                        aria-label="Analytische Cookies aktivieren oder deaktivieren"
                        title="Analytische Cookies für Website-Analysen und Nutzerverhalten"
                      />
                      <span className={styles.visuallyHidden}>
                        Analytische Cookies{" "}
                        {tempPreferences.analytics
                          ? "aktiviert"
                          : "deaktiviert"}
                      </span>
                    </label>
                  </div>
                  <p className={styles.categoryDescription}>
                    Diese Cookies helfen uns zu verstehen, wie Besucher mit der
                    Website interagieren, und ermöglichen es uns, die
                    Nutzererfahrung zu verbessern. Dazu gehören auch Tools zur
                    Analyse des Nutzerverhaltens.
                  </p>
                  <div className={styles.cookieList}>
                    <span className={styles.cookieTag}>Google Analytics</span>
                    <span className={styles.cookieTag}>Google Tag</span>
                  </div>
                </div>
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  onClick={toggleDetails}
                >
                  Zurück
                </button>
                <button
                  type="button"
                  className={styles.buttonPrimary}
                  onClick={handleSavePreferences}
                >
                  Einstellungen speichern
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
