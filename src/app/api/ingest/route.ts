import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { detectSourceType, isAllowedMime, MAX_FILE_BYTES } from "@/lib/ingest/detect";
import { extractFromBuffer } from "@/lib/ingest/extract";
import { getOrCreateGuestId } from "@/lib/guest";
import type { SourceType } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const plainText = formData.get("text") as string | null;
    
    // ----- Text-only path (allowed for guests) -----
    if (plainText && plainText.trim().length > 0 && !file) {
      const guestId = user ? null : await getOrCreateGuestId();
      const service = await createServiceClient();

      const { data: doc, error } = await service
        .from("documents")
        .insert({
          user_id: user?.id ?? null,
          guest_id: guestId,
          source_type: "text" as SourceType,
          extracted_text: plainText.trim(),
          page_images: [],
          status: "ingested",
          original_filename: "pasted.txt",
        })
        .select("id")
        .single();

      if (error || !doc) {
        console.error("insert text document", error);
        return NextResponse.json(
          {
            error:
              error?.message?.includes("row-level security") || error?.code === "42501"
                ? "Failed to save document — set SUPABASE_SERVICE_ROLE_KEY in Vercel and run supabase/schema.sql"
                : "Failed to save document",
            detail: error?.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        documentId: doc.id,
        sourceType: "text",
        extractedTextPreview: plainText.trim().slice(0, 400),
      });
    }

    // ----- File path (requires auth) -----
    if (!file) {
      return NextResponse.json(
        { error: "Provide either text or a file" },
        { status: 400 }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          error: "Sign in required to upload files",
          code: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds 25 MB limit" },
        { status: 413 }
      );
    }

    const mime = file.type || "application/octet-stream";
    const filename = file.name || "upload.bin";

    if (!isAllowedMime(mime, filename)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF, DOCX, PPTX, TXT or images." },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let sourceType = detectSourceType(mime, filename);

    // Extract
    const extraction = await extractFromBuffer(buffer, sourceType, filename);
    sourceType = extraction.sourceType;

    // Optional: upload original to Storage
    let originalUrl: string | null = null;
    const storagePath = `${user.id}/${crypto.randomUUID()}-${filename}`;
    try {
      const service = await createServiceClient();
      const { error: upErr } = await service.storage
        .from("documents")
        .upload(storagePath, buffer, {
          contentType: mime,
          upsert: false,
        });
      if (!upErr) {
        const { data: signed } = await service.storage
          .from("documents")
          .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
        originalUrl = signed?.signedUrl ?? null;
      }
    } catch (storageErr) {
      console.warn("Storage upload skipped", storageErr);
    }

    // Persist document
    const service = await createServiceClient();
    const { data: doc, error } = await service
      .from("documents")
      .insert({
        user_id: user.id,
        guest_id: null,
        source_type: sourceType,
        original_url: originalUrl,
        original_filename: filename,
        extracted_text: extraction.text || null,
        page_images: extraction.pageImages || [],
        status: "ingested",
      })
      .select("id")
      .single();

    if (error || !doc) {
      console.error("insert document", error);
      return NextResponse.json(
        {
          error:
            error?.message?.includes("row-level security") || error?.code === "42501"
              ? "Failed to save document — set SUPABASE_SERVICE_ROLE_KEY in Vercel and run supabase/schema.sql"
              : "Failed to save document",
          detail: error?.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      documentId: doc.id,
      sourceType,
      extractedTextPreview: (extraction.text || "").slice(0, 400),
      pageCount: extraction.pageCount,
      hasImages: (extraction.pageImages?.length ?? 0) > 0,
    });
  } catch (err) {
    console.error("ingest error", err);
    return NextResponse.json(
      { error: "Ingestion failed. Please try again." },
      { status: 500 }
    );
  }
}
