/**
 * PDF export via pdf-lib — no pdfkit, no filesystem fonts.
 * All text is sanitized to WinAnsi so StandardFonts.Helvetica never throws.
 */
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type PDFImage,
} from "pdf-lib";
import type { Study } from "@/types";
import { difficultyLabel } from "./theme";
import { resolveStudyImages } from "./images";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.39, 0.45, 0.55);
const ACCENT = rgb(0.39, 0.4, 0.95);
const SUCCESS = rgb(0.06, 0.73, 0.51);
const KEY_BG = rgb(0.95, 0.96, 0.98);

/** Strip / replace characters pdf-lib Helvetica cannot encode (WinAnsi). */
function safeText(input: unknown): string {
  if (input == null) return "";
  let s = String(input);
  s = s
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  // Keep printable ASCII + Latin-1 (WinAnsi subset roughly)
  s = s.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
  return s;
}

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  y: number;
};

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN;
  drawFooter(ctx);
}

function drawFooter(ctx: Ctx) {
  try {
    ctx.page.drawText("StudyBuddy AI", {
      x: MARGIN,
      y: 28,
      size: 8,
      font: ctx.font,
      color: MUTED,
    });
  } catch {
    /* ignore */
  }
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN + 36) newPage(ctx);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safeText(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    let width = 0;
    try {
      width = font.widthOfTextAtSize(test, size);
    } catch {
      width = test.length * size * 0.5;
    }
    if (width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawParagraph(
  ctx: Ctx,
  text: string,
  opts: {
    size?: number;
    bold?: boolean;
    color?: ReturnType<typeof rgb>;
    gapAfter?: number;
    maxWidth?: number;
  } = {}
) {
  const size = opts.size ?? 11;
  const font = opts.bold ? ctx.fontBold : ctx.font;
  const color = opts.color ?? INK;
  const maxWidth = opts.maxWidth ?? CONTENT_W;
  const lines = wrapText(text, font, size, maxWidth);
  const lineHeight = size * 1.45;

  for (const line of lines) {
    ensureSpace(ctx, lineHeight + 2);
    try {
      ctx.page.drawText(line, {
        x: MARGIN,
        y: ctx.y - size,
        size,
        font,
        color,
      });
    } catch (e) {
      console.warn("drawText skipped line", e);
    }
    ctx.y -= lineHeight;
  }
  ctx.y -= opts.gapAfter ?? 4;
}

async function embedDataImage(
  doc: PDFDocument,
  dataUri: string | null | undefined
): Promise<PDFImage | null> {
  if (!dataUri || !dataUri.startsWith("data:")) return null;
  try {
    const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    const mime = match[1].toLowerCase();
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length < 32 || bytes.length > 6_000_000) return null;
    if (mime.includes("png")) return await doc.embedPng(bytes);
    if (mime.includes("jpeg") || mime.includes("jpg")) return await doc.embedJpg(bytes);
    try {
      return await doc.embedPng(bytes);
    } catch {
      return await doc.embedJpg(bytes);
    }
  } catch {
    return null;
  }
}

function drawImage(ctx: Ctx, image: PDFImage, maxW = CONTENT_W * 0.55, maxH = 160) {
  const scale = Math.min(maxW / image.width, maxH / image.height, 1);
  const w = image.width * scale;
  const h = image.height * scale;
  ensureSpace(ctx, h + 16);
  try {
    ctx.page.drawImage(image, { x: MARGIN, y: ctx.y - h, width: w, height: h });
  } catch {
    /* skip broken image */
  }
  ctx.y -= h + 12;
}

export async function buildPdfBuffer(study: Study): Promise<Buffer> {
  let resolved: Study = study;
  try {
    resolved = (await resolveStudyImages(study)) as Study;
  } catch (e) {
    console.warn("image resolve skipped", e);
  }

  const sections = resolved.explainer?.sections ?? [];
  const questions = resolved.quiz?.questions ?? [];
  const cards = resolved.flashcards?.cards ?? [];

  const doc = await PDFDocument.create();
  doc.setTitle(safeText(study.title) || "Study");
  doc.setAuthor("StudyBuddy AI");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ctx: Ctx = {
    doc,
    page: doc.addPage([PAGE_W, PAGE_H]),
    font,
    fontBold,
    y: PAGE_H - MARGIN,
  };
  drawFooter(ctx);

  // Cover
  drawParagraph(ctx, safeText(study.title) || "Study set", {
    size: 24,
    bold: true,
    gapAfter: 10,
  });
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 4,
    width: 72,
    height: 4,
    color: ACCENT,
  });
  ctx.y -= 20;
  drawParagraph(
    ctx,
    `Difficulty: ${difficultyLabel(study.difficulty || "intermediate")}`,
    { size: 10, color: MUTED, gapAfter: 2 }
  );
  drawParagraph(
    ctx,
    `${sections.length} sections · ${questions.length} quiz questions · ${cards.length} flashcards`,
    { size: 10, color: MUTED, gapAfter: 16 }
  );
  drawParagraph(ctx, "Generated by StudyBuddy AI", { size: 10, color: MUTED });

  // Explainer
  newPage(ctx);
  drawParagraph(ctx, "Explainer", { size: 18, bold: true, gapAfter: 12 });

  for (const sec of sections) {
    ensureSpace(ctx, 60);
    drawParagraph(ctx, safeText(sec.heading), { size: 13, bold: true, gapAfter: 6 });
    for (const p of sec.body || []) {
      drawParagraph(ctx, safeText(p), { size: 11, gapAfter: 4 });
    }
    if (sec.keyPoints?.length) {
      ensureSpace(ctx, 30 + sec.keyPoints.length * 12);
      drawParagraph(ctx, "KEY POINTS", {
        size: 8,
        bold: true,
        color: ACCENT,
        gapAfter: 4,
      });
      for (const kp of sec.keyPoints) {
        drawParagraph(ctx, `• ${safeText(kp)}`, { size: 10, gapAfter: 2 });
      }
      ctx.y -= 4;
    }
    if (sec.diagramUrl) {
      const img = await embedDataImage(doc, sec.diagramUrl);
      if (img) drawImage(ctx, img);
    }
    ctx.y -= 6;
  }

  // Quiz
  newPage(ctx);
  drawParagraph(ctx, "Quiz", { size: 18, bold: true, gapAfter: 12 });
  questions.forEach((q, i) => {
    ensureSpace(ctx, 50);
    drawParagraph(ctx, `${i + 1}. ${safeText(q.prompt)}`, {
      size: 11,
      bold: true,
      gapAfter: 4,
    });
    (q.options || []).forEach((opt, j) => {
      drawParagraph(ctx, `${String.fromCharCode(65 + j)}. ${safeText(opt)}`, {
        size: 10,
        gapAfter: 2,
      });
    });
    drawParagraph(ctx, `Answer: ${safeText(q.answer)}`, {
      size: 9,
      color: SUCCESS,
      gapAfter: 2,
    });
    if (q.explanation) {
      drawParagraph(ctx, safeText(q.explanation), {
        size: 9,
        color: MUTED,
        gapAfter: 8,
      });
    } else {
      ctx.y -= 6;
    }
  });

  // Flashcards
  newPage(ctx);
  drawParagraph(ctx, "Flashcards", { size: 18, bold: true, gapAfter: 12 });
  for (const c of cards) {
    ensureSpace(ctx, 48);
    drawParagraph(ctx, safeText(c.front), { size: 11, bold: true, gapAfter: 2 });
    drawParagraph(ctx, safeText(c.back), { size: 10, color: MUTED, gapAfter: 10 });
  }

  // Page numbers
  const pages = doc.getPages();
  const total = pages.length;
  pages.forEach((page, idx) => {
    const label = `Page ${idx + 1} of ${total}`;
    try {
      const w = font.widthOfTextAtSize(label, 8);
      page.drawText(label, {
        x: PAGE_W - MARGIN - w,
        y: 28,
        size: 8,
        font,
        color: MUTED,
      });
    } catch {
      /* ignore */
    }
  });

  const bytes = await doc.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}
