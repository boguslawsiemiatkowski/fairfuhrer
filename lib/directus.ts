// lib/directus.ts
// ✅ Server-only protection - prevents accidental client-side imports
import "server-only";

import type {
  HomePageContent,
  FeaturedPin,
  ImpressumContent,
  DatenschutzContent,
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

const DIRECTUS_URL = process.env.DIRECTUS_URL;
if (!DIRECTUS_URL) {
  throw new Error("❌ Missing required environment variable: DIRECTUS_URL");
}

const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;

// Alle Abfragen unten laufen über `fetch`, nicht über das Directus-SDK: nur so
// greifen Next.js' `next: { revalidate, tags }` und damit ISR + die
// Tag-Invalidierung aus den Directus Flows (POST /api/revalidate).

export async function getHomePageContent(): Promise<HomePageContent | null> {
  try {
    const isDev = process.env.NODE_ENV === "development";
    const response = await fetch(
      // Rozwijamy pola obrazów o modified_on — używane jako cache-buster w URL
      // (podmiana pliku pod tym samym UUID inaczej zostaje w 30-dniowym cache).
      `${DIRECTUS_URL}/items/home_page_content?fields=*,traveler_image.id,traveler_image.modified_on,partner_image.id,partner_image.modified_on&limit=1`,
      {
        headers: {
          "Content-Type": "application/json",
        },
        // ISR + tag "home-page": Directus Flow "Home Page" woła
        // POST /api/revalidate z tagiem "home-page" po każdej zmianie w
        // home_page_content, więc edycje są widoczne od razu. revalidate to tylko
        // siatka bezpieczeństwa, gdyby Flow nie doszedł. Cache chroni też stronę
        // główną przed pustym renderem, gdy Directus śpi/nie odpowiada.
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 3600, tags: ["home-page"] } }),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`Failed to fetch home page content: ${response.status} ${response.statusText} — ${body}`);
    }

    const data = await response.json();

    if (data.data) {
      return (Array.isArray(data.data) ? data.data[0] : data.data) as HomePageContent;
    }

    return null;
  } catch (error) {
    console.error("Error fetching home page content:", error);
    return null;
  }
}

export async function getFeaturedPins(): Promise<FeaturedPin[]> {
  try {
    const isDev = process.env.NODE_ENV === "development";
    const response = await fetch(
      `${DIRECTUS_URL}/items/featured_pins?filter[status][_eq]=published&sort=sort&fields=*,ort.*,ort.Kategorie.Kategorie_id.*`,
      {
        headers: {
          "Content-Type": "application/json",
        },
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 3600, tags: ["featured-pins"] } }),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`Failed to fetch featured pins: ${response.status} ${response.statusText} — ${body}`);
    }

    const data = await response.json();
    return (data.data as FeaturedPin[]) || [];
  } catch (error) {
    console.error("Error fetching featured pins:", error);
    return [];
  }
}

export async function getImpressumContent(): Promise<ImpressumContent | null> {
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/impressum_content?filter[page_slug][_eq]=impressum&fields=id,page_slug,title,address,email,business_info_top,business_info_bottom,legal_content,webseitenerstellung`,
      {
        headers: {
          "Content-Type": "application/json",
        },
        next: { revalidate: 86400, tags: ["impressum"] },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch impressum content");
    }

    const data = await response.json();

    if (data.data && data.data.length > 0) {
      return data.data[0] as ImpressumContent;
    }

    return null;
  } catch (error) {
    console.error("Error fetching impressum content:", error);
    return null;
  }
}

export async function getDatenschutzContent(): Promise<DatenschutzContent | null> {
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/datenschutz_content?filter[page_slug][_eq]=datenschutz`,
      {
        headers: {
          "Content-Type": "application/json",
        },
        next: { revalidate: 86400, tags: ["datenschutz"] },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch datenschutz content");
    }

    const data = await response.json();

    if (data.data && data.data.length > 0) {
      return data.data[0] as DatenschutzContent;
    }

    return null;
  } catch (error) {
    console.error("Error fetching datenschutz content:", error);
    return null;
  }
}

export async function getSupportSectionContent(): Promise<SupportSectionContent | null> {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/support_section_content?filter[page_slug][_eq]=kontakt&fields=*&limit=1`,
      {
        headers: {
          "Content-Type": "application/json",
        },
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 3600, tags: ["support-section"] } }),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`Failed to fetch support section content: ${response.status} ${response.statusText} — ${body}`);
    }

    const data = await response.json();
    return data.data?.[0] ?? null;
  } catch (error) {
    console.error("Error fetching support section content:", error);
    return null;
  }
}

export async function getContactFormContent(): Promise<ContactFormContent | null> {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/contact_form_content?fields=*`,
      {
        headers: {
          "Content-Type": "application/json",
        },
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 3600, tags: ["contact-form"] } }),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`Failed to fetch contact form content: ${response.status} ${response.statusText} — ${body}`);
    }

    const data = await response.json();
    // Singleton: data.data ist ein Objekt (kein Array).
    return (Array.isArray(data.data) ? data.data[0] : data.data) ?? null;
  } catch (error) {
    console.error("Error fetching contact form content:", error);
    return null;
  }
}

export async function getContactInfoContent(): Promise<ContactInfoContent | null> {
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/contact_info_content?filter[page_slug][_eq]=kontakt&fields=*&limit=1`,
      {
        headers: {
          "Content-Type": "application/json",
        },
        next: { revalidate: 3600, tags: ["contact-info"] },
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`Failed to fetch contact info content: ${response.status} ${response.statusText} — ${body}`);
    }

    const data = await response.json();
    return data.data?.[0] ?? null;
  } catch (error) {
    console.error("Error fetching contact info content:", error);
    return null;
  }
}

// Info-Blase, die auf der Karte über gesperrten Sehenswertes-Pins erscheint.
// Verweist Web-Nutzer auf die mobile App (App Store / Google Play).
// Singleton in Directus.
// Cache mit Tag "sights-lock": no-store hat hier die gesamte /karte-Route aus
// dem ISR geworfen (Dynamic server usage), wodurch der 3-MB-Orte-Fetch bei
// jedem Request lief. Text-Änderungen bleiben sofort live — der Directus Flow
// muss dafür den Tag "sights-lock" an /api/revalidate schicken.
export async function getSightsLockModalContent(): Promise<SightsLockModalContent | null> {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/sights_lock_modal_content?fields=*`,
      {
        headers: { "Content-Type": "application/json" },
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 86400, tags: ["sights-lock"] } }),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(
        `Failed to fetch sights lock modal content: ${response.status} ${response.statusText} — ${body}`,
      );
    }

    const data = await response.json();
    return data.data ?? null;
  } catch (error) {
    console.error("Error fetching sights lock modal content:", error);
    return null;
  }
}

// ========================================
// IMPRESSUM
// ========================================

export interface ImpressumNew {
  id: string;
  date_updated: string | null;
  content: string;
}

export async function getImpressumNew(): Promise<ImpressumNew | null> {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const response = await fetch(`${DIRECTUS_URL}/items/impressum`, {
      headers: {
        "Content-Type": "application/json",
        ...(DIRECTUS_TOKEN && { Authorization: `Bearer ${DIRECTUS_TOKEN}` }),
      },
      ...(isDev
        ? { cache: "no-store" as const }
        : { next: { revalidate: 86400, tags: ["impressum"] } }),
    });
    if (!response.ok) throw new Error(`Failed to fetch impressum: ${response.statusText}`);
    const data = await response.json();
    return (data.data as ImpressumNew) ?? null;
  } catch (error) {
    console.error("Error fetching impressum:", error);
    return null;
  }
}

// ========================================
// DATENSCHUTZ
// ========================================

export interface DatenschutzNew {
  id: string;
  date_updated: string | null;
  content: string;
}

export async function getDatenschutzNew(): Promise<DatenschutzNew | null> {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const response = await fetch(`${DIRECTUS_URL}/items/datenschutz`, {
      headers: {
        "Content-Type": "application/json",
        ...(DIRECTUS_TOKEN && { Authorization: `Bearer ${DIRECTUS_TOKEN}` }),
      },
      ...(isDev
        ? { cache: "no-store" as const }
        : { next: { revalidate: 86400, tags: ["datenschutz"] } }),
    });
    if (!response.ok) throw new Error(`Failed to fetch datenschutz: ${response.statusText}`);
    const data = await response.json();
    return (data.data as DatenschutzNew) ?? null;
  } catch (error) {
    console.error("Error fetching datenschutz:", error);
    return null;
  }
}

// ========================================
// AGB
// ========================================

export interface AgbContent {
  id: string;
  date_updated: string | null;
  content: string;
}

export async function getAgbContent(): Promise<AgbContent | null> {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/agb`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(DIRECTUS_TOKEN && { Authorization: `Bearer ${DIRECTUS_TOKEN}` }),
        },
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 86400, tags: ["agb"] } }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch agb: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.data as AgbContent) ?? null;
  } catch (error) {
    console.error("Error fetching agb:", error);
    return null;
  }
}

// ========================================
// HILFE WEB
// ========================================

export interface HilfeWebItem {
  id: string;
  sort: number;
  frage: string;
  antwort: string;
}

export async function getHilfeWebItems(): Promise<HilfeWebItem[]> {
  const isDev = process.env.NODE_ENV === "development";

  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/hilfe_web?filter[status][_eq]=published&sort=sort&fields=id,sort,frage,antwort`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(DIRECTUS_TOKEN && { Authorization: `Bearer ${DIRECTUS_TOKEN}` }),
        },
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 3600, tags: ["hilfe-web"] } }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch hilfe_web: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.data as HilfeWebItem[]) ?? [];
  } catch (error) {
    console.error("Error fetching hilfe_web:", error);
    return [];
  }
}

// ========================================
// HILFE WEB REISENDER (FAQ für Reisende/Einzelnutzer)
// ========================================

export async function getHilfeWebReisenderItems(): Promise<HilfeWebItem[]> {
  const isDev = process.env.NODE_ENV === "development";

  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/hilfe_web_reisender?filter[status][_eq]=published&sort=sort&fields=id,sort,frage,antwort`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(DIRECTUS_TOKEN && { Authorization: `Bearer ${DIRECTUS_TOKEN}` }),
        },
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 3600, tags: ["hilfe-web-reisender"] } }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch hilfe_web_reisender: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.data as HilfeWebItem[]) ?? [];
  } catch (error) {
    console.error("Error fetching hilfe_web_reisender:", error);
    return [];
  }
}

// ========================================
// PREMIUM PAGE (Fairführer+)
// ========================================

export async function getPremiumPageContent(): Promise<PremiumPageContent | null> {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/premium_page_content?fields=*`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(DIRECTUS_TOKEN && { Authorization: `Bearer ${DIRECTUS_TOKEN}` }),
        },
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 3600, tags: ["premium-page"] } }),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`Failed to fetch premium page content: ${response.status} ${response.statusText} — ${body}`);
    }

    const data = await response.json();
    // Singleton zwraca obiekt, nie tablicę
    return (Array.isArray(data.data) ? data.data[0] : data.data) as PremiumPageContent ?? null;
  } catch (error) {
    console.error("Error fetching premium page content:", error);
    return null;
  }
}

export async function getPremiumComparisonFeatures(): Promise<PremiumComparisonFeature[]> {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/premium_comparison_features?filter[status][_eq]=published&sort=sort&fields=id,status,sort,feature,free,pro`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(DIRECTUS_TOKEN && { Authorization: `Bearer ${DIRECTUS_TOKEN}` }),
        },
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 3600, tags: ["premium-page"] } }),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`Failed to fetch premium comparison features: ${response.status} ${response.statusText} — ${body}`);
    }

    const data = await response.json();
    return (data.data as PremiumComparisonFeature[]) ?? [];
  } catch (error) {
    console.error("Error fetching premium comparison features:", error);
    return [];
  }
}

// ========================================
// REGISTER PAGE (Auswahlseite "Konto erstellen")
// ========================================

export async function getRegisterPageContent(): Promise<RegisterPageContent | null> {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/register_page_content?fields=*`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(DIRECTUS_TOKEN && { Authorization: `Bearer ${DIRECTUS_TOKEN}` }),
        },
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 3600, tags: ["register-page"] } }),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`Failed to fetch register page content: ${response.status} ${response.statusText} — ${body}`);
    }

    const data = await response.json();
    // Singleton zwraca obiekt, nie tablicę
    return (Array.isArray(data.data) ? data.data[0] : data.data) as RegisterPageContent ?? null;
  } catch (error) {
    console.error("Error fetching register page content:", error);
    return null;
  }
}

// ========================================
// REDAKTION (Reisender-Seite "Redaktion" — Sehenswertes-Pins einreichen)
// ========================================

export async function getRedaktionPageContent(): Promise<RedaktionPageContent | null> {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/redaktion_page_content?fields=*`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(DIRECTUS_TOKEN && { Authorization: `Bearer ${DIRECTUS_TOKEN}` }),
        },
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 3600, tags: ["redaktion"] } }),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`Failed to fetch redaktion content: ${response.status} ${response.statusText} — ${body}`);
    }

    const data = await response.json();
    return (Array.isArray(data.data) ? data.data[0] : data.data) as RedaktionPageContent ?? null;
  } catch (error) {
    console.error("Error fetching redaktion content:", error);
    return null;
  }
}

// ========================================
// ÜBER UNS (Seite "Über uns")
// ========================================

export async function getUeberUnsContent(): Promise<UeberUnsContent | null> {
  const isDev = process.env.NODE_ENV === "development";
  try {
    // Pod-kolekcje (prozess_items, werte_items) rozwijane i filtrowane po
    // status=published + sortowane rosnąco (deep filter/sort).
    const response = await fetch(
      `${DIRECTUS_URL}/items/ueber_uns_content?fields=*,prozess_items.*,werte_items.*` +
        `&deep[prozess_items][_filter][status][_eq]=published&deep[prozess_items][_sort]=sort` +
        `&deep[werte_items][_filter][status][_eq]=published&deep[werte_items][_sort]=sort`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(DIRECTUS_TOKEN && { Authorization: `Bearer ${DIRECTUS_TOKEN}` }),
        },
        // Wie bei getSightsLockModalContent: `no-store` hat die ganze Route
        // /ueber-uns aus dem ISR geworfen ("Dynamic server usage"), sodass sie
        // bei jedem Request neu gerendert wurde. Änderungen bleiben sofort
        // live — der Directus Flow muss dafür den Tag "ueber-uns" an
        // /api/revalidate schicken; revalidate ist nur das Sicherheitsnetz.
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 3600, tags: ["ueber-uns"] } }),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`Failed to fetch ueber uns content: ${response.status} ${response.statusText} — ${body}`);
    }

    const data = await response.json();
    // Singleton zwraca obiekt, nie tablicę
    return (Array.isArray(data.data) ? data.data[0] : data.data) as UeberUnsContent ?? null;
  } catch (error) {
    console.error("Error fetching ueber uns content:", error);
    return null;
  }
}

// ========================================
// ACCOUNT CONTACT FORM (Kontaktformular im Konto)
// ========================================

export async function getAccountContactFormContent(): Promise<AccountContactFormContent | null> {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/account_contact_form_content?fields=*`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(DIRECTUS_TOKEN && { Authorization: `Bearer ${DIRECTUS_TOKEN}` }),
        },
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 3600, tags: ["account-contact-form"] } }),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      throw new Error(`Failed to fetch account contact form content: ${response.status} ${response.statusText} — ${body}`);
    }

    const data = await response.json();
    // Singleton zwraca obiekt, nie tablicę
    return (Array.isArray(data.data) ? data.data[0] : data.data) as AccountContactFormContent ?? null;
  } catch (error) {
    console.error("Error fetching account contact form content:", error);
    return null;
  }
}

// ========================================
// NOWE FUNKCJE DLA PAYPAL DONACJI
// ========================================

/**
 * Tworzy nową donację PayPal w Directus
 */
export async function createPayPalDonation(
  donation: Omit<PayPalDonation, "id">
): Promise<PayPalDonation | null> {
  try {
    const response = await fetch(`${DIRECTUS_URL}/items/paypal_donations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(DIRECTUS_TOKEN && { Authorization: `Bearer ${DIRECTUS_TOKEN}` }),
      },
      body: JSON.stringify(donation),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to create PayPal donation: ${response.statusText}`
      );
    }

    // Directus może zwrócić 204 bez body — wtedy odczytujemy po order_id
    if (response.status === 204 || response.headers.get("content-length") === "0") {
      const byOrderId = await getPayPalDonationByOrderId(donation.paypal_order_id);
      return byOrderId;
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
  updates: Partial<PayPalDonation>
): Promise<PayPalDonation | null> {
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/paypal_donations/${donationId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(DIRECTUS_TOKEN && { Authorization: `Bearer ${DIRECTUS_TOKEN}` }),
        },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to update PayPal donation: ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.data as PayPalDonation;
  } catch (error) {
    console.error("Error updating PayPal donation:", error);
    return null;
  }
}

/**
 * Pobiera donację PayPal po ID
 */
export async function getPayPalDonation(
  donationId: string
): Promise<PayPalDonation | null> {
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/paypal_donations/${donationId}`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(DIRECTUS_TOKEN && { Authorization: `Bearer ${DIRECTUS_TOKEN}` }),
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Donation not found
      }
      throw new Error(
        `Failed to fetch PayPal donation: ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.data as PayPalDonation;
  } catch (error) {
    console.error("Error fetching PayPal donation:", error);
    return null;
  }
}

/**
 * Pobiera donację PayPal po PayPal Order ID
 */
export async function getPayPalDonationByOrderId(
  paypalOrderId: string
): Promise<PayPalDonation | null> {
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/paypal_donations?filter[paypal_order_id][_eq]=${paypalOrderId}`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(DIRECTUS_TOKEN && { Authorization: `Bearer ${DIRECTUS_TOKEN}` }),
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch PayPal donation by order ID: ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.data && data.data.length > 0) {
      return data.data[0] as PayPalDonation;
    }

    return null;
  } catch (error) {
    console.error("Error fetching PayPal donation by order ID:", error);
    return null;
  }
}

/**
 * Loguje webhook event
 */
export async function logWebhookEvent(
  webhookLog: Omit<WebhookLog, "id">
): Promise<WebhookLog | null> {
  try {
    const response = await fetch(`${DIRECTUS_URL}/items/webhook_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(DIRECTUS_TOKEN && { Authorization: `Bearer ${DIRECTUS_TOKEN}` }),
      },
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

/**
 * Pobiera statystyki donacji
 */
export async function getDonationStats(
  startDate?: string,
  endDate?: string
): Promise<{
  total_amount: number;
  total_count: number;
  successful_count: number;
  failed_count: number;
  average_amount: number;
} | null> {
  try {
    let url = `${DIRECTUS_URL}/items/paypal_donations?aggregate[sum]=amount&aggregate[count]=*`;

    if (startDate) {
      url += `&filter[created_at][_gte]=${startDate}`;
    }
    if (endDate) {
      url += `&filter[created_at][_lte]=${endDate}`;
    }

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch donation stats: ${response.statusText}`);
    }

    const data = await response.json();

    // Zapytanie o successful donations
    let successUrl = `${DIRECTUS_URL}/items/paypal_donations?filter[status][_eq]=completed&aggregate[count]=*`;
    if (startDate) successUrl += `&filter[created_at][_gte]=${startDate}`;
    if (endDate) successUrl += `&filter[created_at][_lte]=${endDate}`;

    const successResponse = await fetch(successUrl, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    const successData = await successResponse.json();

    // Zapytanie o failed donations
    let failedUrl = `${DIRECTUS_URL}/items/paypal_donations?filter[status][_in]=failed,cancelled&aggregate[count]=*`;
    if (startDate) failedUrl += `&filter[created_at][_gte]=${startDate}`;
    if (endDate) failedUrl += `&filter[created_at][_lte]=${endDate}`;

    const failedResponse = await fetch(failedUrl, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    const failedData = await failedResponse.json();

    const totalAmount = data.data?.[0]?.sum?.amount || 0;
    const totalCount = data.data?.[0]?.count || 0;
    const successfulCount = successData.data?.[0]?.count || 0;
    const failedCount = failedData.data?.[0]?.count || 0;

    return {
      total_amount: totalAmount,
      total_count: totalCount,
      successful_count: successfulCount,
      failed_count: failedCount,
      average_amount: totalCount > 0 ? Math.round(totalAmount / totalCount) : 0,
    };
  } catch (error) {
    console.error("Error fetching donation stats:", error);
    return null;
  }
}

/**
 * Pobiera ostatnie donacje (dla admina)
 */
export async function getRecentDonations(
  limit: number = 10
): Promise<PayPalDonation[]> {
  try {
    const response = await fetch(
      `${DIRECTUS_URL}/items/paypal_donations?sort=-created_at&limit=${limit}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch recent donations: ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.data as PayPalDonation[];
  } catch (error) {
    console.error("Error fetching recent donations:", error);
    return [];
  }
}
