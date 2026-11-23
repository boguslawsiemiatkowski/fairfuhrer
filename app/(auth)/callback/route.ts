import "server-only";

import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/** Tylko bezpieczne ścieżki względne — blokuje Open Redirect (np. //evil.com, /\evil.com, https://...). */
function getSafeRedirectPath(value: string | null, fallback = "/konto"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const siteUrl = (
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    request.nextUrl.origin
  ).replace(/\/$/, "");

  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = getSafeRedirectPath(searchParams.get("next"), "/konto");

  const supabase = await getSupabaseServerClient();

  // OAuth flow: authorization code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${siteUrl}${next}`);
    }
  }

  // Email confirmation / magic link / password reset (PKCE token_hash flow)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(`${siteUrl}/passwort-zuruecksetzen`);
      }
      // email_confirmation or magiclink — show welcome banner
      const redirectPath = type === "signup" ? `${next}?confirmed=1` : next;
      return NextResponse.redirect(`${siteUrl}${redirectPath}`);
    }

    // Token abgelaufen oder bereits verwendet — spezifische Fehlermeldung statt
    // generischem "Anmeldung fehlgeschlagen", damit der Nutzer direkt einen
    // neuen Link anfordern kann.
    if (type === "signup") {
      return NextResponse.redirect(`${siteUrl}/login?error=confirmation_expired`);
    }
    if (type === "magiclink" || type === "email") {
      return NextResponse.redirect(`${siteUrl}/login?error=magiclink_expired`);
    }
    if (type === "recovery") {
      return NextResponse.redirect(`${siteUrl}/passwort-vergessen?error=recovery_expired`);
    }
  }

  return NextResponse.redirect(`${siteUrl}/login?error=auth_callback_failed`);
}
