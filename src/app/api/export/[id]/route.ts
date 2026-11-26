import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Poll export job status / refresh signed URL.
 * Uses the user session client only (no service role key).
 */
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: job, error } = await supabase
      .from("exports")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: "Export job not found" }, { status: 404 });
    }

    // Optionally refresh a storage signed URL
    let signedUrl = job.file_url as string | null;
    if (job.storage_path && job.status === "ready") {
      try {
        const { data: signed } = await supabase.storage
          .from("exports")
          .createSignedUrl(job.storage_path, 60 * 60 * 24);
        if (signed?.signedUrl) signedUrl = signed.signedUrl;
      } catch {
        /* keep existing file_url */
      }
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      signedUrl,
      bytes: job.bytes,
      format: job.format,
      error: job.error_message,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
