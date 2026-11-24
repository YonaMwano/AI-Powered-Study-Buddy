/**
 * kie.ai nano-banana-2-1 image generation
 */

import type { StudyGeneration } from "@/types";

const KIE_CREATE = "https://api.kie.ai/api/v1/jobs/createTask";

export async function createIllustration(prompt: string): Promise<string | null> {
  const key = process.env.KIE_API_KEY;
  if (!key) {
    console.warn("KIE_API_KEY missing");
    return null;
  }

  try {
    const res = await fetch(KIE_CREATE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nano-banana-2-1",
        input: {
          prompt: prompt.slice(0, 800),
          image_input: [],
          aspect_ratio: "auto",
          resolution: "1K",
          output_format: "png",
        },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("kie.ai createTask error", res.status, t);
      return null;
    }

    const data = await res.json();
    const taskId =
      data?.data?.taskId ||
      data?.taskId ||
      data?.data?.id ||
      data?.id ||
      data?.jobId;

    if (!taskId) {
      const url =
        data?.data?.url ||
        data?.url ||
        data?.data?.output?.url ||
        data?.output?.[0];
      if (typeof url === "string" && url.startsWith("http")) return url;
      console.warn("kie.ai unexpected response", JSON.stringify(data).slice(0, 400));
      return null;
    }

    const statusUrl = `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const st = await fetch(statusUrl, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!st.ok) continue;
      const info = await st.json();
      const state =
        info?.data?.state ||
        info?.state ||
        info?.data?.status ||
        info?.status;
      if (state === "success" || state === "completed" || state === "done") {
        const url =
          info?.data?.resultJson?.resultUrls?.[0] ||
          info?.data?.output?.url ||
          info?.data?.url ||
          info?.url ||
          info?.data?.result?.url;
        if (typeof url === "string") return url;
        try {
          const parsed =
            typeof info?.data?.resultJson === "string"
              ? JSON.parse(info.data.resultJson)
              : info?.data?.resultJson;
          if (parsed?.resultUrls?.[0]) return parsed.resultUrls[0];
        } catch {
          /* ignore */
        }
      }
      if (state === "fail" || state === "failed" || state === "error") {
        console.error("kie.ai job failed", info);
        return null;
      }
    }
    return null;
  } catch (err) {
    console.error("createIllustration", err);
    return null;
  }
}

/**
 * Attach diagram / flashcard images to a full study payload (max 3 diagrams).
 * Returns the same StudyGeneration shape with optional URLs filled in.
 */
export async function attachIllustrations(
  study: StudyGeneration,
  opts: { diagrams: boolean; flashcardImages: boolean }
): Promise<StudyGeneration> {
  const next: StudyGeneration = {
    title: study.title,
    difficulty: study.difficulty,
    explainer: {
      sections: study.explainer.sections.map((s) => ({ ...s })),
    },
    quiz: {
      questions: study.quiz.questions.map((q) => ({
        ...q,
        options: q.options ? [...q.options] : undefined,
      })),
    },
    flashcards: {
      cards: study.flashcards.cards.map((c) => ({ ...c })),
    },
  };

  if (opts.diagrams) {
    let count = 0;
    for (const section of next.explainer.sections) {
      if (count >= 3) break;
      if (section.diagramPrompt) {
        const url = await createIllustration(
          `Educational diagram, clean flat style, white background, no text: ${section.diagramPrompt}`
        );
        if (url) {
          section.diagramUrl = url;
          count++;
        }
      }
    }
  }

  if (opts.flashcardImages) {
    let count = 0;
    for (const card of next.flashcards.cards) {
      if (count >= 4) break;
      if (card.imagePrompt) {
        const url = await createIllustration(
          `Simple educational illustration, soft colors, no text: ${card.imagePrompt}`
        );
        if (url) {
          card.imageUrl = url;
          count++;
        }
      }
    }
  }

  return next;
}
