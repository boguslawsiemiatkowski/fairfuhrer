import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getPayPalAccessToken, getPayPalBase } from "@/lib/paypal";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Plany netto — dla eu_reverse_charge i third_country (bez DE VAT)
const PLAN_IDS_NETTO: Record<string, string> = {
  nonprofit: process.env.PAYPAL_PLAN_ID_NONPROFIT ?? "",
  micro: process.env.PAYPAL_PLAN_ID_MICRO ?? "",
  small: process.env.PAYPAL_PLAN_ID_SMALL ?? "",
  medium: process.env.PAYPAL_PLAN_ID_MEDIUM ?? "",
};

// Plany brutto — dla de i eu_no_vat (cena zawiera 19% MwSt.)
const PLAN_IDS_BRUTTO: Record<string, string> = {
  nonprofit: process.env.PAYPAL_PLAN_ID_NONPROFIT_BRUTTO ?? "",
  micro: process.env.PAYPAL_PLAN_ID_MICRO_BRUTTO ?? "",
  small: process.env.PAYPAL_PLAN_ID_SMALL_BRUTTO ?? "",
  medium: process.env.PAYPAL_PLAN_ID_MEDIUM_BRUTTO ?? "",
};

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rate = checkRateLimit(`paypal:create-sub:${clientIp}`, {
      limit: 15,
      windowMs: 15 * 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        }
      );
    }

    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [{ data: profile }, { data: partnerProfile }] = await Promise.all([
      supabase.from("profiles").select("role, company_size").eq("id", user.id).single(),
      supabase.from("partner_profiles").select("tax_bucket").eq("id", user.id).single(),
    ]);

    if (!profile || profile.role !== "partner") {
      return NextResponse.json({ error: "Partner account required" }, { status: 403 });
    }

    const companySize = profile.company_size as string | null;
    if (!companySize) {
      return NextResponse.json(
        { error: "company_size not set or plan not configured" },
        { status: 400 }
      );
    }

    const taxBucket = partnerProfile?.tax_bucket ?? "de";
    const useBrutto = taxBucket === "de" || taxBucket === "eu_no_vat";
    const planMap = useBrutto ? PLAN_IDS_BRUTTO : PLAN_IDS_NETTO;
    const planId = planMap[companySize];

    if (!planId) {
      return NextResponse.json(
        { error: "company_size not set or plan not configured" },
        { status: 400 }
      );
    }

    const siteUrl = (
      process.env.SITE_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      request.nextUrl.origin
    ).replace(/\/+$/, "");

    const accessToken = await getPayPalAccessToken();

    const res = await fetch(`${getPayPalBase()}/v1/billing/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "PayPal-Request-Id": `${user.id}-${Date.now()}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        plan_id: planId,
        // PayPal odsyła custom_id w każdym evencie webhooka tej subskrypcji.
        // Dzięki temu subscription-webhook przypisuje płatność do konta bez
        // szukania po e-mailu (ten bywa inny w PayPalu niż w aplikacji).
        custom_id: user.id,
        subscriber: {
          email_address: user.email,
        },
        application_context: {
          brand_name: "Fairführer",
          locale: "de-DE",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          return_url: `${siteUrl}/konto/partner/premium?success=true`,
          cancel_url: `${siteUrl}/konto/partner/premium?cancelled=true`,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("PayPal create subscription error:", err);
      return NextResponse.json(
        { error: "Failed to create subscription" },
        { status: 500 }
      );
    }

    const subscription = await res.json();
    const approveLink = subscription.links?.find(
      (l: { rel: string; href: string }) => l.rel === "approve"
    )?.href;

    return NextResponse.json({
      subscription_id: subscription.id,
      approve_url: approveLink,
    });
  } catch (error) {
    console.error("create-subscription error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
