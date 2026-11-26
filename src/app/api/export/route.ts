import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOrCreateGuestId } from "@/lib/guest";
import { buildPdfBuffer } from "@/lib/export/pdf";
import { buildPptxBuffer } from "@/lib/export/pptx";
import { buildDocxBuffer } from "@/lib/export/docx";
import type { ExportFormat, Study } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await req.json();
    const { studyId, format } = body as {
      studyId?: string;
      format?: ExportFormat;
    };

    if (!studyId || !format || !["pdf", "pptx", "docx"].includes(format)) {
      return NextResponse.json(
        { error: "studyId and format (pdf|pptx|docx) required" },
        { status: 400 }
      );
    }

    const service = await createServiceClient();
    const { data: study, error } = await service
      .from("studies")
      .select("*")
      .eq("id", studyId)
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

    // Create export job row
    const { data: job, error: jobErr } = await service
      .from("exports")
      .insert({
        study_id: studyId,
        user_id: user?.id ?? null,
        format,
        status: "processing",
      })
      .select("id")
      .single();

    if (jobErr || !job) {
      console.error(jobErr);
      return NextResponse.json({ error: "Failed to create export job" }, { status: 500 });
    }

    // Build document
    let buffer: Buffer;
    let contentType: string;
    let ext: string;

    try {
      if (format === "pdf") {
        buffer = await buildPdfBuffer(study as Study);
        contentType = "application/pdf";
        ext = "pdf";
      } else if (format === "pptx") {
        buffer = await buildPptxBuffer(study as Study);
        contentType =
          "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        ext = "pptx";
      } else {
        buffer = await buildDocxBuffer(study as Study);
        contentType =
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        ext = "docx";
      }
    } catch (buildErr) {
      console.error("export build failed", buildErr);
      await service
        .from("exports")
        .update({
          status: "failed",
          error_message: buildErr instanceof Error ? buildErr.message : "Build failed",
        })
        .eq("id", job.id);
      return NextResponse.json(
        { error: "Document generation failed" },
        { status: 500 }
      );
    }

    // Upload to storage
    const safeTitle = (study.title || "study")
      .replace(/[^a-z0-9]+/gi, "-")
      .slice(0, 40)
      .toLowerCase();
    const storagePath = `${user?.id || "guest"}/${studyId}/${job.id}-${safeTitle}.${ext}`;

    let signedUrl: string | null = null;
    try {
      const { error: upErr } = await service.storage
        .from("exports")
        .upload(storagePath, buffer, {
          contentType,
          upsert: true,
        });
      if (!upErr) {
        const { data: signed } = await service.storage
          .from("exports")
          .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
        signedUrl = signed?.signedUrl ?? null;
      } else {
        console.warn("storage upload error", upErr);
      }
    } catch (stErr) {
      console.warn("storage skipped", stErr);
    }

    // Fallback: return base64 data URL if storage unavailable
    if (!signedUrl) {
      const b64 = buffer.toString("base64");
      signedUrl = `data:${contentType};base64,${b64}`;
    }

    await service
      .from("exports")
      .update({
        status: "ready",
        file_url: signedUrl.startsWith("data:") ? null : signedUrl,
        storage_path: storagePath,
        bytes: buffer.length,
      })
      .eq("id", job.id);

    return NextResponse.json({
      jobId: job.id,
      status: "ready",
      signedUrl,
      bytes: buffer.length,
      expiresIn: 7 * 24 * 3600,
      filename: `${safeTitle}.${ext}`,
      contentType,
    });
  } catch (err) {
    console.error("export error", err);
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500 }
    );
  }
}
