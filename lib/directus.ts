// lib/directus.ts
// ✅ Server-only protection - prevents accidental client-side imports
import "server-only";

import type {
  HomePageContent,
  PartnerWerdenContent,
  ContactFormContent,
  PremiumPageContent,
  PremiumComparisonFeature,
  AccountContactFormContent,
  RedaktionPageContent,
  RegisterPageContent,
  UeberUnsContent,
} from "@/types";

// ========================================
// Environment Variable Validation
// ========================================

import { getDirectusEnv } from "./env";

/**
 * Adres i token Directusa, sprawdzane przy pierwszym użyciu.
 *
 * ⚠ Świadomie `getDirectusEnv()`, a NIE `getServerEnv()`: ten moduł importuje
 * 11 stron (strona główna, /agb, /datenschutz, /impressum, /ueber-uns,
 * /partner-werden …). Walidacja wszystkich zmiennych naraz oznaczałaby, że brak
 * np. sekretu PayPala wywraca całą witrynę, choć strony treściowe o płatnościach
 * nic nie wiedzą.
 *
 * ⚠ Odczyt leniwy (wewnątrz funkcji, nie na poziomie modułu), żeby `next build`
 * nie wymagał tych zmiennych już na etapie zbierania tras.
 */
function getDirectusConfig(): { url: string; token?: string } {
  const env = getDirectusEnv();
  return { url: env.DIRECTUS_URL, token: env.DIRECTUS_TOKEN };
}

// ========================================
// Wspólne helpery komunikacji z Directus REST API
// ========================================
//
// Wszystkie zapytania poniżej idą przez natywny `fetch`, a nie przez Directus SDK:
// tylko w ten sposób działa `next: { revalidate, tags }`, czyli ISR oraz
// inwalidacja tagów wywoływana przez Directus Flows (POST /api/revalidate).

interface DirectusFetchOptions {
  /** Tag cache dla Next.js ISR (np. "home-page"). */
  tag: string;
  /** Czas życia cache w sekundach (domyślnie 3600 = 1h). */
  revalidate?: number;
  /** Wymusza pominięcie cache (`cache: "no-store"`), również na produkcji. */
  noStore?: boolean;
  /** Czytelna nazwa zasobu do logowania błędów. */
  label: string;
}

function buildHeaders(token?: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/**
 * Pobiera pojedynczy obiekt z Directusa (zarówno dla kolekcji typu Singleton,
 * gdzie `data.data` jest obiektem, jak i dla kolekcji tablicowych z `limit=1`,
 * gdzie `data.data` jest tablicą jednoelementową).
 */
async function fetchDirectusSingle<T>(
  path: string,
  { tag, revalidate = 3600, noStore = false, label }: DirectusFetchOptions,
): Promise<T | null> {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const { url, token } = getDirectusConfig();
    const response = await fetch(`${url}${path}`, {
      headers: buildHeaders(token),
      ...(isDev || noStore
        ? { cache: "no-store" as const }
        : { next: { revalidate, tags: [tag] } }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(
        `Failed to fetch ${label}: ${response.status} ${response.statusText} — ${body}`,
      );
    }

    const data = await response.json();
    if (!data?.data) return null;

    return ((Array.isArray(data.data) ? data.data[0] : data.data) as T) ?? null;
  } catch (error) {
    console.error(`Error fetching ${label}:`, error);
    return null;
  }
}

/**
 * Pobiera listę rekordów z Directusa z obsługą ISR i bezpiecznym fallbackiem do `[]`.
 */
async function fetchDirectusList<T>(
  path: string,
  { tag, revalidate = 3600, noStore = false, label }: DirectusFetchOptions,
): Promise<T[]> {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const { url, token } = getDirectusConfig();
    const response = await fetch(`${url}${path}`, {
      headers: buildHeaders(token),
      ...(isDev || noStore
        ? { cache: "no-store" as const }
        : { next: { revalidate, tags: [tag] } }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(
        `Failed to fetch ${label}: ${response.status} ${response.statusText} — ${body}`,
      );
    }

    const data = await response.json();
    return Array.isArray(data?.data) ? (data.data as T[]) : [];
  } catch (error) {
    console.error(`Error fetching ${label}:`, error);
    return [];
  }
}

// ========================================
// STRONA GŁÓWNA, MITMACHEN & MAPA
// ========================================

export async function getHomePageContent(): Promise<HomePageContent | null> {
  // Rozwijamy pola obrazów o modified_on — używane jako cache-buster w URL
  // (podmiana pliku pod tym samym UUID inaczej zostaje w 30-dniowym cache).
  //
  // width/height pobieramy, bo `next/image` wymaga wymiarów. Directus zna je
  // z metadanych pliku, więc nie trzeba ich wpisywać w kodzie ani rezygnować
  // z optymalizacji: wcześniej oba obrazy szły surowym <img>, czyli bez
  // zmiany rozmiaru i bez lazy-loadingu (partner_image ma 3471×3471 px).
  //
  // ISR + tag "home-page": Directus Flow "Home Page" woła POST /api/revalidate
  // po każdej zmianie w home_page_content.
  // `hero_audiopin` ist eine Relation auf `Orte` und wird gleich mitgeladen:
  // Audio, Titelbild samt Maßen und die erste Kategorie für die Farbe. Ein
  // zweiter Aufruf wäre unnötig, weil alles an einem Datensatz hängt.
  return fetchDirectusSingle<HomePageContent>(
    "/items/home_page_content?fields=*" +
      // `traveler_image` wird nicht mehr geladen — der lange Traveler-Block
      // ist dem kurzen Mission-Block gewichen. Das Feld bleibt in Directus.
      ",partner_image.id,partner_image.modified_on,partner_image.width,partner_image.height" +
      ",app_icon.id,app_icon.modified_on,app_icon.width,app_icon.height" +
      ",liste_bild.id,liste_bild.modified_on,liste_bild.width,liste_bild.height" +
      ",karte_bild.id,karte_bild.modified_on,karte_bild.width,karte_bild.height" +
      // `mission_bild` wird nicht geladen: der Mission-Text steht unter dem
      // Film und kommt ohne eigenes Bild aus. Das Feld bleibt in Directus.
      ",hero_audiopin.id,hero_audiopin.Name,hero_audiopin.Stadt,hero_audiopin.Land,hero_audiopin.slug" +
      ",hero_audiopin.Audio,hero_audiopin.Audio_Datei,hero_audiopin.Hauptbild" +
      ",hero_audiopin.Titelbild.id,hero_audiopin.Titelbild.modified_on" +
      ",hero_audiopin.Titelbild.width,hero_audiopin.Titelbild.height" +
      ",hero_audiopin.Kategorie.Kategorie_id.id,hero_audiopin.Kategorie.Kategorie_id.Name" +
      ",hero_audiopin.Kategorie.Kategorie_id.Farbe" +
      "&limit=1",
    { tag: "home-page", revalidate: 3600, label: "home page content" },
  );
}

// Inhalte der neuen Partnerseite (`partner_werden_content`).
export async function getPartnerWerdenContent(options?: {
  noStore?: boolean;
  revalidate?: number;
}): Promise<PartnerWerdenContent | null> {
  // ⚠ Dateibeziehungen werden von `fields=*` NICHT aufgelöst — jede muss
  // einzeln stehen, sonst kommt nur die UUID ohne Maße und `modified_on`.
  return fetchDirectusSingle<PartnerWerdenContent>(
    "/items/partner_werden_content?fields=*" +
      ",app_icon.id,app_icon.modified_on,app_icon.width,app_icon.height" +
      ",zahlung_logo.id,zahlung_logo.modified_on,zahlung_logo.width,zahlung_logo.height" +
      ",seenergien_logo.id,seenergien_logo.modified_on" +
      ",seenergien_logo.width,seenergien_logo.height",
    {
      tag: "partner-werden",
      revalidate: options?.revalidate ?? 3600,
      noStore: options?.noStore ?? false,
      label: "partner werden content",
    },
  );
}

// ========================================
// KONTAKT (sekcja kontaktowa na /ueber-uns)
// ========================================

export async function getContactFormContent(): Promise<ContactFormContent | null> {
  return fetchDirectusSingle<ContactFormContent>(
    "/items/contact_form_content?fields=*",
    { tag: "contact-form", revalidate: 3600, label: "contact form content" },
  );
}

// ========================================
// STRONY PRAWNE (IMPRESSUM, DATENSCHUTZ, AGB)
// ========================================

export interface ImpressumNew {
  id: string;
  date_updated: string | null;
  content: string;
}

export async function getImpressumNew(): Promise<ImpressumNew | null> {
  return fetchDirectusSingle<ImpressumNew>("/items/impressum", {
    tag: "impressum",
    revalidate: 86400,
    label: "impressum",
  });
}

export interface DatenschutzNew {
  id: string;
  date_updated: string | null;
  content: string;
}

export async function getDatenschutzNew(): Promise<DatenschutzNew | null> {
  return fetchDirectusSingle<DatenschutzNew>("/items/datenschutz", {
    tag: "datenschutz",
    revalidate: 86400,
    label: "datenschutz",
  });
}

export interface AgbContent {
  id: string;
  date_updated: string | null;
  content: string;
}

export async function getAgbContent(): Promise<AgbContent | null> {
  return fetchDirectusSingle<AgbContent>("/items/agb", {
    tag: "agb",
    revalidate: 86400,
    label: "agb",
  });
}

// ========================================
// HILFE WEB & KONTO
// ========================================

export interface HilfeWebItem {
  id: string;
  sort: number;
  frage: string;
  antwort: string;
}

export async function getHilfeWebItems(): Promise<HilfeWebItem[]> {
  return fetchDirectusList<HilfeWebItem>(
    "/items/hilfe_web?filter[status][_eq]=published&sort=sort&fields=id,sort,frage,antwort",
    { tag: "hilfe-web", revalidate: 3600, label: "hilfe_web" },
  );
}

export async function getHilfeWebReisenderItems(): Promise<HilfeWebItem[]> {
  return fetchDirectusList<HilfeWebItem>(
    "/items/hilfe_web_reisender?filter[status][_eq]=published&sort=sort&fields=id,sort,frage,antwort",
    { tag: "hilfe-web-reisender", revalidate: 3600, label: "hilfe_web_reisender" },
  );
}

export async function getAccountContactFormContent(): Promise<AccountContactFormContent | null> {
  return fetchDirectusSingle<AccountContactFormContent>(
    "/items/account_contact_form_content?fields=*",
    { tag: "account-contact-form", revalidate: 3600, label: "account contact form content" },
  );
}

// ========================================
// PREMIUM PAGE (Fairführer+)
// ========================================

export async function getPremiumPageContent(): Promise<PremiumPageContent | null> {
  return fetchDirectusSingle<PremiumPageContent>(
    "/items/premium_page_content?fields=*",
    { tag: "premium-page", revalidate: 3600, label: "premium page content" },
  );
}

export async function getPremiumComparisonFeatures(): Promise<PremiumComparisonFeature[]> {
  return fetchDirectusList<PremiumComparisonFeature>(
    "/items/premium_comparison_features?filter[status][_eq]=published&sort=sort&fields=id,status,sort,feature,free,pro",
    { tag: "premium-page", revalidate: 3600, label: "premium comparison features" },
  );
}

// ========================================
// REGISTER, REDAKTION & ÜBER UNS
// ========================================

export async function getRegisterPageContent(): Promise<RegisterPageContent | null> {
  return fetchDirectusSingle<RegisterPageContent>(
    "/items/register_page_content?fields=*",
    { tag: "register-page", revalidate: 3600, label: "register page content" },
  );
}

export async function getRedaktionPageContent(): Promise<RedaktionPageContent | null> {
  return fetchDirectusSingle<RedaktionPageContent>(
    "/items/redaktion_page_content?fields=*",
    { tag: "redaktion", revalidate: 3600, label: "redaktion content" },
  );
}

export async function getUeberUnsContent(): Promise<UeberUnsContent | null> {
  // Pod-kolekcje (prozess_items, werte_items) rozwijane i filtrowane po
  // status=published + sortowane rosnąco (deep filter/sort).
  // Cache z tagiem "ueber-uns" utrzymuje trasę /ueber-uns w ISR.
  return fetchDirectusSingle<UeberUnsContent>(
    "/items/ueber_uns_content?fields=*,prozess_items.*,werte_items.*" +
      "&deep[prozess_items][_filter][status][_eq]=published&deep[prozess_items][_sort]=sort" +
      "&deep[werte_items][_filter][status][_eq]=published&deep[werte_items][_sort]=sort",
    { tag: "ueber-uns", revalidate: 3600, label: "ueber uns content" },
  );
}
