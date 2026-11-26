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

    let text = "";
    let tables: string[] = [];
    let headings: string[] = [];
    let tokens = 0;
    let visionWarning: string | undefined;

    try {
      const result = await visionExtract(
        images,
        doc.original_filename || undefined
      );
      text = result.text;
      tables = result.tables;
      headings = result.headings;
      tokens = result.tokens;
    } catch (visionErr) {
      console.warn("visionExtract failed — using existing text only", visionErr);
      visionWarning =
        "Vision model token/limit reached — using any existing text only";
    }

    const mergedText = [doc.extracted_text, text]
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (mergedText) {
      await supabase
        .from("documents")
        .update({
          extracted_text: mergedText,
          status: "ingested",
        })
        .eq("id", documentId);
    }

    // Never hard-fail: return whatever text we have
    return NextResponse.json({
      documentId,
      text: mergedText || doc.extracted_text || "",
      tables,
      headings,
      usedVision: !visionWarning && !!text,
      tokens,
      warning: visionWarning,
    });
  } catch (err) {
    console.error("analyze error", err);
    // Last resort: do not 500 if we can return empty text
    return NextResponse.json({
      documentId: null,
      text: "",
      tables: [],
      headings: [],
      usedVision: false,
      warning: "Analysis failed — continue with pasted text if available",
    });
  }
}
