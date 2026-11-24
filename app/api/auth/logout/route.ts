import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Wyczyszczenie sesji i przekierowanie.
 *
 * Istnieje, bo Server Component nie może kasować ciasteczek — helper
 * `getSupabaseServerClient` połyka wtedy zapis w bloku catch. Chroniony layout
 * wywołuje ten endpoint zamiast przekierowywać wprost na `/login`.
 *
 * Bez tego powstaje pętla: proxy.ts sprawdza sesję przez `getClaims()`, który
 * weryfikuje podpis tokenu lokalnie i nie wie, że konto zostało usunięte albo
 * zablokowane. Proxy widzi „zalogowanego" i odsyła z `/login` na `/konto`,
 * a layout pyta Supabase przez `getUser()`, dostaje `null` i odsyła z powrotem.
 */
export async function GET(request: NextRequest) {
  const target = safeRedirectPath(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(target, request.nextUrl.origin));

  try {
    const supabase = await getSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Usuniętego użytkownika nie da się wylogować po stronie Supabase.
    // Ciasteczka i tak kasujemy poniżej — to one podtrzymują pętlę.
  }

  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
    }
  }

  return response;
}

/** Tylko ścieżki względne — zapobiega przekierowaniu na obcą domenę (w tym //evil.com oraz /\evil.com). */
function safeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/login";
  }
  return value;
}
