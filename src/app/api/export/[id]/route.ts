import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const { data: job, error } = await supabase
      .from("exports")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: "Export not found" }, { status: 404 });
    }

    let signedUrl = job.file_url as string | null;
    if (job.storage_path && !signedUrl) {
      const { data } = await supabase.storage
        .from("exports")
        .createSignedUrl(job.storage_path, 60 * 60 * 24);
      signedUrl = data?.signedUrl ?? null;
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      signedUrl,
      bytes: job.bytes,
      format: job.format,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
