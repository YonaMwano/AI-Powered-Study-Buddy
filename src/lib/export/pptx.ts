import PptxGenJS from "pptxgenjs";
import type { Study } from "@/types";
import { difficultyLabel } from "./theme";

export async function buildPptxBuffer(study: Study): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "STUDY", width: 13.333, height: 7.5 });
  pptx.layout = "STUDY";
  pptx.author = "StudyBuddy AI";
  pptx.title = study.title;

  const sections = study.explainer?.sections ?? [];
  const questions = study.quiz?.questions ?? [];
  const cards = study.flashcards?.cards ?? [];

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
    slide.addText(study.title, {
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
      `${difficultyLabel(study.difficulty)}  ·  ${sections.length} sections  ·  ${questions.length} questions  ·  ${cards.length} cards`,
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
    const bullets = sections.map((s) => ({
      text: s.heading,
      options: { bullet: true, breakLine: true },
    }));
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

  // ---- One slide per explainer section ----
  for (const sec of sections) {
    const slide = pptx.addSlide();
    slide.addText(sec.heading, {
      x: 0.6,
      y: 0.35,
      w: 12,
      h: 0.55,
      fontSize: 22,
      fontFace: "Arial",
      color: "0F172A",
      bold: true,
    });
    const bodyText = sec.body.slice(0, 3).join("\n\n");
    slide.addText(bodyText, {
      x: 0.6,
      y: 1.1,
      w: sec.diagramUrl ? 7.2 : 12,
      h: 3.2,
      fontSize: 14,
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
          y: 4.5,
          w: sec.diagramUrl ? 7.2 : 12,
          h: 2.5,
          fontSize: 13,
          fontFace: "Arial",
          color: "475569",
        }
      );
    }
    if (sec.diagramUrl) {
      try {
        slide.addImage({
          path: sec.diagramUrl,
          x: 8.2,
          y: 1.2,
          w: 4.5,
          h: 4.5,
        });
      } catch {
        /* remote image may fail offline */
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
      fontSize: 20,
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
          fontSize: 16,
          fontFace: "Arial",
          color: "334155",
        });
      });
    }
    // Answer in speaker notes
    slide.addNotes(`Answer: ${q.answer}\n\n${q.explanation || ""}`);
  });

  // ---- Flashcards: 2 per slide ----
  for (let i = 0; i < cards.length; i += 2) {
    const slide = pptx.addSlide();
    slide.addText("Flashcards", {
      x: 0.6,
      y: 0.3,
      w: 12,
      h: 0.4,
      fontSize: 14,
      fontFace: "Arial",
      color: "6366F1",
    });
    const pair = cards.slice(i, i + 2);
    pair.forEach((c, idx) => {
      const x = 0.6 + idx * 6.3;
      slide.addShape(pptx.ShapeType.roundRect, {
        x,
        y: 1.2,
        w: 5.8,
        h: 5,
        fill: { color: "F8FAFC" },
        rectRadius: 0.15,
        line: { color: "E2E8F0", width: 1 },
      });
      slide.addText(c.front, {
        x: x + 0.3,
        y: 1.6,
        w: 5.2,
        h: 1.5,
        fontSize: 18,
        fontFace: "Arial",
        color: "0F172A",
        bold: true,
        valign: "middle",
      });
      slide.addText(c.back, {
        x: x + 0.3,
        y: 3.4,
        w: 5.2,
        h: 2.2,
        fontSize: 14,
        fontFace: "Arial",
        color: "475569",
        valign: "top",
      });
    });
  }

  const output = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return Buffer.from(output);
}
