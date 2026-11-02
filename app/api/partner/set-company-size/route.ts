import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const VALID_SIZES = ["nonprofit", "micro", "small", "medium"] as const;
type CompanySize = (typeof VALID_SIZES)[number];

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
    }

    const body = await request.json();
    const companySize = body.company_size as string;

    if (!VALID_SIZES.includes(companySize as CompanySize)) {
      return NextResponse.json({ error: "Ungültige Unternehmensgröße." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "partner") {
      return NextResponse.json({ error: "Nur für Partner." }, { status: 403 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ company_size: companySize })
      .eq("id", user.id);

    if (error) {
      console.error("set-company-size error:", error);
      return NextResponse.json({ error: "Aktualisierung fehlgeschlagen." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("set-company-size error:", error);
    return NextResponse.json({ error: "Es ist ein Serverfehler aufgetreten." }, { status: 500 });
  }
}
