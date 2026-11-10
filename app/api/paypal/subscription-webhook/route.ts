import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { paypalConfig } from "@/lib/paypal";

const PAYPAL_BASE =
  paypalConfig.mode === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ile miesięcy premium nadaje jedna opłacona płatność (12 + 1 miesiąc karencji). */
const PREMIUM_MONTHS = 13;

interface PayPalSubscriptionEvent {
  event_type: string;
  resource?: {
    id?: unknown;
    custom_id?: unknown;
    custom?: unknown;
    billing_agreement_id?: unknown;
    subscriber?: { email_address?: unknown };
  };
}

async function verifyWebhookSignature(
  rawBody: string,
  headers: Record<string, string>
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_SUBSCRIPTION_WEBHOOK_ID;
  if (!webhookId) {
    console.error("PAYPAL_SUBSCRIPTION_WEBHOOK_ID not configured");
    return false;
  }

  const credentials = Buffer.from(
    `${paypalConfig.client_id}:${paypalConfig.client_secret}`
  ).toString("base64");

  try {
    const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!tokenRes.ok) return false;
    const { access_token } = await tokenRes.json();

    const verifyRes = await fetch(
      `${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_algo: headers["paypal-auth-algo"],
          cert_url: headers["paypal-cert-url"],
          client_id: paypalConfig.client_id,
          webhook_id: webhookId,
          webhook_event: JSON.parse(rawBody),
          transmission_id: headers["paypal-transmission-id"],
          transmission_sig: headers["paypal-transmission-sig"],
          transmission_time: headers["paypal-transmission-time"],
        }),
      }
    );
    if (!verifyRes.ok) return false;
    const { verification_status } = await verifyRes.json();
    return verification_status === "SUCCESS";
  } catch (err) {
    console.error("Subscription webhook verification error:", err);
    return false;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Wyciąga ID subskrypcji (I-XXX) z eventu.
 *
 * UWAGA: dla PAYMENT.SALE.COMPLETED `resource.id` to ID *sprzedaży*, nie
 * subskrypcji — powiązanie z abonamentem niesie `billing_agreement_id`.
 * Jego brak oznacza płatność jednorazową (patrz /api/paypal/webhook), której
 * ten endpoint nie może traktować jak odnowienia.
 */
function getSubscriptionId(event: PayPalSubscriptionEvent): string | undefined {
  const resource = event.resource ?? {};
  if (event.event_type === "PAYMENT.SALE.COMPLETED") {
    return asString(resource.billing_agreement_id);
  }
  return asString(resource.id);
}

/**
 * Szuka użytkownika po e-mailu w Supabase Auth.
 *
 * `listUsers()` jest paginowane (domyślnie 50 rekordów na stronę), więc bez
 * przejścia wszystkich stron użytkownicy spoza pierwszej strony byli po cichu
 * nieodnajdywani i tracili premium mimo opłaconej subskrypcji.
 */
async function findUserIdByEmail(email: string): Promise<string | null> {
  const perPage = 1000;
  const maxPages = 100; // twardy limit, żeby błąd API nie zapętlił requestu
  const needle = email.toLowerCase();

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error || !data) {
      console.error("subscription-webhook: listUsers failed:", error);
      return null;
    }

    const match = data.users.find((u) => u.email?.toLowerCase() === needle);
    if (match) return match.id;

    // Krótsza strona niż perPage = ostatnia strona.
    if (data.users.length < perPage) return null;
  }

  console.error("subscription-webhook: listUsers exceeded maxPages");
  return null;
}

type Resolution = {
  userId: string;
  via: "custom_id" | "subscription_id" | "email";
};

/**
 * Ustala użytkownika, którego dotyczy event — od źródła najpewniejszego
 * do najsłabszego.
 */
async function resolveUserId(
  event: PayPalSubscriptionEvent
): Promise<Resolution | null> {
  const resource = event.resource ?? {};

  // 1) custom_id — ustawiane przy tworzeniu subskrypcji (create-subscription).
  //    Niesie nasze user.id, więc nie wymaga żadnego wyszukiwania.
  const customId = asString(resource.custom_id) ?? asString(resource.custom);
  if (customId && UUID_RE.test(customId)) {
    return { userId: customId, via: "custom_id" };
  }

  // 2) ID subskrypcji zapisane przez activate-subscription. Pokrywa subskrypcje
  //    założone zanim zaczęliśmy wysyłać custom_id.
  const subscriptionId = getSubscriptionId(event);
  if (subscriptionId) {
    const { data, error } = await supabaseAdmin
      .from("partner_profiles")
      .select("id")
      .eq("paypal_subscription_id", subscriptionId)
      .maybeSingle();

    if (error) {
      console.error("subscription-webhook: subscription lookup failed:", error);
    } else if (data?.id) {
      return { userId: data.id, via: "subscription_id" };
    }
  }

  // 3) Ostatnia deska ratunku: e-mail subskrybenta. Dotyczy subskrypcji, przy
  //    których użytkownik nigdy nie wrócił na stronę, więc activate-subscription
  //    nie zdążyło zapisać paypal_subscription_id.
  const email = asString(resource.subscriber?.email_address);
  if (email) {
    const userId = await findUserIdByEmail(email);
    if (userId) return { userId, via: "email" };
  }

  return null;
}

/**
 * Ustawia premium_until w OBU tabelach.
 *
 * `profiles` zasila widoki konta, ale bramki premium dla Partnera czytają
 * `partner_profiles.premium_until` (api/audiopin). Aktualizacja tylko jednej
 * z nich powodowała, że odnowienie nie odblokowywało audiopinów, a anulowanie
 * ich nie odbierało.
 */
async function setPremiumUntil(
  userId: string,
  premiumUntil: string | null
): Promise<boolean> {
  const [profileRes, partnerRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .update({ premium_until: premiumUntil })
      .eq("id", userId),
    supabaseAdmin
      .from("partner_profiles")
      .update({ premium_until: premiumUntil })
      .eq("id", userId),
  ]);

  if (profileRes.error) {
    console.error("subscription-webhook: profiles update failed:", profileRes.error);
  }
  if (partnerRes.error) {
    console.error(
      "subscription-webhook: partner_profiles update failed:",
      partnerRes.error
    );
  }

  return !profileRes.error && !partnerRes.error;
}

function grantedUntil(months = PREMIUM_MONTHS): string {
  const premiumUntil = new Date();
  premiumUntil.setMonth(premiumUntil.getMonth() + months);
  return premiumUntil.toISOString();
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const isVerified = await verifyWebhookSignature(rawBody, headers);
  if (!isVerified) {
    console.error("subscription-webhook: invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PayPalSubscriptionEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const isGrant =
    event.event_type === "BILLING.SUBSCRIPTION.ACTIVATED" ||
    event.event_type === "BILLING.SUBSCRIPTION.RENEWED" ||
    event.event_type === "PAYMENT.SALE.COMPLETED";

  // EXPIRED gehört NICHT hierher. Seit die Pläne auf `total_cycles: 1` stehen
  // (keine automatische Verlängerung, § AGB), schickt PayPal dieses Ereignis
  // bei jedem Partner genau dann, wenn das bezahlte Jahr vorbei ist — also im
  // Regelfall, nicht im Störfall. `premium_until` dort auf null zu setzen
  // nähme dem Partner den Monat Karenz (PREMIUM_MONTHS = 13), der ihm Zeit
  // gibt, nach der Erinnerung von Hand zu verlängern. Der Eintrag soll
  // auslaufen, weil das Datum erreicht ist, nicht weil ein Ereignis ihn löscht.
  const isRevoke =
    event.event_type === "BILLING.SUBSCRIPTION.CANCELLED" ||
    event.event_type === "BILLING.SUBSCRIPTION.SUSPENDED";

  // Das Auslaufen wird vermerkt, aber nicht vollzogen: ohne diese Zeile wäre
  // später nicht nachvollziehbar, ob ein Partner seinen Zugang verloren hat,
  // weil das Datum erreicht war oder weil etwas anderes schiefging.
  if (event.event_type === "BILLING.SUBSCRIPTION.EXPIRED") {
    console.info(
      "subscription-webhook: subscription expired (bezahltes Jahr vorbei) — " +
        "premium_until bleibt unverändert und läuft vom Datum her aus",
      { subscriptionId: getSubscriptionId(event) }
    );
    return NextResponse.json({ received: true });
  }

  if (!isGrant && !isRevoke) {
    return NextResponse.json({ received: true });
  }

  // Płatność jednorazowa (bez powiązania z abonamentem) nie może nadawać
  // 13 miesięcy premium.
  if (event.event_type === "PAYMENT.SALE.COMPLETED" && !getSubscriptionId(event)) {
    console.info(
      "subscription-webhook: sale without billing_agreement_id — ignored"
    );
    return NextResponse.json({ received: true });
  }

  const resolved = await resolveUserId(event);

  if (!resolved) {
    console.error(
      `subscription-webhook: user not resolved for ${event.event_type}`,
      { subscriptionId: getSubscriptionId(event) }
    );
    // 200, żeby PayPal nie ponawiał w nieskończoność eventu, którego i tak
    // nie umiemy przypisać.
    return NextResponse.json({ received: true });
  }

  const ok = await setPremiumUntil(
    resolved.userId,
    isGrant ? grantedUntil() : null
  );

  console.info(
    `subscription-webhook: ${event.event_type} -> ${isGrant ? "granted" : "revoked"} ` +
      `for ${resolved.userId} (via ${resolved.via}, ok=${ok})`
  );

  return NextResponse.json({ received: true });
}
