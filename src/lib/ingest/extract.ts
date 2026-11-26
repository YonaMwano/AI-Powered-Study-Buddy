import type { SourceType } from "@/types";

export interface ExtractionResult {
  text: string;
  sourceType: SourceType;
  pageImages: string[];
  pageCount?: number;
  tables?: string[];
  headings?: string[];
}

function normalizeExtractedText(raw: string): string {
  return (raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]{2,}/g, " ")
    .trim();
}

/**
 * Primary PDF text path: pdfjs-dist (works on Vercel Node, no test-file side effects).
 */
async function extractWithPdfJs(buffer: Buffer): Promise<{
  text: string;
  pageCount: number;
}> {
  // Use legacy build for Node / SSR compatibility
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Disable worker in serverless
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = false as unknown as string;
  }

  const data = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    // Some PDFs need this for CMap-based fonts
    disableFontFace: true,
  });

  const doc = await loadingTask.promise;
  const pageCount = doc.numPages || 1;
  const parts: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const lineMap = new Map<number, string[]>();

      for (const item of content.items as Array<{
        str?: string;
        transform?: number[];
      }>) {
        const str = (item.str || "").trim();
        if (!str) continue;
        // Group by approximate Y so reading order is closer to visual order
        const y = item.transform ? Math.round(item.transform[5] / 4) * 4 : 0;
        const arr = lineMap.get(y) || [];
        arr.push(str);
        lineMap.set(y, arr);
      }

      // Higher Y first (PDF coordinate system)
      const ys = Array.from(lineMap.keys()).sort((a, b) => b - a);
      const pageLines = ys.map((y) => lineMap.get(y)!.join(" "));
      if (pageLines.length) parts.push(pageLines.join("\n"));
    } catch (pageErr) {
      console.warn(`pdfjs page ${i} failed`, pageErr);
    }
  }

  try {
    await doc.destroy();
  } catch {
    /* ignore */
  }

  return { text: normalizeExtractedText(parts.join("\n\n")), pageCount };
}

/**
 * Fallback: pdf-parse (can fail under Next webpack — swallow errors).
 */
async function extractWithPdfParse(buffer: Buffer): Promise<{
  text: string;
  pageCount: number;
}> {
  try {
    // Prefer deep import to avoid pdf-parse's debug test-file require
    let pdfParse: (b: Buffer) => Promise<{ text: string; numpages: number }>;
    try {
      const mod = await import("pdf-parse/lib/pdf-parse.js");
      pdfParse = mod.default;
    } catch {
      const mod = await import("pdf-parse");
      pdfParse = mod.default;
    }

    const data = await pdfParse(buffer);
    return {
      text: normalizeExtractedText(data.text || ""),
      pageCount: data.numpages || 1,
    };
  } catch (err) {
    console.warn("pdf-parse fallback failed", err);
    return { text: "", pageCount: 1 };
  }
}

/**
 * Last-resort: pull readable Latin strings out of the raw PDF bytes.
 * Helps with some simple text PDFs when parsers fail.
 */
function extractRawPdfStrings(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const chunks: string[] = [];

  // Text in parentheses after Tj / TJ operators (very rough)
  const parenRe = /\((?:\\.|[^\\)]){3,}\)/g;
  let m: RegExpExecArray | null;
  while ((m = parenRe.exec(raw)) !== null) {
    let s = m[0].slice(1, -1);
    s = s
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\t/g, " ")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\")
      .replace(/\\(\d{3})/g, (_, oct) =>
        String.fromCharCode(parseInt(oct, 8))
      );
    // Keep mostly printable
    if (/[A-Za-z]{2,}/.test(s)) {
      chunks.push(s);
    }
  }

  // Also grab long ASCII runs outside binary noise
  const asciiRe = /[A-Za-z0-9][A-Za-z0-9 ,.;:'"\-\/()]{12,}/g;
  while ((m = asciiRe.exec(raw)) !== null) {
    const s = m[0].trim();
    if (
      !s.includes("endobj") &&
      !s.includes("stream") &&
      !s.startsWith("http")
    ) {
      chunks.push(s);
    }
  }

  return normalizeExtractedText(chunks.join(" "));
}

/**
 * Extract text from a PDF. Tries pdfjs → pdf-parse → raw scrape.
 */
export async function extractPdfText(buffer: Buffer): Promise<{
  text: string;
  isLikelyScan: boolean;
  pageCount: number;
}> {
  let text = "";
  let pageCount = 1;

  // 1) pdfjs-dist
  try {
    const r = await extractWithPdfJs(buffer);
    text = r.text;
    pageCount = r.pageCount;
  } catch (err) {
    console.warn("pdfjs extract failed", err);
  }

  // 2) pdf-parse if still thin
  if (text.length < 40) {
    const r = await extractWithPdfParse(buffer);
    if (r.text.length > text.length) {
      text = r.text;
      pageCount = Math.max(pageCount, r.pageCount);
    }
  }

  // 3) raw byte scrape
  if (text.length < 40) {
    const raw = extractRawPdfStrings(buffer);
    if (raw.length > text.length) text = raw;
  }

  const charsPerPage = text.length / Math.max(pageCount, 1);
  // Only call it a scan when we truly got almost nothing
  const isLikelyScan = text.length < 40 || charsPerPage < 30;

  return { text, isLikelyScan, pageCount };
}

/**
 * PDF → images for vision (not available without native canvas on Vercel).
 */
export async function pdfToImages(
  _buffer: Buffer,
  maxPages = 12
): Promise<{ images: Buffer[]; pageCount: number }> {
  void maxPages;
  return { images: [], pageCount: 1 };
}

export async function extractDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return normalizeExtractedText(result.value || "");
  } catch (err) {
    console.error("mammoth failed", err);
    return "";
  }
}

export async function extractPptx(buffer: Buffer): Promise<string> {
  try {
    const officeParser = await import("officeparser");
    const text = await new Promise<string>((resolve, reject) => {
      officeParser.parseOffice(buffer, (data: string, err: Error | null) => {
        if (err) reject(err);
        else resolve(data || "");
      });
    });
    return normalizeExtractedText(text);
  } catch (err) {
    console.error("pptx extract failed", err);
    return "";
  }
}

export async function extractPlainText(buffer: Buffer): Promise<string> {
  return normalizeExtractedText(buffer.toString("utf-8"));
}

/**
 * Main dispatcher
 */
export async function extractFromBuffer(
  buffer: Buffer,
  sourceType: SourceType,
  filename: string
): Promise<ExtractionResult> {
  switch (sourceType) {
    case "text": {
      const text = await extractPlainText(buffer);
      return { text, sourceType: "text", pageImages: [] };
    }
    case "docx": {
      const text = await extractDocx(buffer);
      return { text, sourceType: "docx", pageImages: [] };
    }
    case "pptx": {
      const text = await extractPptx(buffer);
      return { text, sourceType: "pptx", pageImages: [] };
    }
    case "pdf_text":
    case "pdf_scan": {
      const { text, isLikelyScan, pageCount } = await extractPdfText(buffer);

      // Prefer text whenever we have a usable amount — don't force scan path
      if (text.length >= 40) {
        return {
          text,
          sourceType: "pdf_text",
          pageImages: [],
          pageCount,
        };
      }

      if (isLikelyScan || !text) {
        const { images } = await pdfToImages(buffer, 12);
        const pageImages = images.map(
          (b) => `data:image/jpeg;base64,${b.toString("base64")}`
        );
        return {
          text: text || "",
          sourceType: "pdf_scan",
          pageImages,
          pageCount,
        };
      }

      return {
        text,
        sourceType: "pdf_text",
        pageImages: [],
        pageCount,
      };
    }
    case "image": {
      const b64 = buffer.toString("base64");
      const mime = filename.toLowerCase().endsWith(".png")
        ? "image/png"
        : "image/jpeg";
      return {
        text: "",
        sourceType: "image",
        pageImages: [`data:${mime};base64,${b64}`],
        pageCount: 1,
      };
    }
    default:
      return { text: "", sourceType: "text", pageImages: [] };
  }
}
