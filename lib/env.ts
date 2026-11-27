// lib/env.ts
// Centralna walidacja zmiennych środowiskowych oparta na Zod (bez dodatkowych zależności).
//
// ⚠⚠ WALIDACJA JEST PODZIELONA NA GRUPY — i to jest cała istota tego pliku.
//
// Jedna funkcja sprawdzająca wszystkie 26 zmiennych naraz wyglądałaby schludniej,
// ale sprzęgałaby ze sobą rzeczy niezależne: `lib/directus.ts` jest importowany
// przez 11 stron (strona główna, /agb, /datenschutz, /impressum, /ueber-uns,
// /partner-werden …), więc brak choćby PAYPAL_CLIENT_SECRET wywracałby CAŁĄ
// witrynę, mimo że strony treściowe o PayPalu nic nie wiedzą.
//
// Dlatego każdy moduł sprawdza tylko to, czego sam używa:
//   getDirectusEnv()  → DIRECTUS_URL, DIRECTUS_TOKEN
//   getPayPalEnv()    → PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MODE, plany
//   getSupabaseEnv()  → SUPABASE_SECRET_KEY + publiczne klucze
//   getClientEnv()    → wyłącznie NEXT_PUBLIC_*
// `getServerEnv()` sprawdza wszystko razem i służy do diagnostyki (patrz niżej).
//
// Uwaga dot. bundlera Next.js:
// Dla zmiennych `NEXT_PUBLIC_*` kompilator podstawia w kodzie klienta wyłącznie
// jawne odwołania w postaci `process.env.NEXT_PUBLIC_<NAZWA>` — dynamiczne
// `process.env[key]` NIE zadziała. Dlatego obiekty wejściowe poniżej budujemy
// z jawnych odczytów właściwości, nigdy w pętli.

import { z } from "zod";

/** Usuwa końcowe ukośniki, żeby sklejanie adresów nie dawało `//`. */
const trimTrailingSlashes = (url: string) => url.replace(/\/+$/, "");

/**
 * Puste napisy traktujemy jak brak zmiennej.
 *
 * ⚠ Render i Doppler potrafią przekazać zmienną jako `""` zamiast jej nie
 * przekazać wcale. Bez tej normalizacji `.optional()` nie zadziała, a pole
 * wymagane przeszłoby walidację z pustą wartością.
 */
const emptyToUndefined = (value: string | undefined) =>
  value && value.length > 0 ? value : undefined;

// ============================================================================
// Schematy
// ============================================================================

/**
 * Zmienne publiczne (`NEXT_PUBLIC_*`) — dostępne i na serwerze, i w przeglądarce.
 */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_DIRECTUS_URL: z
    .string({ error: "Missing NEXT_PUBLIC_DIRECTUS_URL" })
    .url("NEXT_PUBLIC_DIRECTUS_URL must be a valid URL")
    .transform(trimTrailingSlashes),
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({ error: "Missing NEXT_PUBLIC_SUPABASE_URL" })
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL")
    .transform(trimTrailingSlashes),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string({ error: "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" })
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY cannot be empty"),
  NEXT_PUBLIC_MAPBOX_TOKEN: z
    .string({ error: "Missing NEXT_PUBLIC_MAPBOX_TOKEN" })
    .min(1, "NEXT_PUBLIC_MAPBOX_TOKEN cannot be empty"),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z
    .string({ error: "Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY" })
    .min(1, "NEXT_PUBLIC_TURNSTILE_SITE_KEY cannot be empty"),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url()
    .transform(trimTrailingSlashes)
    .optional(),
  NEXT_PUBLIC_GOOGLE_TAG_ID: z.string().min(1).optional(),
});

/**
 * Directus — adres i token do zapytań serwerowych.
 *
 * ⚠ `DIRECTUS_TOKEN` jest opcjonalny: treści publiczne (strony prawne, strona
 * główna) czyta polityka publiczna Directusa, bez tokenu. Token jest potrzebny
 * tylko tam, gdzie piszemy albo czytamy kolekcje chronione.
 *
 * ⚠ Po migracji na VPS `DIRECTUS_URL` może wskazywać pętlę lokalną
 * (`http://127.0.0.1:8055`), gdy Directus i Next stoją na tym samym serwerze —
 * wtedy zapytania nie wychodzą w internet. `NEXT_PUBLIC_DIRECTUS_URL` zostaje
 * publiczne, bo trafia do przeglądarki i do aplikacji mobilnej.
 */
export const directusEnvSchema = z.object({
  DIRECTUS_URL: z
    .string({ error: "Missing required environment variable: DIRECTUS_URL" })
    .url("DIRECTUS_URL must be a valid URL")
    .transform(trimTrailingSlashes),
  DIRECTUS_TOKEN: z.string().min(1).optional(),
});

/**
 * PayPal — dane aplikacji REST i identyfikatory planów subskrypcji.
 *
 * ⚠ Identyfikatory planów są opcjonalne na poziomie schematu, bo brak jednego
 * planu nie może wywracać startu aplikacji. Endpoint `create-subscription`
 * sprawdza konkretny plan w momencie użycia i zwraca czytelny błąd.
 */
export const paypalEnvSchema = z.object({
  PAYPAL_CLIENT_ID: z
    .string({ error: "Missing required environment variable: PAYPAL_CLIENT_ID" })
    .min(1, "PAYPAL_CLIENT_ID cannot be empty"),
  PAYPAL_CLIENT_SECRET: z
    .string({ error: "Missing required environment variable: PAYPAL_CLIENT_SECRET" })
    .min(1, "PAYPAL_CLIENT_SECRET cannot be empty"),
  PAYPAL_MODE: z.enum(["sandbox", "production"]).default("sandbox"),
  PAYPAL_SUBSCRIPTION_WEBHOOK_ID: z.string().min(1).optional(),
  PAYPAL_PLAN_ID_NONPROFIT: z.string().min(1).optional(),
  PAYPAL_PLAN_ID_MICRO: z.string().min(1).optional(),
  PAYPAL_PLAN_ID_SMALL: z.string().min(1).optional(),
  PAYPAL_PLAN_ID_MEDIUM: z.string().min(1).optional(),
  PAYPAL_PLAN_ID_NONPROFIT_BRUTTO: z.string().min(1).optional(),
  PAYPAL_PLAN_ID_MICRO_BRUTTO: z.string().min(1).optional(),
  PAYPAL_PLAN_ID_SMALL_BRUTTO: z.string().min(1).optional(),
  PAYPAL_PLAN_ID_MEDIUM_BRUTTO: z.string().min(1).optional(),
});

/** Supabase — klucz `service_role` do operacji administracyjnych. */
export const supabaseEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z
    .string({ error: "Missing required environment variable: SUPABASE_SECRET_KEY" })
    .min(1, "SUPABASE_SECRET_KEY cannot be empty"),
});

/** Pozostałe sekrety serwerowe: Turnstile, webhooki, adres kanoniczny. */
export const miscEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  SITE_URL: z.string().url().transform(trimTrailingSlashes).optional(),
  REVALIDATE_SECRET_TOKEN: z.string().min(1).optional(),
  REVENUECAT_WEBHOOK_SECRET: z.string().min(1).optional(),
});

/**
 * Pełny schemat serwerowy — suma wszystkich grup.
 *
 * ⚠ Używać do DIAGNOSTYKI (np. skrypt sprawdzający konfigurację po migracji),
 * a nie w modułach aplikacji. W module wołaj grupę, której naprawdę potrzebujesz,
 * żeby nie wiązać ze sobą niezależnych obszarów.
 */
export const serverEnvSchema = clientEnvSchema
  .extend(directusEnvSchema.shape)
  .extend(paypalEnvSchema.shape)
  .extend(supabaseEnvSchema.shape)
  .extend(miscEnvSchema.shape);

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type DirectusEnv = z.infer<typeof directusEnvSchema>;
export type PayPalEnv = z.infer<typeof paypalEnvSchema>;
export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;
export type MiscEnv = z.infer<typeof miscEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

// ============================================================================
// Odczyt surowych wartości
// ============================================================================

/** Publiczne — jawne odczyty, inaczej bundler ich nie podstawi (patrz nagłówek). */
function rawClientEnv() {
  return {
    NEXT_PUBLIC_DIRECTUS_URL: process.env.NEXT_PUBLIC_DIRECTUS_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_SITE_URL: emptyToUndefined(process.env.NEXT_PUBLIC_SITE_URL),
    NEXT_PUBLIC_GOOGLE_TAG_ID: emptyToUndefined(
      process.env.NEXT_PUBLIC_GOOGLE_TAG_ID,
    ),
  };
}

function rawDirectusEnv() {
  return {
    DIRECTUS_URL: process.env.DIRECTUS_URL,
    DIRECTUS_TOKEN: emptyToUndefined(process.env.DIRECTUS_TOKEN),
  };
}

function rawPayPalEnv() {
  return {
    PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
    // Każda wartość inna niż "production" znaczy sandbox — bezpieczniejszy
    // domyślny wybór niż odwrotnie (literówka nie uruchomi prawdziwych płatności).
    PAYPAL_MODE:
      process.env.PAYPAL_MODE === "production" ? "production" : "sandbox",
    PAYPAL_SUBSCRIPTION_WEBHOOK_ID: emptyToUndefined(
      process.env.PAYPAL_SUBSCRIPTION_WEBHOOK_ID,
    ),
    PAYPAL_PLAN_ID_NONPROFIT: emptyToUndefined(process.env.PAYPAL_PLAN_ID_NONPROFIT),
    PAYPAL_PLAN_ID_MICRO: emptyToUndefined(process.env.PAYPAL_PLAN_ID_MICRO),
    PAYPAL_PLAN_ID_SMALL: emptyToUndefined(process.env.PAYPAL_PLAN_ID_SMALL),
    PAYPAL_PLAN_ID_MEDIUM: emptyToUndefined(process.env.PAYPAL_PLAN_ID_MEDIUM),
    PAYPAL_PLAN_ID_NONPROFIT_BRUTTO: emptyToUndefined(
      process.env.PAYPAL_PLAN_ID_NONPROFIT_BRUTTO,
    ),
    PAYPAL_PLAN_ID_MICRO_BRUTTO: emptyToUndefined(
      process.env.PAYPAL_PLAN_ID_MICRO_BRUTTO,
    ),
    PAYPAL_PLAN_ID_SMALL_BRUTTO: emptyToUndefined(
      process.env.PAYPAL_PLAN_ID_SMALL_BRUTTO,
    ),
    PAYPAL_PLAN_ID_MEDIUM_BRUTTO: emptyToUndefined(
      process.env.PAYPAL_PLAN_ID_MEDIUM_BRUTTO,
    ),
  };
}

function rawSupabaseEnv() {
  return { SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY };
}

function rawMiscEnv() {
  return {
    NODE_ENV: process.env.NODE_ENV,
    TURNSTILE_SECRET_KEY: emptyToUndefined(process.env.TURNSTILE_SECRET_KEY),
    SITE_URL: emptyToUndefined(process.env.SITE_URL),
    REVALIDATE_SECRET_TOKEN: emptyToUndefined(process.env.REVALIDATE_SECRET_TOKEN),
    REVENUECAT_WEBHOOK_SECRET: emptyToUndefined(
      process.env.REVENUECAT_WEBHOOK_SECRET,
    ),
  };
}

// ============================================================================
// Walidacja z pamięcią podręczną
// ============================================================================

function formatEnvErrors(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

/**
 * Waliduje jedną grupę i zapamiętuje wynik na czas życia procesu.
 *
 * ⚠ Wszystkie błędy grupy wypisujemy naraz (nie pierwszy napotkany), bo przy
 * migracji na nowy serwer liczy się pełna lista braków od razu — inaczej
 * poprawia się je po jednym, czekając za każdym razem na nowy build.
 */
function validateGroup<T>(
  schema: z.ZodType<T>,
  raw: unknown,
  label: string,
): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const details = formatEnvErrors(parsed.error);
    console.error(`❌ Invalid ${label} environment variables:\n${details}`);
    throw new Error(`Invalid ${label} environment variables:\n${details}`);
  }
  return parsed.data;
}

/** Strażnik: grupy serwerowe nie mogą trafić do kodu przeglądarki. */
function assertServerSide(fnName: string): void {
  if (typeof window !== "undefined") {
    throw new Error(`${fnName}() cannot be called on the client side`);
  }
}

let cachedClientEnv: ClientEnv | null = null;
let cachedDirectusEnv: DirectusEnv | null = null;
let cachedPayPalEnv: PayPalEnv | null = null;
let cachedSupabaseEnv: SupabaseEnv | null = null;
let cachedMiscEnv: MiscEnv | null = null;

/** Zwalidowane zmienne publiczne (`NEXT_PUBLIC_*`). */
export function getClientEnv(): ClientEnv {
  if (cachedClientEnv) return cachedClientEnv;
  cachedClientEnv = validateGroup(clientEnvSchema, rawClientEnv(), "public");
  return cachedClientEnv;
}

/** Zmienne Directusa. Woła je `lib/directus.ts` i endpointy pisujące do CMS-a. */
export function getDirectusEnv(): DirectusEnv {
  assertServerSide("getDirectusEnv");
  if (cachedDirectusEnv) return cachedDirectusEnv;
  cachedDirectusEnv = validateGroup(
    directusEnvSchema,
    rawDirectusEnv(),
    "Directus",
  );
  return cachedDirectusEnv;
}

/** Zmienne PayPala. Woła je `lib/paypal.ts` i trasy `/api/paypal/*`. */
export function getPayPalEnv(): PayPalEnv {
  assertServerSide("getPayPalEnv");
  if (cachedPayPalEnv) return cachedPayPalEnv;
  cachedPayPalEnv = validateGroup(paypalEnvSchema, rawPayPalEnv(), "PayPal");
  return cachedPayPalEnv;
}

/** Klucz `service_role` Supabase. Woła go `lib/supabase-admin.ts`. */
export function getSupabaseEnv(): SupabaseEnv {
  assertServerSide("getSupabaseEnv");
  if (cachedSupabaseEnv) return cachedSupabaseEnv;
  cachedSupabaseEnv = validateGroup(
    supabaseEnvSchema,
    rawSupabaseEnv(),
    "Supabase",
  );
  return cachedSupabaseEnv;
}

/** Turnstile, webhooki, `SITE_URL`, `NODE_ENV`. */
export function getMiscEnv(): MiscEnv {
  assertServerSide("getMiscEnv");
  if (cachedMiscEnv) return cachedMiscEnv;
  cachedMiscEnv = validateGroup(miscEnvSchema, rawMiscEnv(), "misc server");
  return cachedMiscEnv;
}

/**
 * Sprawdza WSZYSTKIE zmienne serwerowe naraz.
 *
 * ⚠ Do diagnostyki, nie do modułów aplikacji: po migracji na nowy serwer jedno
 * wywołanie wypisze pełną listę braków. W kodzie aplikacji używaj grup wyżej,
 * żeby awaria jednego obszaru nie zabierała ze sobą pozostałych.
 */
export function getServerEnv(): ServerEnv {
  assertServerSide("getServerEnv");
  return validateGroup(
    serverEnvSchema,
    {
      ...rawClientEnv(),
      ...rawDirectusEnv(),
      ...rawPayPalEnv(),
      ...rawSupabaseEnv(),
      ...rawMiscEnv(),
    },
    "server",
  );
}

/**
 * Kanoniczny adres aplikacji, bez końcowego ukośnika.
 *
 * Kolejność: `SITE_URL` → `NEXT_PUBLIC_SITE_URL` → wartość domyślna. Używane
 * w odnośnikach zwrotnych (potwierdzenia e-mail, powroty z PayPala), gdzie
 * adres musi być pełny i stały.
 */
export function getSiteUrl(fallback = "https://www.fairfuehrer.guide"): string {
  const raw =
    emptyToUndefined(process.env.SITE_URL) ||
    emptyToUndefined(process.env.NEXT_PUBLIC_SITE_URL) ||
    fallback;
  return trimTrailingSlashes(raw);
}
