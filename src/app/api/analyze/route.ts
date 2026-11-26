import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { visionExtract } from "@/lib/ai/groq";
import { getOrCreateGuestId } from "@/lib/guest";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await req.json();
    const { documentId } = body as { documentId?: string };

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    const { data: doc, error } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (error || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (doc.user_id && user?.id !== doc.user_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!doc.user_id && doc.guest_id) {
      const gid = await getOrCreateGuestId();
      if (gid !== doc.guest_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (
      doc.extracted_text &&
      doc.extracted_text.length > 100 &&
      (!doc.page_images || doc.page_images.length === 0)
    ) {
      return NextResponse.json({
        documentId,
        text: doc.extracted_text,
        tables: [],
        headings: [],
        usedVision: false,
      });
    }

    const images: string[] = Array.isArray(doc.page_images)
      ? doc.page_images
      : [];

    if (images.length === 0) {
      return NextResponse.json({
        documentId,
        text: doc.extracted_text || "",
        tables: [],
        headings: [],
        usedVision: false,
      });
    }

    const { text, tables, headings, tokens } = await visionExtract(
      images,
      doc.original_filename || undefined
    );

    const mergedText = [doc.extracted_text, text]
      .filter(Boolean)
      .join("\n\n")
      .trim();

    await supabase
      .from("documents")
      .update({
        extracted_text: mergedText,
        status: "ingested",
      })
      .eq("id", documentId);

    return NextResponse.json({
      documentId,
      text: mergedText,
      tables,
      headings,
      usedVision: true,
      tokens,
    });
  } catch (err) {
    console.error("analyze error", err);
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 500 }
    );
  }
}
