// app/api/partner-application/route.ts - Next.js 16.0.7 + React 19.2.1
// ✅ Server-only protection
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import type { PartnerSubmissionData } from "@/types";
import { verifyTurnstileToken } from "@/lib/turnstile";

// ========================================
// Environment Variable Validation
// ========================================

const directusUrl = (process.env.DIRECTUS_URL ?? "").replace(/\/+$/, "");
if (!directusUrl) {
  throw new Error("❌ Missing required environment variable: DIRECTUS_URL");
}

// USUNIĘTE: Supabase setup i funkcje uploadFileToSupabase

async function saveToDirectus(data: Partial<PartnerSubmissionData>) {
  try {
    console.log("Sending to Directus:", JSON.stringify(data, null, 2));

    const directusToken = process.env.DIRECTUS_TOKEN;
    const response = await fetch(
      `${directusUrl}/items/partner_applications`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(directusToken && { Authorization: `Bearer ${directusToken}` }),
        },
        body: JSON.stringify(data),
      },
    );

    console.log("Directus response status:", response.status);

    if (response.ok) {
      try {
        const result = await response.json();
        console.log("Directus response data:", result);
        return result;
      } catch {
        return { success: true, id: "created" };
      }
    } else {
      const errorData = await response.text();
      console.error("Directus save error:", errorData);
      throw new Error(`Błąd zapisu do bazy danych: ${response.status}`);
    }
  } catch (error) {
    console.error("Error saving to Directus:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Turnstile verification
    const turnstileToken = formData.get("turnstileToken") as string;
    if (!turnstileToken) {
      return NextResponse.json(
        { error: "Bitte bestätigen Sie, dass Sie kein Roboter sind" },
        { status: 400 },
      );
    }

    const remoteip =
      request.headers.get("CF-Connecting-IP") ??
      request.headers.get("X-Forwarded-For") ??
      undefined;
    const isHuman = await verifyTurnstileToken(turnstileToken, remoteip);
    if (!isHuman) {
      return NextResponse.json(
        {
          error:
            "Sicherheitsüberprüfung fehlgeschlagen. Bitte versuchen Sie es erneut.",
        },
        { status: 403 },
      );
    }

    // Parsowanie sustainability_goals
    let sustainabilityGoals: number[] = [];
    const sustainabilityGoalsRaw = formData.get("sustainabilityGoals");

    console.log("Raw sustainabilityGoals from form:", sustainabilityGoalsRaw);

    if (sustainabilityGoalsRaw) {
      try {
        const parsed = JSON.parse(sustainabilityGoalsRaw as string);
        if (Array.isArray(parsed)) {
          sustainabilityGoals = parsed.filter(
            (id) => typeof id === "number" && id > 0,
          );
        }
      } catch (error) {
        console.error("Error parsing sustainabilityGoals:", error);
        sustainabilityGoals = [];
      }
    }

    console.log("Parsed sustainabilityGoals:", sustainabilityGoals);

    // Walidacja i typowanie pól radio
    const certificationStatusRaw = formData.get(
      "certificationStatus",
    ) as string;
    const companySizeRaw = formData.get("companySize") as string;
    const kategorieRaw = formData.get("kategorie") as string;

    console.log("Form fields raw:", {
      certificationStatusRaw,
      companySizeRaw,
      kategorieRaw,
    });

    let certificationStatus: "A" | "B" | "C" | undefined = undefined;
    let companySize: "micro" | "small" | "medium" | "ngo" | undefined =
      undefined;

    // Walidacja certificationStatus
    if (certificationStatusRaw) {
      if (["A", "B", "C"].includes(certificationStatusRaw)) {
        certificationStatus = certificationStatusRaw as "A" | "B" | "C";
      } else {
        return NextResponse.json(
          { error: "Ungültiger Zertifizierungsstatus." },
          { status: 400 },
        );
      }
    }

    // Walidacja companySize
    if (companySizeRaw) {
      if (["micro", "small", "medium", "ngo"].includes(companySizeRaw)) {
        companySize = companySizeRaw as "micro" | "small" | "medium" | "ngo";
      } else {
        return NextResponse.json(
          { error: "Ungültige Unternehmensgröße." },
          { status: 400 },
        );
      }
    }

    console.log("Validated fields:", {
      certificationStatus,
      companySize,
      kategorie: kategorieRaw,
    });

    // Przygotowanie danych do wysłania
    const submissionData: Partial<PartnerSubmissionData> = {
      // WYMAGANE POLA - podstawowe dane
      first_name: formData.get("firstName") as string,
      last_name: formData.get("lastName") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      // NOWE POLA - opcjonalne dane firmowe
      billing_address: (formData.get("billingAddress") as string) || undefined,
      vat_number: (formData.get("vatNumber") as string) || undefined,
      place_name: formData.get("placeName") as string,
      address: formData.get("address") as string,
      kategorie: kategorieRaw || undefined,

      // OPCJONALNE POLA - zawartość (USUNIĘTE: text_content)
      website_url: (formData.get("websiteUrl") as string) || undefined,
      message: (formData.get("message") as string) || undefined,

      // OPCJONALNE POLA Teilnahmebedingungen
      certificate: (formData.get("certificate") as string) || "",
      sustainability_goals:
        sustainabilityGoals.length > 0 ? sustainabilityGoals : undefined,

      // Pola radio
      certification_status: certificationStatus,
      company_size: companySize,

      // Status i czas
      status: "new" as const,
      created_at: new Date().toISOString(),
    };

    // Walidacja podstawowych danych
    if (
      !submissionData.first_name ||
      !submissionData.last_name ||
      !submissionData.email ||
      !submissionData.place_name ||
      !submissionData.address ||
      !submissionData.kategorie
    ) {
      console.error("Validation failed:", {
        first_name: !!submissionData.first_name,
        last_name: !!submissionData.last_name,
        email: !!submissionData.email,
        place_name: !!submissionData.place_name,
        address: !!submissionData.address,
        kategorie: !!submissionData.kategorie,
        // OPCJONALNE - tylko do logowania
        certificate: !!submissionData.certificate,
        sustainabilityGoals: sustainabilityGoals.length,
        certification_status: !!submissionData.certification_status,
        company_size: !!submissionData.company_size,
      });

      return NextResponse.json(
        {
          error:
            "Pflichtfelder fehlen (Vorname, Nachname, E-Mail, Name des Ortes, Adresse, Kategorie).",
        },
        { status: 400 },
      );
    }

    // USUNIĘTE: Całą sekcję przesyłania plików do Supabase
    // - uploadFileToSupabase dla mainImage
    // - pętla dla additionalImages
    // - uploadFileToSupabase dla audioFile

    // Zapisz do Directus (bez URL-i do plików)
    const savedData = await saveToDirectus(
      submissionData as PartnerSubmissionData,
    );

    return NextResponse.json(
      {
        success: true,
        message: "Die Bewerbung wurde erfolgreich gesendet",
        data: savedData,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      {
        error: "Ein Fehler ist beim Verarbeiten der Bewerbung aufgetreten",
      },
      { status: 500 },
    );
  }
}
