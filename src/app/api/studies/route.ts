import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateGuestId } from "@/lib/guest";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase
        .from("studies")
        .select(
          "id, title, difficulty, created_at, has_diagrams, document_id, documents(source_type, original_filename)"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error(error);
        return NextResponse.json(
          { error: "Failed to load studies" },
          { status: 500 }
        );
      }
      return NextResponse.json({ studies: data ?? [] });
    }

    const guestId = await getOrCreateGuestId();
    const { data, error } = await supabase
      .from("studies")
      .select(
        "id, title, difficulty, created_at, has_diagrams, document_id, documents(source_type, original_filename)"
      )
      .eq("guest_id", guestId)
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json(
        { error: "Failed to load studies" },
        { status: 500 }
      );
    }
    return NextResponse.json({ studies: data ?? [] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
