// lib/directus.ts
// ✅ Server-only protection - prevents accidental client-side imports
import "server-only";

import type {
  HomePageContent,
  PartnerPageContent,
  ContactFormContent,
  ContactInfoContent,
  SupportSectionContent,
  PayPalDonation,
  WebhookLog,
  PremiumPageContent,
  PremiumComparisonFeature,
  AccountContactFormContent,
  RedaktionPageContent,
  RegisterPageContent,
  SightsLockModalContent,
  UeberUnsContent,
} from "@/types";

// ========================================
// Environment Variable Validation
// ========================================

const DIRECTUS_URL = process.env.DIRECTUS_URL?.replace(/\/+$/, "");
if (!DIRECTUS_URL) {
  throw new Error("❌ Missing required environment variable: DIRECTUS_URL");
}

const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;

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

function buildHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(DIRECTUS_TOKEN && { Authorization: `Bearer ${DIRECTUS_TOKEN}` }),
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
    const response = await fetch(`${DIRECTUS_URL}${path}`, {
      headers: buildHeaders(),
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
    const response = await fetch(`${DIRECTUS_URL}${path}`, {
      headers: buildHeaders(),
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
  return fetchDirectusSingle<HomePageContent>(
    "/items/home_page_content?fields=*" +
      ",traveler_image.id,traveler_image.modified_on,traveler_image.width,traveler_image.height" +
      ",partner_image.id,partner_image.modified_on,partner_image.width,partner_image.height" +
      "&limit=1",
    { tag: "home-page", revalidate: 3600, label: "home page content" },
  );
}

export async function getPartnerPageContent(options?: {
  noStore?: boolean;
  revalidate?: number;
}): Promise<PartnerPageContent | null> {
  return fetchDirectusSingle<PartnerPageContent>(
    "/items/partner_page_content?fields=*&limit=1",
    {
      tag: "partner-werden",
      revalidate: options?.revalidate ?? 604800,
      noStore: options?.noStore ?? false,
      label: "partner page content",
    },
  );
}

// Info-Blase, die auf der Karte über gesperrten Sehenswertes-Pins erscheint.
// Singleton in Directus. Cache mit Tag "sights-lock" (revalidate = 86400),
// damit /karte im ISR bleibt.
export async function getSightsLockModalContent(): Promise<SightsLockModalContent | null> {
  return fetchDirectusSingle<SightsLockModalContent>(
    "/items/sights_lock_modal_content?fields=*",
    { tag: "sights-lock", revalidate: 86400, label: "sights lock modal content" },
  );
}

// ========================================
// KONTAKT
// ========================================

export async function getSupportSectionContent(): Promise<SupportSectionContent | null> {
  return fetchDirectusSingle<SupportSectionContent>(
    "/items/support_section_content?filter[page_slug][_eq]=kontakt&fields=*&limit=1",
    { tag: "support-section", revalidate: 3600, label: "support section content" },
  );
}

export async function getContactFormContent(): Promise<ContactFormContent | null> {
  return fetchDirectusSingle<ContactFormContent>(
    "/items/contact_form_content?fields=*",
    { tag: "contact-form", revalidate: 3600, label: "contact form content" },
  );
}

export async function getContactInfoContent(): Promise<ContactInfoContent | null> {
  return fetchDirectusSingle<ContactInfoContent>(
    "/items/contact_info_content?filter[page_slug][_eq]=kontakt&fields=*&limit=1",
    { tag: "contact-info", revalidate: 3600, label: "contact info content" },
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

// ========================================
// PAYPAL DONACJE & WEBHOOKI
// ========================================

/**
 * Tworzy nową donację PayPal w Directus
 */
export async function createPayPalDonation(
  donation: Omit<PayPalDonation, "id">,
): Promise<PayPalDonation | null> {
  try {
    const response = await fetch(`${DIRECTUS_URL}/items/paypal_donations`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(donation),
    });

    if (!response.ok) {
      throw new Error(`Failed to create PayPal donation: ${response.statusText}`);
    }

    // Directus może zwrócić 204 bez body — wtedy odczytujemy po order_id
    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return getPayPalDonationByOrderId(donation.paypal_order_id);
    }

    const data = await response.json();
    return data.data as PayPalDonation;
  } catch (error) {
    console.error("Error creating PayPal donation:", error);
    return null;
  }
}

/**
 * Aktualizuje status donacji PayPal
 */
export async function updatePayPalDonationStatus(
  donationId: string,
  updates: Partial<PayPalDonation>,
): Promise<PayPalDonation | null> {
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/paypal_donations/${donationId}`,
      {
        method: "PATCH",
        headers: buildHeaders(),
        body: JSON.stringify(updates),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to update PayPal donation: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data as PayPalDonation;
  } catch (error) {
    console.error("Error updating PayPal donation:", error);
    return null;
  }
}

/**
 * Pobiera donację PayPal po PayPal Order ID
 */
export async function getPayPalDonationByOrderId(
  paypalOrderId: string,
): Promise<PayPalDonation | null> {
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/paypal_donations?filter[paypal_order_id][_eq]=${encodeURIComponent(paypalOrderId)}`,
      { headers: buildHeaders() },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch PayPal donation by order ID: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return (data.data?.[0] as PayPalDonation) ?? null;
  } catch (error) {
    console.error("Error fetching PayPal donation by order ID:", error);
    return null;
  }
}

/**
 * Loguje webhook event
 */
export async function logWebhookEvent(
  webhookLog: Omit<WebhookLog, "id">,
): Promise<WebhookLog | null> {
  try {
    const response = await fetch(`${DIRECTUS_URL}/items/webhook_logs`, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(webhookLog),
    });

    if (!response.ok) {
      throw new Error(`Failed to log webhook event: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data as WebhookLog;
  } catch (error) {
    console.error("Error logging webhook event:", error);
    return null;
  }
}
