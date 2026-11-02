import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { firstZodError, setVatIdSchema } from "@/lib/validations/api";

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
    }

    const parsedBody = setVatIdSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: firstZodError(parsedBody.error, "USt-IdNr. ist erforderlich.") },
        { status: 400 }
      );
    }
    const vatId = parsedBody.data.vat_id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "partner") {
      return NextResponse.json({ error: "Nur für Partner." }, { status: 403 });
    }

    const { error } = await supabase
      .from("partner_profiles")
      .update({ vat_eu: vatId })
      .eq("id", user.id);

    if (error) {
      console.error("set-vat-id error:", error);
      return NextResponse.json({ error: "Aktualisierung fehlgeschlagen." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("set-vat-id error:", error);
    return NextResponse.json({ error: "Es ist ein Serverfehler aufgetreten." }, { status: 500 });
  }
}
