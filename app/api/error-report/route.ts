import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getDirectusEnv } from "@/lib/env";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { errorReportSchema, firstZodError } from "@/lib/validations/api";

/**
 * POST /api/error-report
 *
 * Lekki, zgodny z RODO (1st-party, bez ciasteczek i bez zapisu adresu IP)
 * endpoint diagnostyczny zapisujący błędy z Error Boundaries (`app/error.tsx`,
 * `app/global-error.tsx`, `app/karte/error.tsx`) bezpośrednio do kolekcji
 * `web_error_logs` w Directusie.
 */
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    // Ochrona przed zalaniem Directusa przez pętlę błędów lub bota:
    // maksymalnie 10 raportów na 5 minut z jednego IP.
    const rate = checkRateLimit(`error-report:${clientIp}`, {
      limit: 10,
      windowMs: 5 * 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many error reports" },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        }
      );
    }

    const parsed = errorReportSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstZodError(parsed.error) },
        { status: 400 }
      );
    }

    // Zmienne przez `lib/env.ts`, żeby było jedno miejsce prawdy dla konfiguracji.
    // ⚠ Brak tokenu nie jest tu błędem krytycznym: raportowanie błędów nie może
    // samo wywracać strony, więc zwracamy 200 i po cichu rezygnujemy z zapisu.
    const { DIRECTUS_URL: directusUrl, DIRECTUS_TOKEN: directusToken } =
      getDirectusEnv();
    if (!directusToken) {
      return NextResponse.json({ received: false }, { status: 200 });
    }

    const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
    const { context, message, digest, url } = parsed.data;

    const res = await fetch(`${directusUrl}/items/web_error_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${directusToken}`,
      },
      body: JSON.stringify({
        context,
        message,
        digest: digest ?? null,
        url: url ?? null,
        user_agent: userAgent,
        date_created: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      // Jeśli kolekcja `web_error_logs` nie została jeszcze utworzona w Directusie,
      // nie rzucamy błędu 500 do przeglądarki klienta.
      console.warn(
        `[error-report] Directus returned HTTP ${res.status} when logging to web_error_logs`
      );
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch {
    return NextResponse.json({ received: false }, { status: 200 });
  }
}
