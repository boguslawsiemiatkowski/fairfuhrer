import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  PAYPAL_BASE,
  computeNextPremiumUntil,
  getPayPalAccessToken,
  isValidPayPalSubscriptionId,
} from "@/lib/paypal";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { resolvePremiumUntil } from "@/types/auth";

// GET /api/paypal/activate-subscription?subscription_id=I-xxx
export async function GET(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rate = checkRateLimit(`paypal:activate-sub:${clientIp}`, {
      limit: 20,
      windowMs: 15 * 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        }
      );
    }

    const rawSubscriptionId = request.nextUrl.searchParams.get("subscription_id");
    if (!rawSubscriptionId) {
      return NextResponse.json({ error: "subscription_id required" }, { status: 400 });
    }

    // Ścisła walidacja formatu `I-XXXXXXXXXXXX` — blokuje Path Traversal / SSRF do PayPal API
    if (!isValidPayPalSubscriptionId(rawSubscriptionId)) {
      return NextResponse.json({ error: "Invalid subscription_id format" }, { status: 400 });
    }
    const subscriptionId = rawSubscriptionId.toUpperCase();

    // Sprawdź tożsamość zalogowanego użytkownika
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Pobierz status subskrypcji z PayPal
    const accessToken = await getPayPalAccessToken();
    const subRes = await fetch(
      `${PAYPAL_BASE}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!subRes.ok) {
      console.error("activate-subscription: PayPal fetch failed", await subRes.text());
      return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 502 });
    }

    const subscription = await subRes.json();
    const status: string = subscription.status;

    // Akceptujemy ACTIVE lub APPROVED (sandbox może zwrócić APPROVED przed pierwszą płatnością)
    if (status !== "ACTIVE" && status !== "APPROVED") {
      return NextResponse.json(
        { error: "Subscription not active", status },
        { status: 402 }
      );
    }

    // WŁAŚCICIELSTWO: sam fakt, że subskrypcja jest aktywna, nie znaczy, że
    // należy do TEGO usera. Bez tej weryfikacji zalogowany user A, który zdobędzie
    // cudze subscription_id, aktywowałby sobie premium na cudzej płatności.
    // 1) custom_id — create-subscription wysyła w nim user.id, a PayPal odsyła
    //    wartość bez zmian. Mocniejszy dowód niż e-mail: pochodzi z naszego
    //    żądania, więc nie da się go podstawić bez dostępu do tego endpointu.
    const customId: string | undefined =
      typeof subscription.custom_id === "string"
        ? subscription.custom_id
        : undefined;

    //    Fallback wyłącznie dla subskrypcji założonych zanim zaczęliśmy wysyłać
    //    custom_id: e-mail subskrybenta musi zgadzać się z e-mailem sesji.
    //    Nie stosujemy go, gdy custom_id jest obecne — wtedy niezgodność
    //    oznacza odmowę, bez drugiej szansy.
    const subscriberEmail: string | undefined =
      subscription.subscriber?.email_address;
    const emailMatches =
      !!subscriberEmail &&
      !!user.email &&
      subscriberEmail.toLowerCase() === user.email.toLowerCase();

    const ownedByUser = customId ? customId === user.id : emailMatches;

    // 2) subscription_id nie może być już przypisane do innego partnera.
    const [{ data: existingOwner }, { data: currentProfile }, { data: currentPartner }] =
      await Promise.all([
        supabaseAdmin
          .from("partner_profiles")
          .select("id")
          .eq("paypal_subscription_id", subscriptionId)
          .maybeSingle(),
        supabaseAdmin
          .from("profiles")
          .select("premium_until")
          .eq("id", user.id)
          .maybeSingle(),
        supabaseAdmin
          .from("partner_profiles")
          .select("premium_until, paypal_subscription_id")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

    const claimedByOther = !!existingOwner && existingOwner.id !== user.id;

    if (!ownedByUser || claimedByOther) {
      console.error("activate-subscription: ownership check failed", {
        userId: user.id,
        via: customId ? "custom_id" : "email",
        ownedByUser,
        claimedByOther,
      });
      return NextResponse.json(
        { error: "Subscription does not belong to this account" },
        { status: 403 }
      );
    }

    const existingPremiumUntil = resolvePremiumUntil(
      currentProfile?.premium_until,
      currentPartner?.premium_until
    );

    // IDEMPOTENTNOŚĆ: jeśli ta konkretna subskrypcja (`subscriptionId`) została
    // już wcześniej zapisana na koncie tego partnera (np. przez równoległy
    // `subscription-webhook` albo odświeżenie strony), nie przesuwamy daty po raz drugi.
    if (
      currentPartner?.paypal_subscription_id === subscriptionId &&
      existingPremiumUntil &&
      new Date(existingPremiumUntil).getTime() > Date.now()
    ) {
      return NextResponse.json({
        success: true,
        premium_until: existingPremiumUntil,
        subscription_status: status,
      });
    }

    // Oblicz nowe premium_until (zawsze 12 miesięcy, zgodnie z AGB 4.1):
    // - pierwsza subskrypcja lub powrót po wygaśnięciu: teraz + 12 miesięcy
    // - przedłużenie w trakcie trwania okresu: obecne `premium_until` + 12 miesięcy,
    //   więc partner nie traci pozostałych opłaconych dni
    const nextPremiumUntil = computeNextPremiumUntil(existingPremiumUntil);

    const [profileUpdate, partnerUpdate] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .update({ premium_until: nextPremiumUntil })
        .eq("id", user.id),
      supabaseAdmin
        .from("partner_profiles")
        .update({
          premium_until: nextPremiumUntil,
          paypal_subscription_id: subscriptionId,
        })
        .eq("id", user.id),
    ]);

    if (profileUpdate.error) {
      console.error("activate-subscription: profile update error", profileUpdate.error);
      return NextResponse.json({ error: "Failed to activate premium" }, { status: 500 });
    }
    if (partnerUpdate.error) {
      console.error("activate-subscription: partner update error", partnerUpdate.error);
    }

    return NextResponse.json({
      success: true,
      premium_until: nextPremiumUntil,
      subscription_status: status,
    });
  } catch (err) {
    console.error("activate-subscription error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
