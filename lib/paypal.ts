// ✅ Server-only protection - prevents accidental client-side imports
import "server-only";

import { getPayPalEnv } from "./env";

export interface PayPalConfig {
  client_id: string;
  client_secret: string;
  mode: "sandbox" | "production";
}

/**
 * Dane aplikacji REST PayPala, sprawdzane przy pierwszym użyciu.
 *
 * ⚠ Odczyt jest LENIWY (w funkcji), a nie na poziomie modułu. Wcześniej
 * `const env = getServerEnv()` wykonywało się już przy importowaniu pliku,
 * więc brak sekretu przerywał `next build` na etapie zbierania tras —
 * zamiast dopiero przy realnym wywołaniu płatności.
 *
 * ⚠ Świadomie `getPayPalEnv()`, nie `getServerEnv()`: płatności nie powinny
 * zależeć od zmiennych Directusa ani Supabase.
 */
export function getPayPalConfig(): PayPalConfig {
  const env = getPayPalEnv();
  return {
    client_id: env.PAYPAL_CLIENT_ID,
    client_secret: env.PAYPAL_CLIENT_SECRET,
    mode: env.PAYPAL_MODE,
  };
}

/** Adres bazowy REST API PayPala — sandbox albo produkcja. */
export function getPayPalBase(): string {
  return getPayPalConfig().mode === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

/**
 * Waliduje identyfikator subskrypcji PayPal (format `I-XXXXXXXXXXXX`).
 * Chroni przed Path Traversal / SSRF przy budowaniu URL-i do REST API PayPal.
 */
const PAYPAL_SUBSCRIPTION_ID_RE = /^I-[A-Z0-9]{8,24}$/i;

export function isValidPayPalSubscriptionId(value: unknown): value is string {
  return typeof value === "string" && PAYPAL_SUBSCRIPTION_ID_RE.test(value);
}

/**
 * Cache tokenu OAuth2 PayPal w pamięci procesu (token jest ważny zwykle ~8h).
 * Odejmujemy 60 sekund bufora bezpieczeństwa przed wygaśnięciem.
 */
let cachedAccessToken: { token: string; expiresAtMs: number } | null = null;

export async function getPayPalAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && now < cachedAccessToken.expiresAtMs) {
    return cachedAccessToken.token;
  }

  const config = getPayPalConfig();
  const credentials = Buffer.from(
    `${config.client_id}:${config.client_secret}`
  ).toString("base64");

  const res = await fetch(`${getPayPalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Failed to get PayPal access token (HTTP ${res.status})`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };

  const expiresInSeconds =
    typeof data.expires_in === "number" && data.expires_in > 120
      ? data.expires_in - 60
      : 300;

  cachedAccessToken = {
    token: data.access_token,
    expiresAtMs: now + expiresInSeconds * 1000,
  };

  return data.access_token;
}

/**
 * Ile miesięcy premium nadaje jedna opłacona płatność.
 *
 * Dokładnie 12 — tyle, ile partner kupuje według AGB 4.1. Bez karencji:
 * `premium_until` jest końcem opłaconego roku i niczym więcej, więc data
 * w koncie partnera znaczy to samo, co data na fakturze.
 */
export const PREMIUM_MONTHS = 12;

/**
 * Oblicza nową datę `premium_until` przy aktywacji lub przedłużeniu.
 *
 *     premium_until = max(dotychczasowe premium_until, teraz) + 12 miesięcy
 *
 * Opłacone lata dokładają się do siebie: kto przedłuża przed upływem okresu,
 * nie traci ani jednego opłaconego dnia, a kto wraca po przerwie, dostaje
 * 12 miesięcy od dziś (nie oddajemy czasu wstecz).
 *
 * ⚠ Termin zapłaty NIE zmienia długości dostępu — zwłoka nie daje dłuższego
 * okresu, a wcześniejsza zapłata nie skraca go. Przypomnienia idą 30 i 7 dni
 * przed tą datą (flow „Erinnerung: Partnerschaft läuft ab"), czyli wciąż
 * w trakcie opłaconego roku.
 */
export function computeNextPremiumUntil(
  currentPremiumUntil?: string | null,
  now = new Date()
): string {
  const existingDate = currentPremiumUntil ? new Date(currentPremiumUntil) : null;
  const isCurrentlyActive =
    existingDate !== null &&
    !Number.isNaN(existingDate.getTime()) &&
    existingDate.getTime() > now.getTime();

  const base = isCurrentlyActive && existingDate ? existingDate : now;

  const next = new Date(base.getTime());
  next.setMonth(next.getMonth() + PREMIUM_MONTHS);
  return next.toISOString();
}
