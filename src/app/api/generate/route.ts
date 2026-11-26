import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

    // Prefer explicit text from client; fall back to document row
    let sourceText = (directText || "").trim();
    let resolvedDocumentId = documentId || null;

    if (documentId) {
      const { data: doc, error } = await supabase
        .from("documents")
        .select("id, user_id, guest_id, extracted_text")
        .eq("id", documentId)
        .maybeSingle();

      if (doc) {
        if (doc.user_id && user?.id !== doc.user_id) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (!doc.user_id && doc.guest_id && guestId && doc.guest_id !== guestId) {
          if (!sourceText) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          }
        } else {
          resolvedDocumentId = doc.id;
          if (!sourceText) {
            sourceText = (doc.extracted_text || "").trim();
          }
        }
      } else if (error) {
        console.warn("document lookup", error.message);
      }
    }

    if (!sourceText || sourceText.length < 20) {
      return NextResponse.json(
        {
          error:
            "Not enough text to generate a study set. Paste more content or re-upload the file.",
          code: "NO_TEXT",
        },
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

    const { data: row, error: insertErr } = await supabase
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
              ? "Failed to save study — run the studies RLS policies in SQL Editor"
              : "Failed to save study",
          detail: insertErr?.message,
          code: "STUDY_INSERT_FAILED",
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
