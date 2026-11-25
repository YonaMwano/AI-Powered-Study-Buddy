import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { generateStudyFromText } from "@/lib/ai/generate";
import { attachIllustrations } from "@/lib/ai/illustrate";
import {
  getOrCreateGuestId,
  checkGuestQuota,
  incrementGuestUsage,
} from "@/lib/guest";
import type { Difficulty } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await req.json();
    const {
      documentId,
      text: directText,
      difficulty = "intermediate",
      includeDiagrams = false,
      includeFlashcardImages = false,
    } = body as {
      documentId?: string;
      text?: string;
      difficulty?: Difficulty;
      includeDiagrams?: boolean;
      includeFlashcardImages?: boolean;
    };

    let guestId: string | null = null;
    if (!user) {
      guestId = await getOrCreateGuestId();
      const quota = await checkGuestQuota(guestId);
      if (!quota.allowed) {
        return NextResponse.json(
          { error: quota.message, code: "GUEST_LIMIT" },
          { status: 429 }
        );
      }
    }

    // Prefer service role (bypasses RLS). Fall back to user client when logged in.
    const service = await createServiceClient();
    const writer = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? service
      : user
        ? supabase
        : service;

    let sourceText = (directText || "").trim();
    let resolvedDocumentId = documentId || null;

    if (documentId) {
      const { data: doc, error } = await service
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
      sourceText = (doc.extracted_text || sourceText || "").trim();
      resolvedDocumentId = doc.id;
    }

    if (!sourceText || sourceText.length < 20) {
      return NextResponse.json(
        { error: "Not enough text to generate a study set" },
        { status: 400 }
      );
    }

    const { study, model, tokensIn, tokensOut } = await generateStudyFromText({
      text: sourceText,
      difficulty,
      includeDiagrams: !!user && includeDiagrams,
      includeFlashcardImages: !!user && includeFlashcardImages,
    });

    let finalStudy = study;
    if (user && (includeDiagrams || includeFlashcardImages)) {
      try {
        finalStudy = await attachIllustrations(study, {
          diagrams: !!includeDiagrams,
          flashcardImages: !!includeFlashcardImages,
        });
      } catch (illErr) {
        console.warn("Illustration step failed, continuing without", illErr);
      }
    }

    const { data: row, error: insertErr } = await writer
      .from("studies")
      .insert({
        document_id: resolvedDocumentId,
        user_id: user?.id ?? null,
        guest_id: guestId,
        title: finalStudy.title,
        difficulty: finalStudy.difficulty,
        explainer: finalStudy.explainer,
        quiz: finalStudy.quiz,
        flashcards: finalStudy.flashcards,
        model_text: model,
        model_vision: null,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        has_diagrams: !!(includeDiagrams && user),
        has_flashcard_images: !!(includeFlashcardImages && user),
      })
      .select("id, title")
      .single();

    if (insertErr || !row) {
      console.error("insert study", insertErr);
      return NextResponse.json(
        {
          error:
            insertErr?.message?.includes("row-level security") ||
            insertErr?.code === "42501"
              ? "Failed to save study — set SUPABASE_SERVICE_ROLE_KEY in Vercel env and re-run schema.sql"
              : "Failed to save study",
          detail: insertErr?.message,
        },
        { status: 500 }
      );
    }

    if (guestId) {
      await incrementGuestUsage(guestId);
    }

    return NextResponse.json({
      studyId: row.id,
      title: row.title,
    });
  } catch (err) {
    console.error("generate error", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Generation failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
