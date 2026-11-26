/**
 * Zero-dependency PDF builder (PDF 1.4).
 * Uses standard Helvetica by name — no pdf-lib, no pdfkit, no font files.
 * Works on Vercel even when package.json was not updated with pdf-lib.
 */
import type { Study } from "@/types";
import { difficultyLabel } from "./theme";

type RGB = [number, number, number];

function escPdf(text: string): string {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x09\x20-\x7E\n]/g, "");
}

function wrap(text: string, maxChars: number): string[] {
  const words = escPdf(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (test.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Approximate char width for Helvetica at size (points) */
function charsForWidth(pageWidth: number, margin: number, fontSize: number): number {
  const usable = pageWidth - margin * 2;
  // Helvetica average ~0.5em per char
  return Math.max(20, Math.floor(usable / (fontSize * 0.5)));
}

type LineCmd = {
  text: string;
  size: number;
  bold?: boolean;
  color?: RGB;
  gapAfter?: number;
};

function buildPageContent(
  lines: LineCmd[],
  pageW: number,
  pageH: number,
  margin: number
): string {
  const ops: string[] = [];
  let y = pageH - margin;

  for (const item of lines) {
    const size = item.size;
    const maxChars = charsForWidth(pageW, margin, size);
    const wrapped = wrap(item.text, maxChars);
    const color = item.color ?? ([0.06, 0.09, 0.16] as RGB);
    const font = item.bold ? "F2" : "F1";
    const leading = size * 1.4;

    for (const wline of wrapped) {
      if (y < margin + 40) {
        // caller should split pages; mark overflow by stopping
        break;
      }
      y -= leading;
      ops.push("BT");
      ops.push(`/${font} ${size} Tf`);
      ops.push(`${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg`);
      ops.push(`1 0 0 1 ${margin} ${y.toFixed(2)} Tm`);
      ops.push(`(${wline}) Tj`);
      ops.push("ET");
    }
    y -= item.gapAfter ?? 4;
  }

  // footer label
  ops.push("BT");
  ops.push("/F1 8 Tf");
  ops.push("0.4 0.45 0.55 rg");
  ops.push(`1 0 0 1 ${margin} 28 Tm`);
  ops.push("(StudyBuddy AI) Tj");
  ops.push("ET");

  return ops.join("\n");
}

function splitIntoPages(
  allLines: LineCmd[],
  pageW: number,
  pageH: number,
  margin: number
): string[] {
  const pages: string[] = [];
  let batch: LineCmd[] = [];
  let used = 0;
  const usable = pageH - margin * 2 - 40;

  const estimate = (item: LineCmd) => {
    const maxChars = charsForWidth(pageW, margin, item.size);
    const n = wrap(item.text, maxChars).length;
    return n * item.size * 1.4 + (item.gapAfter ?? 4);
  };

  for (const item of allLines) {
    const h = estimate(item);
    if (used + h > usable && batch.length) {
      pages.push(buildPageContent(batch, pageW, pageH, margin));
      batch = [];
      used = 0;
    }
    batch.push(item);
    used += h;
  }
  if (batch.length) pages.push(buildPageContent(batch, pageW, pageH, margin));
  if (!pages.length) pages.push(buildPageContent([{ text: "Empty study", size: 12 }], pageW, pageH, margin));
  return pages;
}

/**
 * Assemble a valid PDF-1.4 buffer from page content streams.
 */
function assemblePdf(pageContents: string[]): Buffer {
  const pageW = 595.28;
  const pageH = 841.89;
  const objects: string[] = [];

  // 1: Catalog
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  // 2: Pages (kids filled later)
  const pageObjNumbers: number[] = [];
  // We'll assign: 1 catalog, 2 pages, 3 F1, 4 F2, then pairs of page+content

  const fontF1 = 3;
  const fontF2 = 4;
  objects.push(""); // placeholder for pages tree
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const kids: string[] = [];
  for (let i = 0; i < pageContents.length; i++) {
    const pageObj = objects.length + 1; // next index (1-based later)
    const contentObj = objects.length + 2;
    // page
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${fontF1} 0 R /F2 ${fontF2} 0 R >> >> /Contents ${contentObj} 0 R >>`
    );
    const stream = pageContents[i];
    // Add page number into stream
    const withNum =
      stream +
      `\nBT\n/F1 8 Tf\n0.4 0.45 0.55 rg\n1 0 0 1 ${(pageW - 80).toFixed(1)} 28 Tm\n(Page ${i + 1} of ${pageContents.length}) Tj\nET`;
    objects.push(
      `<< /Length ${Buffer.byteLength(withNum, "utf8")} >>\nstream\n${withNum}\nendstream`
    );
    kids.push(`${pageObj} 0 R`);
    pageObjNumbers.push(pageObj);
  }

  // Fix pages tree at index 1 (0-based)
  objects[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pageContents.length} >>`;

  // Build xref
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefPos = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefPos}\n%%EOF\n`;

  return Buffer.from(pdf, "utf8");
}

export async function buildPdfBuffer(study: Study): Promise<Buffer> {
  const sections = study.explainer?.sections ?? [];
  const questions = study.quiz?.questions ?? [];
  const cards = study.flashcards?.cards ?? [];

  const ACCENT: RGB = [0.39, 0.4, 0.95];
  const MUTED: RGB = [0.39, 0.45, 0.55];
  const SUCCESS: RGB = [0.06, 0.73, 0.51];

  const lines: LineCmd[] = [];

  // Cover
  lines.push({
    text: study.title || "Study set",
    size: 22,
    bold: true,
    gapAfter: 12,
  });
  lines.push({
    text: `Difficulty: ${difficultyLabel(study.difficulty || "intermediate")}`,
    size: 11,
    color: MUTED,
    gapAfter: 4,
  });
  lines.push({
    text: `${sections.length} sections · ${questions.length} quiz questions · ${cards.length} flashcards`,
    size: 11,
    color: MUTED,
    gapAfter: 16,
  });
  lines.push({
    text: "Generated by StudyBuddy AI",
    size: 10,
    color: MUTED,
    gapAfter: 24,
  });

  // Explainer
  lines.push({ text: "Explainer", size: 16, bold: true, color: ACCENT, gapAfter: 12 });
  for (const sec of sections) {
    lines.push({ text: sec.heading || "Section", size: 13, bold: true, gapAfter: 6 });
    for (const p of sec.body || []) {
      lines.push({ text: p, size: 11, gapAfter: 4 });
    }
    if (sec.keyPoints?.length) {
      lines.push({ text: "Key points", size: 10, bold: true, color: ACCENT, gapAfter: 4 });
      for (const kp of sec.keyPoints) {
        lines.push({ text: `• ${kp}`, size: 10, gapAfter: 2 });
      }
    }
    lines.push({ text: " ", size: 8, gapAfter: 8 });
  }

  // Quiz
  lines.push({ text: "Quiz", size: 16, bold: true, color: ACCENT, gapAfter: 12 });
  questions.forEach((q, i) => {
    lines.push({
      text: `${i + 1}. ${q.prompt}`,
      size: 11,
      bold: true,
      gapAfter: 4,
    });
    (q.options || []).forEach((opt, j) => {
      lines.push({
        text: `${String.fromCharCode(65 + j)}. ${opt}`,
        size: 10,
        gapAfter: 2,
      });
    });
    lines.push({
      text: `Answer: ${q.answer}`,
      size: 10,
      color: SUCCESS,
      gapAfter: 2,
    });
    if (q.explanation) {
      lines.push({ text: q.explanation, size: 9, color: MUTED, gapAfter: 8 });
    } else {
      lines.push({ text: " ", size: 8, gapAfter: 6 });
    }
  });

  // Flashcards
  lines.push({ text: "Flashcards", size: 16, bold: true, color: ACCENT, gapAfter: 12 });
  for (const c of cards) {
    lines.push({ text: c.front || "", size: 11, bold: true, gapAfter: 2 });
    lines.push({ text: c.back || "", size: 10, color: MUTED, gapAfter: 10 });
  }

  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 48;
  const pageStreams = splitIntoPages(lines, pageW, pageH, margin);
  return assemblePdf(pageStreams);
}
