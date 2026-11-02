import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { firstZodError, setVatIdSchema } from "@/lib/validations/api";

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = setVatIdSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: firstZodError(parsedBody.error, "vat_id is required") },
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
      return NextResponse.json({ error: "Partner account required" }, { status: 403 });
    }

    const { error } = await supabase
      .from("partner_profiles")
      .update({ vat_eu: vatId })
      .eq("id", user.id);

    if (error) {
      console.error("set-vat-id error:", error);
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("set-vat-id error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
