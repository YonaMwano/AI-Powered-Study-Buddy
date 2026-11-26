import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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
    const { data: job, error } = await service
      .from("exports")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: "Export not found" }, { status: 404 });
    }

    if (job.user_id && user?.id !== job.user_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let signedUrl = job.file_url;
    if (job.storage_path && job.status === "ready") {
      const { data } = await service.storage
        .from("exports")
        .createSignedUrl(job.storage_path, 60 * 60 * 24);
      if (data?.signedUrl) signedUrl = data.signedUrl;
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      signedUrl,
      bytes: job.bytes,
      format: job.format,
      error: job.error_message,
      expiresIn: 24 * 3600,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
