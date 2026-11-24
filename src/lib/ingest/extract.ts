import type { SourceType } from "@/types";

export interface ExtractionResult {
  text: string;
  sourceType: SourceType;
  pageImages: string[];
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
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    const text = (data.text || "").trim();
    const pageCount = data.numpages || 1;
    const charsPerPage = text.length / Math.max(pageCount, 1);
    const isLikelyScan = charsPerPage < 80 && pageCount > 0;
    return { text, isLikelyScan, pageCount };
  } catch (err) {
    console.error("pdf-parse failed", err);
    return { text: "", isLikelyScan: true, pageCount: 1 };
  }
}

/**
 * PDF → images for vision.
 * On Vercel/serverless we skip native canvas rasterization (not available).
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
    return (result.value || "").trim();
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
    return text.trim();
  } catch (err) {
    console.error("pptx extract failed", err);
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
