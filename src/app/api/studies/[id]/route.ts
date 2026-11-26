import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOrCreateGuestId } from "@/lib/guest";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const service = await createServiceClient();
    const { data: study, error } = await service
      .from("studies")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !study) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

    // AuthZ
    if (study.user_id) {
      if (!user || user.id !== study.user_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (study.guest_id) {
      const guestId = await getOrCreateGuestId();
      if (guestId !== study.guest_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({ study });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const service = await createServiceClient();
    const { error } = await service
      .from("studies")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
