import type { SourceType } from "@/types";

export interface ExtractionResult {
  text: string;
  sourceType: SourceType;
  pageImages: string[]; // base64 data URLs or later storage URLs
  pageCount?: number;
  tables?: string[];
  headings?: string[];
}

/**
 * Extract text from typed PDF. Returns empty text if it looks like a scan.
 */
export async function extractPdfText(buffer: Buffer): Promise<{
  text: string;
  isLikelyScan: boolean;
  pageCount: number;
}> {
  try {
    // Dynamic import — pdf-parse is CommonJS / Node only
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    const text = (data.text || "").trim();
    const pageCount = data.numpages || 1;

    // Heuristic: very little text relative to pages → scanned
    const charsPerPage = text.length / Math.max(pageCount, 1);
    const isLikelyScan = charsPerPage < 80 && pageCount > 0;

    return { text, isLikelyScan, pageCount };
  } catch (err) {
    console.error("pdf-parse failed", err);
    return { text: "", isLikelyScan: true, pageCount: 1 };
  }
}

/**
 * Convert PDF pages to JPEG buffers (for vision). Max pages processed = maxPages.
 * Uses pdfjs-dist + sharp.
 */
export async function pdfToImages(
  buffer: Buffer,
  maxPages = 12
): Promise<{ images: Buffer[]; pageCount: number }> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // @ts-expect-error – worker not needed in Node for getDocument
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pageCount = Math.min(doc.numPages, maxPages);
    const images: Buffer[] = [];

    const sharp = (await import("sharp")).default;

    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 }); // ~150 DPI-ish
      const canvasFactory = {
        create: (width: number, height: number) => {
          // Minimal canvas polyfill for Node – we use sharp path instead when possible
          // For robustness we render via pdfjs operator list is complex;
          // fallback: return empty and rely on vision of original if needed.
          return {
            width,
            height,
            getContext: () => null,
          };
        },
        reset: () => {},
        destroy: () => {},
      };

      // Simpler approach for reliability in serverless: use a lightweight
      // rasterization if available, otherwise skip image conversion here
      // and let the caller send the original PDF page as image later.
      // For production we recommend a dedicated service; here we provide
      // a best-effort path.

      try {
        // Attempt render with node-canvas if present, else skip
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { createCanvas } = require("canvas");
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext("2d");
        await page.render({
          canvasContext: context,
          viewport,
          canvasFactory: {
            create: (w: number, h: number) => createCanvas(w, h),
            reset: (c: { width: number; height: number }, w: number, h: number) => {
              c.width = w;
              c.height = h;
            },
            destroy: () => {},
          },
        }).promise;
        const png = canvas.toBuffer("image/png");
        const jpeg = await sharp(png)
          .jpeg({ quality: 85 })
          .resize({ width: 2048, withoutEnlargement: true })
          .toBuffer();
        images.push(jpeg);
      } catch {
        // canvas not available – skip rasterization in this environment
        // Caller will treat as text-only or use original file for vision
      }
    }

    return { images, pageCount: doc.numPages };
  } catch (err) {
    console.error("pdfToImages failed", err);
    return { images: [], pageCount: 1 };
  }
}

export async function extractDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return (result.value || "").trim();
  } catch (err) {
    console.error("mammoth failed", err);
    return "";
  }
}

export async function extractPptx(buffer: Buffer): Promise<string> {
  try {
    // officeparser supports pptx
    const officeParser = await import("officeparser");
    const text = await new Promise<string>((resolve, reject) => {
      officeParser.parseOffice(buffer, (data: string, err: Error) => {
        if (err) reject(err);
        else resolve(data || "");
      });
    });
    return text.trim();
  } catch (err) {
    console.error("pptx extract failed", err);
    // Fallback: try to read as zip of XML (lightweight)
    return "";
  }
}

export async function extractPlainText(buffer: Buffer): Promise<string> {
  return buffer.toString("utf-8").trim();
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
      if (isLikelyScan || !text) {
        // Attempt images for vision path
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
      // Single image → base64 for vision
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
