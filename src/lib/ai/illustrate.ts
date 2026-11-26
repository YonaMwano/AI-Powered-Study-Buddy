/**
 * kie.ai nano-banana-2-1 image generation
 * Always fail-soft: returns null / partial study on token limits, timeouts, API errors.
 */

import type { StudyGeneration } from "@/types";

const KIE_CREATE = "https://api.kie.ai/api/v1/jobs/createTask";

export type IllustrateResult = {
  study: StudyGeneration;
  diagramsAdded: number;
  flashcardImagesAdded: number;
  skipped: boolean;
  skipReason?: string;
};

function isQuotaOrTokenError(status: number, body: string): boolean {
  const t = (body || "").toLowerCase();
  return (
    status === 429 ||
    status === 402 ||
    status === 413 ||
    t.includes("token") ||
    t.includes("quota") ||
    t.includes("rate limit") ||
    t.includes("insufficient") ||
    t.includes("credit") ||
    t.includes("budget") ||
    t.includes("too many") ||
    t.includes("context length") ||
    t.includes("max_tokens")
  );
}

/**
 * Create one illustration. Returns null on any failure (never throws).
 */
export async function createIllustration(prompt: string): Promise<{
  url: string | null;
  abortRest: boolean;
  reason?: string;
}> {
  const key = process.env.KIE_API_KEY;
  if (!key) {
    return { url: null, abortRest: true, reason: "KIE_API_KEY missing" };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);

    const res = await fetch(KIE_CREATE, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nano-banana-2-1",
        input: {
          prompt: prompt.slice(0, 600),
          image_input: [],
          aspect_ratio: "auto",
          resolution: "1K",
          output_format: "png",
        },
      }),
    });
    clearTimeout(timer);

    const bodyText = await res.text();
    if (!res.ok) {
      console.error("kie.ai createTask error", res.status, bodyText.slice(0, 300));
      if (isQuotaOrTokenError(res.status, bodyText)) {
        return {
          url: null,
          abortRest: true,
          reason: "Image API quota/token limit reached — continuing text only",
        };
      }
      return { url: null, abortRest: false };
    }

    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(bodyText);
    } catch {
      return { url: null, abortRest: false };
    }

    const nested = (data.data || data) as Record<string, unknown>;
    const taskId =
      nested.taskId || nested.id || nested.jobId || data.taskId || data.id;

    const directUrl =
      (nested.url as string) ||
      ((nested.output as Record<string, unknown>)?.url as string) ||
      (Array.isArray(nested.output) ? (nested.output[0] as string) : null);

    if (typeof directUrl === "string" && directUrl.startsWith("http")) {
      return { url: directUrl, abortRest: false };
    }

    if (!taskId) {
      console.warn("kie.ai unexpected response", bodyText.slice(0, 400));
      return { url: null, abortRest: false };
    }

    // Poll briefly — give up soft if slow
    const statusUrl = `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`;
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      try {
        const st = await fetch(statusUrl, {
          headers: { Authorization: `Bearer ${key}` },
        });
        const stText = await st.text();
        if (!st.ok) {
          if (isQuotaOrTokenError(st.status, stText)) {
            return {
              url: null,
              abortRest: true,
              reason: "Image API quota/token limit reached — continuing text only",
            };
          }
          continue;
        }
        const info = JSON.parse(stText);
        const infoData = (info.data || info) as Record<string, unknown>;
        const state = String(
          infoData.state || infoData.status || info.state || ""
        ).toLowerCase();

        if (
          state === "success" ||
          state === "completed" ||
          state === "done" ||
          state === "finished"
        ) {
          let url: string | null = null;
          const resultJson = infoData.resultJson;
          if (typeof resultJson === "string") {
            try {
              const parsed = JSON.parse(resultJson);
              url = parsed?.resultUrls?.[0] || null;
            } catch {
              /* ignore */
            }
          } else if (resultJson && typeof resultJson === "object") {
            url =
              (resultJson as { resultUrls?: string[] }).resultUrls?.[0] || null;
          }
          url =
            url ||
            (infoData.url as string) ||
            ((infoData.output as Record<string, unknown>)?.url as string) ||
            null;
          if (typeof url === "string" && url.startsWith("http")) {
            return { url, abortRest: false };
          }
          return { url: null, abortRest: false };
        }

        if (
          state === "failed" ||
          state === "error" ||
          state === "cancelled"
        ) {
          return { url: null, abortRest: false };
        }
      } catch (pollErr) {
        console.warn("kie poll error", pollErr);
      }
    }

    return { url: null, abortRest: false, reason: "Image generation timed out" };
  } catch (err) {
    console.warn("createIllustration failed", err);
    return { url: null, abortRest: false, reason: "Image generation error" };
  }
}

/**
 * Attach diagrams / flashcard images when requested.
 * Never throws — skips remaining images on quota/token errors.
 */
export async function attachIllustrations(
  study: StudyGeneration,
  opts: { diagrams?: boolean; flashcardImages?: boolean }
): Promise<IllustrateResult> {
  const next: StudyGeneration = {
    ...study,
    explainer: {
      sections: study.explainer.sections.map((s) => ({ ...s })),
    },
    quiz: { questions: [...study.quiz.questions] },
    flashcards: {
      cards: study.flashcards.cards.map((c) => ({ ...c })),
    },
  };

  let diagramsAdded = 0;
  let flashcardImagesAdded = 0;
  let skipped = false;
  let skipReason: string | undefined;
  let consecutiveFails = 0;

  if (opts.diagrams) {
    for (const sec of next.explainer.sections) {
      if (diagramsAdded >= 3) break;
      if (!sec.diagramPrompt) continue;

      const { url, abortRest, reason } = await createIllustration(
        `Educational diagram, clean flat style, no text labels: ${sec.diagramPrompt}`
      );

      if (url) {
        sec.diagramUrl = url;
        diagramsAdded++;
        consecutiveFails = 0;
      } else {
        consecutiveFails++;
        if (abortRest) {
          skipped = true;
          skipReason = reason || "Image quota/token limit";
          break;
        }
        // Two failures in a row → skip remaining images
        if (consecutiveFails >= 2) {
          skipped = true;
          skipReason = reason || "Image generation unavailable — text only";
          break;
        }
      }
    }
  }

  if (opts.flashcardImages && !skipped) {
    consecutiveFails = 0;
    for (const card of next.flashcards.cards) {
      if (flashcardImagesAdded >= 4) break;
      if (!card.imagePrompt) continue;

      const { url, abortRest, reason } = await createIllustration(
        `Simple educational illustration, soft colors, no text: ${card.imagePrompt}`
      );

      if (url) {
        card.imageUrl = url;
        flashcardImagesAdded++;
        consecutiveFails = 0;
      } else {
        consecutiveFails++;
        if (abortRest) {
          skipped = true;
          skipReason = reason || "Image quota/token limit";
          break;
        }
        if (consecutiveFails >= 2) {
          skipped = true;
          skipReason = reason || "Image generation unavailable — text only";
          break;
        }
      }
    }
  } else if (opts.flashcardImages && skipped) {
    // already aborted after diagrams
  }

  return {
    study: next,
    diagramsAdded,
    flashcardImagesAdded,
    skipped,
    skipReason,
  };
}
