import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Events that grant or extend premium
const GRANT_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "SUBSCRIPTION_EXTENDED",
  "TEMPORARY_ENTITLEMENT_GRANT",
]);

// RC docs: BILLING_ISSUE does NOT mean subscription expired — it means a charge
// attempt failed. CANCELLATION with cancel_reason=BILLING_ERROR handles actual
// access loss. SUBSCRIPTION_PAUSED likewise keeps access until EXPIRATION fires.
const REVOKE_EVENTS = new Set([
  "CANCELLATION",
  "EXPIRATION",
]);

function verifySharedSecret(req: NextRequest): boolean {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) return false;
  return req.headers.get("Authorization") === `Bearer ${secret}`;
}

async function updatePremiumUntil(userId: string, expirationMs: number | null) {
  const premiumUntil = expirationMs ? new Date(expirationMs).toISOString() : null;

  // Aktualizujemy obie tabele, aby uniknąć rozjazdu między `profiles` a `partner_profiles`
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
    console.error("[RC webhook] failed to update profiles.premium_until:", profileRes.error);
    return false;
  }
  if (partnerRes.error) {
    console.error("[RC webhook] failed to update partner_profiles.premium_until:", partnerRes.error);
  }
  return true;
}

export async function POST(request: NextRequest) {
  if (!verifySharedSecret(request)) {
    console.error("[RC webhook] invalid Authorization header");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event as Record<string, unknown> | undefined;
  if (!event) {
    return NextResponse.json({ error: "Missing event" }, { status: 400 });
  }

  const type = event.type as string | undefined;
  // app_user_id is the Supabase user UUID we pass to RC via identifyUser()
  const userId = event.app_user_id as string | undefined;
  const expirationMs = (event.expiration_at_ms as number | null) ?? null;

  if (!userId || !type) {
    return NextResponse.json({ received: true });
  }

  if (GRANT_EVENTS.has(type)) {
    await updatePremiumUntil(userId, expirationMs);
  } else if (REVOKE_EVENTS.has(type)) {
    await updatePremiumUntil(userId, null);
  }

  return NextResponse.json({ received: true });
}
