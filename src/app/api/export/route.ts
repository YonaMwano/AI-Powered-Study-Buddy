import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOrCreateGuestId } from "@/lib/guest";
import { buildPdfBuffer } from "@/lib/export/pdf";
import { buildPptxBuffer } from "@/lib/export/pptx";
import { buildDocxBuffer } from "@/lib/export/docx";
import type { ExportFormat, Study } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const CONTENT_TYPES: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

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

    if (!studyId || !format || !["pdf", "docx", "pptx"].includes(format)) {
      return NextResponse.json(
        { error: "studyId and format (pdf|docx|pptx) required" },
        { status: 400 }
      );
    }

    const service = await createServiceClient();

    const { data: study, error: studyErr } = await service
      .from("studies")
      .select("*")
      .eq("id", studyId)
      .single();

    if (studyErr || !study) {
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

    const studyPayload = study as unknown as Study & {
      id: string;
      title: string;
      difficulty: string;
      explainer: Study["explainer"];
      quiz: Study["quiz"];
      flashcards: Study["flashcards"];
    };

    let buffer: Buffer;
    try {
      if (format === "pdf") {
        buffer = await buildPdfBuffer(studyPayload);
      } else if (format === "docx") {
        buffer = await buildDocxBuffer(studyPayload);
      } else {
        buffer = await buildPptxBuffer(studyPayload);
      }
    } catch (buildErr) {
      console.error("export build failed", buildErr);
      return NextResponse.json(
        {
          error:
            buildErr instanceof Error
              ? `Build failed: ${buildErr.message}`
              : "Failed to build document",
        },
        { status: 500 }
      );
    }

    const contentType = CONTENT_TYPES[format];
    const ext = format;
    const safeTitle = (study.title || "study")
      .replace(/[^a-z0-9]+/gi, "-")
      .slice(0, 40)
      .toLowerCase() || "study";

    // Record export job (best-effort)
    let jobId: string | null = null;
    try {
      const { data: job } = await service
        .from("exports")
        .insert({
          study_id: studyId,
          user_id: user?.id ?? null,
          format,
          status: "processing",
        })
        .select("id")
        .single();
      jobId = job?.id ?? null;
    } catch (jobErr) {
      console.warn("export job insert skipped", jobErr);
    }

    const storagePath = `${user?.id || "guest"}/${studyId}/${jobId || crypto.randomUUID()}-${safeTitle}.${ext}`;

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
        console.warn("storage upload error", upErr.message);
      }
    } catch (stErr) {
      console.warn("storage skipped", stErr);
    }

    // Always have a usable download if storage is missing
    if (!signedUrl) {
      signedUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
    }

    if (jobId) {
      await service
        .from("exports")
        .update({
          status: "ready",
          file_url: signedUrl.startsWith("data:") ? null : signedUrl,
          storage_path: storagePath,
          bytes: buffer.length,
        })
        .eq("id", jobId);
    }

    return NextResponse.json({
      jobId,
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
      {
        error:
          err instanceof Error ? err.message : "Export failed",
      },
      { status: 500 }
    );
  }
}
