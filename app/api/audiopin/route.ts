import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getCountryLabel } from "@/lib/countries";
import { sanitizeExternalUrl, sanitizeWordHtml } from "@/lib/orte-shared";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createAudiopinSchema, firstZodError } from "@/lib/validations/api";

// Lista zapasowa — uzywana tylko gdy Directus nie odpowie (patrz
// api/pin-optionen). Zrodlem prawdy sa kolekcje Kategorie i Zertifizierungen
// w CMS; te stale odswiezamy recznie, gdy cos sie w nich zmieni.
// Stan na 2026-09-16.
//
// Uwaga: id=1 "Sehenswertes" jest wg wizji Miriam kategoria redaktion-only —
// Partner nie powinien miec dostepu. Zostaje w liscie do momentu podjecia
// decyzji B.2 (patrz project_miriam_pending_answer_2026_07_03).
const KATEGORIEN = [
  { id: 1, name: "Sehenswertes" },
  { id: 2, name: "Essen & Übernachten" },
  { id: 3, name: "Einkaufen" },
  { id: 5, name: "Engagement" },
  { id: 8, name: "Unternehmen & Handwerk" },
] as const;

const ZERTIFIZIERUNGEN = [
  { id: "e500a374-386c-4aba-94e0-527d96549a6e", name: "Bio-Siegel (EU)" },
  { id: "0b65943d-f041-4ba4-8977-f1130182b165", name: "Bioland" },
  { id: "df8d53d4-03a7-472e-9275-4709c87354e0", name: "Bürgerkarte" },
  { id: "85cc8c45-bbfd-4324-af38-4b6ae5789588", name: "Cradle to Cradle" },
  { id: "d454e097-1a75-481a-939e-8e2b85359561", name: "Demeter" },
  { id: "405e915c-4472-48ce-b20f-04094dc88c50", name: "Echt nachhaltig Bodensee" },
  { id: "434a2b04-3a73-49c0-8ed0-2fb76ce5da40", name: "Fairbusiness" },
  { id: "3a2f6b5e-5573-4268-a730-9de111f0c2b1", name: "Fairtrade" },
  { id: "875901cf-245d-4892-aa92-752a60d7fc21", name: "GWÖ" },
  { id: "5d68ff62-0d9d-471b-bf79-042de600b6ba", name: "Marke Allgäu" },
  { id: "bdd40040-57bc-4d76-88f1-3172aa342fc0", name: "Naturland" },
  { id: "613717b2-ba00-45b8-9f3d-bbd834b0497a", name: "Naturland fair" },
  { id: "76064a45-2be4-415e-96b1-d55ff98e78c4", name: "Ökoprofit" },
  { id: "4453abea-cdfb-4099-bd18-a2d2cea30b27", name: "Slow Food" },
  { id: "77929987-5945-481f-9ff1-747fff9a2378", name: "Unesco Weltkulturerbe" },
  { id: "316f5bd4-1161-4987-975e-0ceb58fb260c", name: "Unverpackt Verband" },
] as const;

/** Twardy limit opisu. W UI sugerujemy 1.300–1.800 znakow. */
const MAX_BESCHREIBUNG = 2000;

/**
 * Link_Text jest ustawiany na stale — partner podaje tylko adres strony.
 * Wczesniej byly dwa pola i uzytkownicy wpisywali w "Link-Text" rozne rzeczy,
 * przez co pod pinami pojawialy sie niespojne etykiety.
 */
const LINK_TEXT = "Website";

export { KATEGORIEN, ZERTIFIZIERUNGEN, MAX_BESCHREIBUNG, LINK_TEXT };

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
    }

    // Rate limiting: maksymalnie 5 operacji tworzenia pina na 15 minut
    const rate = checkRateLimit(`audiopin-create:${user.id}`, {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error:
            "Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es später erneut.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, first_name, last_name")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "partner") {
      return NextResponse.json({ error: "Nur für Partner." }, { status: 403 });
    }

    const { data: partnerProfile } = await supabase
      .from("partner_profiles")
      .select("company_name, country, business_email, phone_number, premium_until")
      .eq("id", user.id)
      .single();

    const isPremium = partnerProfile?.premium_until
      ? new Date(partnerProfile.premium_until) > new Date()
      : false;

    const parsedBody = createAudiopinSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: firstZodError(parsedBody.error) },
        { status: 400 }
      );
    }
    const body = parsedBody.data;

    const directusUrl = process.env.DIRECTUS_URL?.replace(/\/+$/, "");
    const directusToken = process.env.DIRECTUS_TOKEN;
    if (!directusUrl || !directusToken) {
      return NextResponse.json({ error: "Serverkonfigurationsfehler." }, { status: 500 });
    }

    const rawLinkUrl =
      typeof body.Link_URL === "string" ? body.Link_URL.trim() : "";
    const safeLinkUrl = rawLinkUrl ? sanitizeExternalUrl(rawLinkUrl) : undefined;
    if (rawLinkUrl && !safeLinkUrl) {
      return NextResponse.json(
        { error: "Ungültige Website-URL (nur http:// oder https:// erlaubt)." },
        { status: 400 }
      );
    }

    const safeBeschreibung =
      typeof body.Vollbeschreibung === "string" && body.Vollbeschreibung.trim()
        ? sanitizeWordHtml(body.Vollbeschreibung)
        : null;

    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${directusToken}`,
    };

    // Buduj obiekt pinu
    const pinData: Record<string, unknown> = {
      Name: String(body.Name).trim(),
      Adresse: String(body.Adresse).trim(),
      Stadt: String(body.Stadt).trim(),
      Land: body.Land ?? (partnerProfile?.country ? getCountryLabel(partnerProfile.country) : null),
      Telefon: body.Telefon ?? null,
      Vollbeschreibung: safeBeschreibung,
      Link_URL: safeLinkUrl ?? null,
      Link_Text: safeLinkUrl ? LINK_TEXT : null,
      Kontaktperson:
        [profile?.first_name, profile?.last_name]
          .filter(Boolean)
          .join(" ") || null,
      Email: partnerProfile?.business_email ?? null,
      Partner_ID: user.id,
      Unternehmensname: partnerProfile?.company_name ?? null,
      Pin_Typ: isPremium ? "premium" : "standard",
      Bearbeitungsstatus: isPremium ? "veroeffentlicht" : "ausstehend",
    };

    // Lokalizacja — tylko jeśli wybrano adres z autocomplete
    if (body.Breite && body.Lange) {
      pinData.location = {
        type: "Point",
        coordinates: [body.Lange, body.Breite],
      };
    }

    // Główne zdjęcie (Titelbild)
    if (body.Titelbild) {
      pinData.Titelbild = body.Titelbild;
    }

    // Audio (UUID z directus_files)
    if (body.Audio) {
      pinData.Audio = body.Audio;
    }

    // Galerie (m2m przez Orte_files, junction field: directus_files_id) — tylko premium
    if (isPremium && Array.isArray(body.Galerie) && body.Galerie.length > 0) {
      pinData.Galerie = {
        create: body.Galerie.map((fileId: string) => ({ directus_files_id: fileId })),
      };
    }

    // Tworzymy pin w Directus
    const response = await fetch(`${directusUrl}/items/Orte`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(pinData),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("Directus error:", response.status, errText);
      return NextResponse.json(
        { error: "Fehler beim Speichern des Pins." },
        { status: 500 }
      );
    }

    const created = await response.json();
    const pinId = created.data?.id;

    // Relacje MTM: Kategorie
    if (Array.isArray(body.Kategorie) && body.Kategorie.length > 0 && pinId) {
      for (const kategorieId of body.Kategorie) {
        await fetch(`${directusUrl}/items/Orte_Kategorie`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ Orte_id: pinId, Kategorie_id: kategorieId }),
        });
      }
    }

    // Relacje MTM: Zertifizierungen
    // Konto bez Partner PIN moze wybrac tylko jedna — walidacja po stronie
    // serwera, bo ograniczenie w formularzu da sie obejsc.
    if (Array.isArray(body.Zertifizierungen) && body.Zertifizierungen.length > 0 && pinId) {
      const zertIds = isPremium
        ? body.Zertifizierungen
        : body.Zertifizierungen.slice(0, 1);
      for (const zertId of zertIds) {
        await fetch(`${directusUrl}/items/Orte_Zertifizierungen`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ Orte_id: pinId, Zertifizierungen_id: zertId }),
        });
      }
    }

    // Zapisz pin_id w partner_profiles
    if (pinId) {
      await supabase
        .from("partner_profiles")
        .update({ pin_id: pinId })
        .eq("id", user.id);
    }

    return NextResponse.json({ success: true, id: pinId }, { status: 201 });
  } catch (error) {
    console.error("API audiopin error:", error);
    return NextResponse.json(
      { error: "Es ist ein Serverfehler aufgetreten." },
      { status: 500 }
    );
  }
}
