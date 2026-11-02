// app/api/contact/route.ts - Next.js 16.0.7 + React 19.2.1
// ✅ Server-only protection
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { contactFormSchema, firstZodError } from "@/lib/validations/api";

export async function POST(request: NextRequest) {
  try {
    const parsedBody = contactFormSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: firstZodError(parsedBody.error) },
        { status: 400 }
      );
    }
    const body = parsedBody.data;

    const remoteip =
      request.headers.get("CF-Connecting-IP") ??
      request.headers.get("X-Forwarded-For") ??
      undefined;
    const isHuman = await verifyTurnstileToken(body.turnstileToken, remoteip);
    if (!isHuman) {
      return NextResponse.json(
        { error: "Sicherheitsüberprüfung fehlgeschlagen. Bitte versuchen Sie es erneut." },
        { status: 403 }
      );
    }

    // Wyślij do Directus z serwera (bez problemów CORS)
    const directusUrl = process.env.DIRECTUS_URL?.replace(/\/+$/, ""); // Bez NEXT_PUBLIC_
    const directusToken = process.env.DIRECTUS_TOKEN;

    if (!directusUrl) {
      console.error("Brak DIRECTUS_URL");
      return NextResponse.json(
        { error: "Serverkonfigurationsfehler" },
        { status: 500 }
      );
    }

    const response = await fetch(`${directusUrl}/items/contact_messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(directusToken && { Authorization: `Bearer ${directusToken}` }),
      },
      body: JSON.stringify({
        name: body.name,
        email: body.email,
        subject: body.subject,
        message: body.message,
        created_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error("Directus error:", response.status, response.statusText);
      return NextResponse.json(
        { error: "Fehler beim Speichern der Nachricht" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Nachricht erfolgreich gesendet" },
      { status: 200 }
    );
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Es ist ein Serverfehler aufgetreten" },
      { status: 500 }
    );
  }
}
