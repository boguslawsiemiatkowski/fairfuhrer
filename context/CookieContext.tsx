"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { saveCookiePreferences } from "@/app/actions/cookies";
import {
  type CookiePreferences,
  defaultCookiePreferences,
} from "@/types/cookies";

export type { CookiePreferences };

interface CookieContextType {
  preferences: CookiePreferences;
  hasConsented: boolean;
  showBanner: boolean;
  /**
   * `true`, gdy baner otwarto przyciskiem „Cookies" (stopka) albo
   * „Cookie-Einstellungen ändern" (pod filmem) — wtedy pokazujemy od razu
   * widok z przełącznikami, bo użytkownik przyszedł je zmienić, a nie
   * zobaczyć pytanie o zgodę po raz pierwszy.
   */
  openDetails: boolean;
  updatePreferences: (preferences: Partial<CookiePreferences>) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  showSettings: () => void;
  hideBanner: () => void;
}

const CookieContext = createContext<CookieContextType | undefined>(undefined);

const STORAGE_KEY = "cookie-preferences";
const CONSENT_KEY = "cookie-consent-given";

function isValidCookiePreferences(obj: unknown): obj is CookiePreferences {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "necessary" in obj &&
    "functional" in obj &&
    "analytics" in obj &&
    typeof (obj as CookiePreferences).necessary === "boolean" &&
    typeof (obj as CookiePreferences).functional === "boolean" &&
    typeof (obj as CookiePreferences).analytics === "boolean"
  );
}

/** Bezpieczne operacje na localStorage — odporne na tryb prywatny Safari / SecurityError. */
function safeGetLocalStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignorujemy błąd zapisu w trybie prywatnym — stan Reacta i ciasteczko HTTP nadal działają.
  }
}

function safeRemoveLocalStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignorujemy błąd w trybie prywatnym
  }
}

/**
 * Aktualizuje Google Consent Mode v2 (`gtag('consent', 'update', ...)`).
 * Wywoływane zarówno przy kliknięciu w baner (`emitManualEvent = true`),
 * jak i przy starcie strony dla powracających użytkowników (`emitManualEvent = false`),
 * ponieważ skrypt `ga-consent-default` w `app/layout.tsx` przy każdym przeładowaniu
 * startuje od `denied` z `wait_for_update: 2000`.
 */
function syncGtagConsent(
  prefs: CookiePreferences,
  emitManualEvent: boolean
): void {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  if (emitManualEvent) {
    window.dataLayer.push({
      event: "consent_preferences_saved",
      consent_analytics: prefs.analytics,
      consent_functional: prefs.functional,
      consent_necessary: prefs.necessary,
      timestamp: new Date().toISOString(),
      integration: "nextjs_third_parties",
    });
  }

  const sendConsentToGtag = (p: CookiePreferences) => {
    const consentData = {
      analytics_storage: p.analytics ? "granted" : "denied",
      ad_storage: p.analytics ? "granted" : "denied",
      functionality_storage: p.functional ? "granted" : "denied",
      personalization_storage: p.functional ? "granted" : "denied",
    };

    window.gtag("consent", "update", consentData);

    if (emitManualEvent && p.analytics) {
      window.gtag("event", "manual_consent_granted", {
        event_category: "consent",
        event_label: "nextjs_manual_update",
        value: 1,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const checkGtagAvailability = (
    attempt = 0,
    maxAttempts = 5,
    delay = 100
  ) => {
    if (typeof window.gtag === "function") {
      sendConsentToGtag(prefs);
    } else if (attempt < maxAttempts) {
      setTimeout(() => {
        checkGtagAvailability(attempt + 1, maxAttempts, delay * 2);
      }, delay);
    }
  };

  checkGtagAvailability();
}

export function CookieProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] =
    useState<CookiePreferences>(defaultCookiePreferences);
  const [hasConsented, setHasConsented] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [openDetails, setOpenDetails] = useState(false);

  useEffect(() => {
    try {
      const cookieValue = document.cookie
        .split("; ")
        .find((row) => row.startsWith("cookie-preferences="))
        ?.split("=")
        .slice(1)
        .join("=");

      let parsedPreferences: CookiePreferences | null = null;

      if (cookieValue) {
        try {
          const decoded = decodeURIComponent(cookieValue);
          const parsed = JSON.parse(decoded);
          if (isValidCookiePreferences(parsed)) {
            parsedPreferences = parsed;
          }
        } catch (error) {
          console.error("Failed to parse cookie preferences:", error);
        }
      }

      if (!parsedPreferences) {
        const savedPreferences = safeGetLocalStorage(STORAGE_KEY);
        if (savedPreferences) {
          try {
            const parsed = JSON.parse(savedPreferences);
            if (isValidCookiePreferences(parsed)) {
              parsedPreferences = parsed;
            } else {
              safeRemoveLocalStorage(STORAGE_KEY);
            }
          } catch {
            safeRemoveLocalStorage(STORAGE_KEY);
          }
        }
      }

      const consentGiven =
        document.cookie.includes("cookie-consent-given=true") ||
        safeGetLocalStorage(CONSENT_KEY) === "true";

      /* eslint-disable react-hooks/set-state-in-effect */
      if (consentGiven && parsedPreferences) {
        setPreferences(parsedPreferences);
        setHasConsented(true);
        setShowBanner(false);
        // Przywróć stan Google Consent Mode v2 dla powracającego użytkownika
        syncGtagConsent(parsedPreferences, false);
      } else {
        setShowBanner(true);
      }
    } catch (error) {
      console.error("Error loading cookie preferences:", error);
      setShowBanner(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (isValidCookiePreferences(parsed)) {
            setPreferences(parsed);
            syncGtagConsent(parsed, false);
          }
        } catch (error) {
          console.error(
            "Failed to parse preferences from storage event:",
            error
          );
        }
      } else if (e.key === CONSENT_KEY) {
        setHasConsented(e.newValue === "true");
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const savePreferences = useCallback(
    async (newPreferences: CookiePreferences) => {
      const normalized: CookiePreferences = {
        necessary: true,
        functional: Boolean(newPreferences.functional),
        analytics: Boolean(newPreferences.analytics),
      };

      // Najpierw aktualizujemy stan Reacta, aby baner zamknął się natychmiast
      // nawet w restrykcyjnym trybie prywatnym przeglądarki.
      setPreferences(normalized);
      setHasConsented(true);

      safeSetLocalStorage(STORAGE_KEY, JSON.stringify(normalized));
      safeSetLocalStorage(CONSENT_KEY, "true");

      syncGtagConsent(normalized, true);

      try {
        await saveCookiePreferences(normalized);
      } catch (error) {
        console.error("Failed to save preferences to server:", error);
      }
    },
    []
  );

  const updatePreferences = useCallback(
    (newPreferences: Partial<CookiePreferences>) => {
      const updated = { ...preferences, ...newPreferences, necessary: true };
      savePreferences(updated);
    },
    [preferences, savePreferences]
  );

  const acceptAll = useCallback(() => {
    const allAccepted: CookiePreferences = {
      necessary: true,
      functional: true,
      analytics: true,
    };
    setShowBanner(false);
    setOpenDetails(false);
    savePreferences(allAccepted);
  }, [savePreferences]);

  const rejectAll = useCallback(() => {
    const onlyNecessary: CookiePreferences = {
      necessary: true,
      functional: false,
      analytics: false,
    };
    setShowBanner(false);
    setOpenDetails(false);
    savePreferences(onlyNecessary);
  }, [savePreferences]);

  // Otwarcie przyciskiem „Cookies" / „Cookie-Einstellungen ändern" prowadzi
  // od razu do przełączników: kto klika ten przycisk, chce zmienić wybór,
  // a nie przeczytać pytanie o zgodę po raz drugi.
  const showSettings = useCallback(() => {
    setOpenDetails(true);
    setShowBanner(true);
  }, []);

  const hideBanner = useCallback(() => {
    setShowBanner(false);
    setOpenDetails(false);
  }, []);

  const contextValue = useMemo(
    () => ({
      preferences,
      hasConsented,
      showBanner,
      openDetails,
      updatePreferences,
      acceptAll,
      rejectAll,
      showSettings,
      hideBanner,
    }),
    [
      preferences,
      hasConsented,
      showBanner,
      openDetails,
      updatePreferences,
      acceptAll,
      rejectAll,
      showSettings,
      hideBanner,
    ]
  );

  return (
    <CookieContext.Provider value={contextValue}>
      {children}
    </CookieContext.Provider>
  );
}

export function useCookies() {
  const context = useContext(CookieContext);
  if (context === undefined) {
    throw new Error("useCookies must be used within a CookieProvider");
  }
  return context;
}
