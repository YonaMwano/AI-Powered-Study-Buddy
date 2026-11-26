import PptxGenJS from "pptxgenjs";
import type { Study } from "@/types";
import { difficultyLabel } from "./theme";
import { resolveStudyImages } from "./images";

/** pptxgenjs accepts data: URIs via the `data` field (base64 payload without prefix preferred in some versions). */
function imageOpts(
  dataUri: string | null | undefined,
  x: number,
  y: number,
  w: number,
  h: number
): { data: string; x: number; y: number; w: number; h: number } | null {
  if (!dataUri || !dataUri.startsWith("data:")) return null;
  // pptxgenjs: use full data URI or raw base64 — full data URI is more reliable
  return { data: dataUri, x, y, w, h };
}

export async function buildPptxBuffer(study: Study): Promise<Buffer> {
  const resolved = (await resolveStudyImages(study)) as Study;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "STUDY", width: 13.333, height: 7.5 });
  pptx.layout = "STUDY";
  pptx.author = "StudyBuddy AI";
  pptx.title = study.title || "Study";

  const sections = resolved.explainer?.sections ?? [];
  const questions = resolved.quiz?.questions ?? [];
  const cards = resolved.flashcards?.cards ?? [];

  // ---- Cover ----
  {
    const slide = pptx.addSlide();
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.333,
      h: 7.5,
      fill: { color: "0F172A" },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 0.15,
      h: 7.5,
      fill: { color: "6366F1" },
    });
    slide.addText(study.title || "Study set", {
      x: 0.8,
      y: 2.4,
      w: 11.5,
      h: 1.2,
      fontSize: 32,
      fontFace: "Arial",
      color: "FFFFFF",
      bold: true,
    });
    slide.addText(
      `${difficultyLabel(study.difficulty || "intermediate")}  ·  ${sections.length} sections  ·  ${questions.length} questions  ·  ${cards.length} cards`,
      {
        x: 0.8,
        y: 3.7,
        w: 11,
        h: 0.4,
        fontSize: 14,
        fontFace: "Arial",
        color: "94A3B8",
      }
    );
    slide.addText("StudyBuddy AI", {
      x: 0.8,
      y: 6.8,
      w: 4,
      h: 0.3,
      fontSize: 12,
      fontFace: "Arial",
      color: "64748B",
    });
  }

  // ---- Learning objectives ----
  {
    const slide = pptx.addSlide();
    slide.addText("Learning objectives", {
      x: 0.6,
      y: 0.4,
      w: 12,
      h: 0.5,
      fontSize: 24,
      fontFace: "Arial",
      color: "0F172A",
      bold: true,
    });
    const bullets = sections.map((sec) => ({
      text: sec.heading,
      options: { bullet: true, breakLine: true },
    }));
    if (bullets.length) {
      slide.addText(bullets, {
        x: 0.6,
        y: 1.2,
        w: 12,
        h: 5.5,
        fontSize: 16,
        fontFace: "Arial",
        color: "334155",
        paraSpaceAfter: 8,
      });
    }
  }

  // ---- One slide per explainer section (layout adapts when image exists) ----
  for (const sec of sections) {
    const slide = pptx.addSlide();
    const hasImage = !!(sec.diagramUrl && sec.diagramUrl.startsWith("data:"));
    const textW = hasImage ? 7.0 : 12.0;

    slide.addText(sec.heading, {
      x: 0.6,
      y: 0.3,
      w: textW,
      h: 0.55,
      fontSize: 20,
      fontFace: "Arial",
      color: "0F172A",
      bold: true,
    });

    const bodyText = (sec.body || []).slice(0, 4).join("\n\n");
    slide.addText(bodyText || " ", {
      x: 0.6,
      y: 1.0,
      w: textW,
      h: hasImage ? 3.0 : 3.4,
      fontSize: 13,
      fontFace: "Arial",
      color: "334155",
      valign: "top",
    });

    if (sec.keyPoints?.length) {
      slide.addText(
        sec.keyPoints.slice(0, 5).map((k) => ({
          text: k,
          options: { bullet: true, breakLine: true },
        })),
        {
          x: 0.6,
          y: hasImage ? 4.2 : 4.6,
          w: textW,
          h: hasImage ? 2.6 : 2.4,
          fontSize: 12,
          fontFace: "Arial",
          color: "475569",
        }
      );
    }

    if (hasImage) {
      const img = imageOpts(sec.diagramUrl, 8.0, 1.0, 4.7, 5.5);
      if (img) {
        try {
          slide.addImage(img);
        } catch (e) {
          console.warn("pptx section image skipped", e);
        }
      }
    }
  }

  // ---- Quiz: one question per slide ----
  questions.forEach((q, i) => {
    const slide = pptx.addSlide();
    slide.addText(`Question ${i + 1}`, {
      x: 0.6,
      y: 0.3,
      w: 12,
      h: 0.35,
      fontSize: 12,
      fontFace: "Arial",
      color: "6366F1",
    });
    slide.addText(q.prompt, {
      x: 0.6,
      y: 0.8,
      w: 12,
      h: 1.2,
      fontSize: 18,
      fontFace: "Arial",
      color: "0F172A",
      bold: true,
    });
    if (q.options?.length) {
      q.options.forEach((opt, j) => {
        slide.addText(`${String.fromCharCode(65 + j)}.  ${opt}`, {
          x: 0.8,
          y: 2.3 + j * 0.7,
          w: 11,
          h: 0.55,
          fontSize: 15,
          fontFace: "Arial",
          color: "334155",
        });
      });
    }
    slide.addNotes(`Answer: ${q.answer}\n\n${q.explanation || ""}`);
  });

  // ---- Flashcards ----
  // With image: one card per slide (clean layout). Without: two per slide.
  let i = 0;
  while (i < cards.length) {
    const c = cards[i];
    const hasImg = !!(c.imageUrl && c.imageUrl.startsWith("data:"));

    if (hasImg) {
      const slide = pptx.addSlide();
      slide.addText("Flashcard", {
        x: 0.6,
        y: 0.25,
        w: 12,
        h: 0.35,
        fontSize: 12,
        fontFace: "Arial",
        color: "6366F1",
      });
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.6,
        y: 0.8,
        w: 7.2,
        h: 6.0,
        fill: { color: "F8FAFC" },
        rectRadius: 0.12,
        line: { color: "E2E8F0", width: 1 },
      });
      slide.addText(c.front, {
        x: 0.9,
        y: 1.2,
        w: 6.6,
        h: 1.8,
        fontSize: 20,
        fontFace: "Arial",
        color: "0F172A",
        bold: true,
        valign: "middle",
      });
      slide.addText(c.back, {
        x: 0.9,
        y: 3.3,
        w: 6.6,
        h: 3.0,
        fontSize: 14,
        fontFace: "Arial",
        color: "475569",
        valign: "top",
      });
      const img = imageOpts(c.imageUrl, 8.2, 1.5, 4.5, 4.5);
      if (img) {
        try {
          slide.addImage(img);
        } catch (e) {
          console.warn("pptx flashcard image skipped", e);
        }
      }
      i += 1;
    } else {
      const slide = pptx.addSlide();
      slide.addText("Flashcards", {
        x: 0.6,
        y: 0.25,
        w: 12,
        h: 0.35,
        fontSize: 12,
        fontFace: "Arial",
        color: "6366F1",
      });
      const pair = cards.slice(i, i + 2);
      pair.forEach((card, idx) => {
        const x = 0.6 + idx * 6.3;
        slide.addShape(pptx.ShapeType.roundRect, {
          x,
          y: 1.0,
          w: 5.9,
          h: 5.6,
          fill: { color: "F8FAFC" },
          rectRadius: 0.12,
          line: { color: "E2E8F0", width: 1 },
        });
        slide.addText(card.front, {
          x: x + 0.3,
          y: 1.4,
          w: 5.3,
          h: 1.8,
          fontSize: 18,
          fontFace: "Arial",
          color: "0F172A",
          bold: true,
          valign: "middle",
        });
        slide.addText(card.back, {
          x: x + 0.3,
          y: 3.5,
          w: 5.3,
          h: 2.6,
          fontSize: 14,
          fontFace: "Arial",
          color: "475569",
          valign: "top",
        });
      });
      i += 2;
    }
  }

  const output = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return Buffer.from(output);
}
