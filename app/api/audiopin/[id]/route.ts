import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { sanitizeExternalUrl, sanitizeWordHtml } from "@/lib/orte-shared";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { firstZodError, patchAudiopinSchema } from "@/lib/validations/api";
import { LINK_TEXT } from "@/app/api/audiopin/route";

const PIN_ID_REGEX = /^\d+$/;

async function fetchJunctionIds(
  directusUrl: string,
  directusToken: string,
  collection: "Orte_Kategorie" | "Orte_Zertifizierungen" | "Orte_files",
  pinId: string
): Promise<number[]> {
  const res = await fetch(
    `${directusUrl}/items/${collection}?filter[Orte_id][_eq]=${pinId}&fields=id&limit=50`,
    { headers: { Authorization: `Bearer ${directusToken}` } }
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: { id: number }[] };
  return (json.data ?? []).map((row) => row.id);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pinId } = await params;

    if (!PIN_ID_REGEX.test(pinId)) {
      return NextResponse.json({ error: "Ungültige Pin-ID." }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
    }

    // Rate limiting: maksymalnie 30 edycji pól pina na 5 minut
    const rate = checkRateLimit(`audiopin-patch:${user.id}`, {
      limit: 30,
      windowMs: 5 * 60 * 1000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error:
            "Zu viele Änderungen in kurzer Zeit. Bitte warten Sie einen Moment.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        }
      );
    }

    // Weryfikacja: użytkownik musi być premium i posiadać ten pin
    const { data: partnerProfile } = await supabase
      .from("partner_profiles")
      .select("pin_id, premium_until")
      .eq("id", user.id)
      .single();

    const isPremium = partnerProfile?.premium_until
      ? new Date(partnerProfile.premium_until) > new Date()
      : false;

    if (!isPremium) {
      return NextResponse.json({ error: "Premium erforderlich." }, { status: 403 });
    }

    if (String(partnerProfile?.pin_id) !== String(pinId)) {
      return NextResponse.json({ error: "Zugriff verweigert." }, { status: 403 });
    }

    const directusUrl = process.env.DIRECTUS_URL?.replace(/\/+$/, "");
    const directusToken = process.env.DIRECTUS_TOKEN;
    if (!directusUrl || !directusToken) {
      return NextResponse.json({ error: "Serverkonfigurationsfehler." }, { status: 500 });
    }

    const parsedBody = patchAudiopinSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: firstZodError(parsedBody.error) },
        { status: 400 }
      );
    }
    const body = parsedBody.data;

    // Dozwolone pola do edycji przez partnera
    // Link_Text celowo nie jest tu wymieniony — ustawiamy go nizej na stale.
    const allowedFields = [
      "Name", "Adresse", "Stadt", "Land", "Telefon", "Vollbeschreibung",
      "Link_URL", "Titelbild", "Audio", "location",
    ] as const;

    const patchData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        patchData[field] = body[field];
      }
    }

    if ("Vollbeschreibung" in patchData) {
      patchData.Vollbeschreibung =
        typeof patchData.Vollbeschreibung === "string" &&
        patchData.Vollbeschreibung.trim()
          ? sanitizeWordHtml(patchData.Vollbeschreibung)
          : null;
    }

    // Link_Text nie jest edytowalny przez partnera — trzymamy go zgodnie
    // z Link_URL, zeby etykiety pod pinami byly spojne.
    if (body.Link_URL !== undefined) {
      const rawUrl =
        typeof body.Link_URL === "string" ? body.Link_URL.trim() : "";
      const safeUrl = rawUrl ? sanitizeExternalUrl(rawUrl) : undefined;
      if (rawUrl && !safeUrl) {
        return NextResponse.json(
          { error: "Ungültige Website-URL (nur http:// oder https:// erlaubt)." },
          { status: 400 }
        );
      }
      patchData.Link_URL = safeUrl ?? null;
      patchData.Link_Text = safeUrl ? LINK_TEXT : null;
    }

    // Kategorie — zastąp wszystkie (pobieramy własne ID z tabeli łączącej, by uniknąć IDOR)
    if (Array.isArray(body.Kategorie)) {
      const existingJunctionIds = await fetchJunctionIds(
        directusUrl,
        directusToken,
        "Orte_Kategorie",
        pinId
      );
      patchData.Kategorie = {
        delete: existingJunctionIds,
        create: body.Kategorie.map((id: number) => ({ Kategorie_id: Number(id) })),
      };
    }

    // Zertifizierungen — zastąp wszystkie (pobieramy własne ID z tabeli łączącej)
    if (Array.isArray(body.Zertifizierungen)) {
      const existingJunctionIds = await fetchJunctionIds(
        directusUrl,
        directusToken,
        "Orte_Zertifizierungen",
        pinId
      );
      patchData.Zertifizierungen = {
        delete: existingJunctionIds,
        create: body.Zertifizierungen.map((id: string) => ({
          Zertifizierungen_id: String(id),
        })),
      };
    }

    // Galerie — dodaj nowe pliki przez junction
    if (Array.isArray(body.Galerie_add) && body.Galerie_add.length > 0) {
      patchData.Galerie = {
        create: body.Galerie_add.map((fileId: string) => ({ directus_files_id: String(fileId) })),
      };
    }

    // Galerie — usuń wybrane junction rekordy (tylko należące do tego pina)
    if (Array.isArray(body.Galerie_delete) && body.Galerie_delete.length > 0) {
      const ownGalleryJunctionIds = new Set(
        await fetchJunctionIds(directusUrl, directusToken, "Orte_files", pinId)
      );
      const validDeletes = body.Galerie_delete.map(Number).filter((id: number) =>
        ownGalleryJunctionIds.has(id)
      );
      if (validDeletes.length > 0) {
        patchData.Galerie = {
          ...((patchData.Galerie as object) ?? {}),
          delete: validDeletes,
        };
      }
    }

    if (Object.keys(patchData).length === 0) {
      return NextResponse.json({ error: "Keine Änderungen." }, { status: 400 });
    }

    const response = await fetch(`${directusUrl}/items/Orte/${pinId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${directusToken}`,
      },
      body: JSON.stringify(patchData),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("Directus PATCH error:", response.status, errText);
      return NextResponse.json({ error: "Fehler beim Aktualisieren." }, { status: 500 });
    }

    const updated = await response.json();
    return NextResponse.json({ success: true, data: updated.data });
  } catch (error) {
    console.error("PATCH audiopin error:", error);
    return NextResponse.json({ error: "Es ist ein Serverfehler aufgetreten." }, { status: 500 });
  }
}

// Pobierz aktualny pin z Directusa (do załadowania formularza edycji)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pinId } = await params;

    if (!PIN_ID_REGEX.test(pinId)) {
      return NextResponse.json({ error: "Ungültige Pin-ID." }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
    }

    const { data: partnerProfile } = await supabase
      .from("partner_profiles")
      .select("pin_id, premium_until")
      .eq("id", user.id)
      .single();

    if (String(partnerProfile?.pin_id) !== String(pinId)) {
      return NextResponse.json({ error: "Zugriff verweigert." }, { status: 403 });
    }

    const directusUrl = process.env.DIRECTUS_URL;
    const directusToken = process.env.DIRECTUS_TOKEN;
    if (!directusUrl || !directusToken) {
      return NextResponse.json({ error: "Serverkonfigurationsfehler." }, { status: 500 });
    }

    const fields = [
      "id", "Name", "Adresse", "Stadt", "Land", "Telefon", "Vollbeschreibung",
      "Link_URL", "Link_Text", "Titelbild", "Audio",
      "location",
      "Kategorie.Kategorie_id",
      "Zertifizierungen.Zertifizierungen_id",
    ].join(",");

    const [pinResponse, galerieResponse] = await Promise.all([
      fetch(`${directusUrl}/items/Orte/${pinId}?fields=${fields}`, {
        headers: { Authorization: `Bearer ${directusToken}` },
      }),
      fetch(
        `${directusUrl}/items/Orte_files?filter[Orte_id][_eq]=${pinId}&fields=id,directus_files_id&limit=20`,
        { headers: { Authorization: `Bearer ${directusToken}` } }
      ),
    ]);

    if (!pinResponse.ok) {
      return NextResponse.json({ error: "Pin nicht gefunden." }, { status: 404 });
    }

    const pinData = await pinResponse.json();
    const galerieData = galerieResponse.ok ? await galerieResponse.json() : { data: [] };

    const result = {
      ...pinData.data,
      Galerie: (galerieData.data ?? []) as { id: number; directus_files_id: string }[],
    };

    console.log("[audiopin GET] Stadt:", result.Stadt, "Land:", result.Land, "Adresse:", result.Adresse);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET audiopin error:", error);
    return NextResponse.json({ error: "Es ist ein Serverfehler aufgetreten." }, { status: 500 });
  }
}
