// app/actions/cookies.ts
"use server";

import { cookies } from "next/headers";
import type { CookiePreferences } from "@/types/cookies";

/**
 * Server Action to save cookie preferences
 * Uses Next.js async cookies() API for server-side cookie management with security options
 */
export async function saveCookiePreferences(
  preferences: CookiePreferences
): Promise<void> {
  const cookieStore = await cookies();

  // Jawna normalizacja wejścia po stronie serwera — chroni przed zapisaniem
  // nadmiarowych lub nieprawidłowych właściwości w ciasteczku JSON.
  const sanitizedPreferences: CookiePreferences = {
    necessary: true,
    functional: Boolean(preferences?.functional),
    analytics: Boolean(preferences?.analytics),
  };

  // Cookie options for security and longevity
  const cookieOptions = {
    httpOnly: false, // Must be false so client-side JS can read it on hydration
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "lax" as const, // CSRF protection on POST while sent on top-level external GET navigation
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  };

  // Save preferences as JSON
  cookieStore.set(
    "cookie-preferences",
    JSON.stringify(sanitizedPreferences),
    cookieOptions
  );

  // Save consent flag
  cookieStore.set("cookie-consent-given", "true", cookieOptions);
}

/**
 * Server Action to get cookie preferences
 * Returns null if preferences don't exist or are invalid
 */
export async function getCookiePreferences(): Promise<CookiePreferences | null> {
  const cookieStore = await cookies();
  const preferencesCookie = cookieStore.get("cookie-preferences");

  if (!preferencesCookie) {
    return null;
  }

  try {
    const parsed = JSON.parse(preferencesCookie.value);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.necessary === "boolean" &&
      typeof parsed.functional === "boolean" &&
      typeof parsed.analytics === "boolean"
    ) {
      return {
        necessary: true,
        functional: parsed.functional,
        analytics: parsed.analytics,
      };
    }

    return null;
  } catch (error) {
    console.error("Failed to parse cookie preferences:", error);
    return null;
  }
}

/**
 * Server Action to check if user has given consent
 */
export async function hasUserConsented(): Promise<boolean> {
  const cookieStore = await cookies();
  const consentCookie = cookieStore.get("cookie-consent-given");
  return consentCookie?.value === "true";
}

/**
 * Server Action to delete cookie preferences
 */
export async function deleteCookiePreferences(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({ name: "cookie-preferences", path: "/" });
  cookieStore.delete({ name: "cookie-consent-given", path: "/" });
}
