import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
    const { studyId, format, delivery } = body as {
      studyId?: string;
      format?: ExportFormat;
      /** "binary" = file bytes in response body (recommended). "json" = base64 URL. */
      delivery?: "binary" | "json";
    };

    if (!studyId || !format || !["pdf", "docx", "pptx"].includes(format)) {
      return NextResponse.json(
        { error: "studyId and format (pdf|docx|pptx) required" },
        { status: 400 }
      );
    }

    const { data: study, error: studyErr } = await supabase
      .from("studies")
      .select("*")
      .eq("id", studyId)
      .single();

    if (studyErr || !study) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }

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

    const studyPayload = study as unknown as Study;

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

    if (!buffer || buffer.length < 32) {
      return NextResponse.json(
        { error: "Export produced an empty file" },
        { status: 500 }
      );
    }

    const contentType = CONTENT_TYPES[format];
    const safeTitle =
      (study.title || "study")
        .replace(/[^a-z0-9]+/gi, "-")
        .slice(0, 40)
        .toLowerCase() || "study";
    const filename = `${safeTitle}.${format}`;

    // Preferred path: stream file bytes (reliable downloads, no huge JSON)
    if (delivery !== "json") {
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(buffer.length),
          "Cache-Control": "no-store",
        },
      });
    }

    // Optional JSON + data URL (legacy / debugging)
    return NextResponse.json({
      status: "ready",
      signedUrl: `data:${contentType};base64,${buffer.toString("base64")}`,
      bytes: buffer.length,
      filename,
      contentType,
    });
  } catch (err) {
    console.error("export error", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Export failed",
      },
      { status: 500 }
    );
  }
}
