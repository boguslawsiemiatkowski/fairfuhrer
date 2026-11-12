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

function trackPreferencesChange(prefs: CookiePreferences): void {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "consent_preferences_saved",
    consent_analytics: prefs.analytics,
    consent_functional: prefs.functional,
    consent_necessary: prefs.necessary,
    timestamp: new Date().toISOString(),
    integration: "nextjs_third_parties",
  });

  const sendConsentToGtag = (p: CookiePreferences) => {
    const consentData = {
      analytics_storage: p.analytics ? "granted" : "denied",
      ad_storage: p.analytics ? "granted" : "denied",
      functionality_storage: p.functional ? "granted" : "denied",
      personalization_storage: p.functional ? "granted" : "denied",
    };

    window.gtag("consent", "update", consentData);

    if (p.analytics) {
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
    } else {
      console.warn(
        "window.gtag not available after multiple checks. GA may not be loaded."
      );
    }
  };

  checkGtagAvailability();
}

export function CookieProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] =
    useState<CookiePreferences>(defaultCookiePreferences);
  const [hasConsented, setHasConsented] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

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
        const savedPreferences = localStorage.getItem(STORAGE_KEY);
        if (savedPreferences) {
          try {
            const parsed = JSON.parse(savedPreferences);
            if (isValidCookiePreferences(parsed)) {
              parsedPreferences = parsed;
            } else {
              console.warn("Invalid preferences format in localStorage");
              localStorage.removeItem(STORAGE_KEY);
            }
          } catch (error) {
            console.error("Failed to parse localStorage preferences:", error);
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      }

      const consentGiven =
        document.cookie.includes("cookie-consent-given=true") ||
        localStorage.getItem(CONSENT_KEY) === "true";

      /* eslint-disable react-hooks/set-state-in-effect */
      if (consentGiven && parsedPreferences) {
        setPreferences(parsedPreferences);
        setHasConsented(true);
        setShowBanner(false);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
      localStorage.setItem(CONSENT_KEY, "true");

      try {
        await saveCookiePreferences(newPreferences);
      } catch (error) {
        console.error("Failed to save preferences to server:", error);
      }

      setPreferences(newPreferences);
      setHasConsented(true);

      trackPreferencesChange(newPreferences);
    },
    []
  );

  const updatePreferences = useCallback(
    (newPreferences: Partial<CookiePreferences>) => {
      const updated = { ...preferences, ...newPreferences };
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
    savePreferences(allAccepted);
    setShowBanner(false);
  }, [savePreferences]);

  const rejectAll = useCallback(() => {
    const onlyNecessary: CookiePreferences = {
      necessary: true,
      functional: false,
      analytics: false,
    };
    savePreferences(onlyNecessary);
    setShowBanner(false);
  }, [savePreferences]);

  const showSettings = useCallback(() => {
    setShowBanner(true);
  }, []);

  const hideBanner = useCallback(() => {
    setShowBanner(false);
  }, []);

  const contextValue = useMemo(
    () => ({
      preferences,
      hasConsented,
      showBanner,
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
