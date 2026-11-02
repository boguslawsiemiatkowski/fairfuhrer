import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { accountContactSchema, firstZodError } from "@/lib/validations/api";

export async function POST(request: NextRequest) {
  try {
    // Auth: wymagane. Cookies (web) LUB Bearer token (mobile).
    // Anti-spoofing: user_id/email/name/username/account_type NIGDY z body —
    // czytamy je z ZWERYFIKOWANEJ sesji, inaczej kazdy moze podszyc sie pod
    // dowolnego usera.
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
    }

    // Rate limiting: maksymalnie 5 wiadomości z konta na 10 minut
    const rate = checkRateLimit(`account-contact:${user.id}`, {
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error:
            "Zu viele Nachrichten in kurzer Zeit. Bitte versuchen Sie es später erneut.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        },
      );
    }

    const parsedBody = accountContactSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: firstZodError(parsedBody.error) },
        { status: 400 },
      );
    }
    const body = parsedBody.data;

    const directusUrl = process.env.DIRECTUS_URL;
    const directusToken = process.env.DIRECTUS_TOKEN;

    if (!directusUrl) {
      return NextResponse.json(
        { error: "Serverkonfigurationsfehler." },
        { status: 500 },
      );
    }

    // Profil dla imienia/nazwiska/username/roli — supabaseAdmin omija RLS.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, first_name, last_name, username")
      .eq("id", user.id)
      .single();

    const name =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      null;

    const response = await fetch(
      `${directusUrl}/items/account_contact_messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(directusToken && { Authorization: `Bearer ${directusToken}` }),
        },
        body: JSON.stringify({
          // Wszystkie identyfikatory z ZWERYFIKOWANEJ sesji, nigdy z body.
          user_id: user.id,
          email: user.email ?? null,
          name,
          username: profile?.username ?? null,
          account_type: profile?.role ?? null,
          subject: body.subject.trim(),
          message: body.message.trim(),
          date_created: new Date().toISOString(),
        }),
      },
    );

    if (!response.ok) {
      console.error("Directus error:", response.status, response.statusText);
      return NextResponse.json(
        { error: "Fehler beim Speichern der Nachricht." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Es ist ein Serverfehler aufgetreten." },
      { status: 500 },
    );
  }
}
