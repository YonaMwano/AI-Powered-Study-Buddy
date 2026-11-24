import type { SourceType } from "@/types";

export function detectSourceType(
  mime: string,
  filename: string
): SourceType {
  const lower = filename.toLowerCase();
  const m = mime.toLowerCase();

  if (m === "text/plain" || lower.endsWith(".txt") || lower.endsWith(".md")) {
    return "text";
  }
  if (
    m === "application/pdf" ||
    lower.endsWith(".pdf")
  ) {
    // Will be refined to pdf_text vs pdf_scan after extraction attempt
    return "pdf_text";
  }
  if (
    m.includes("wordprocessingml") ||
    m === "application/msword" ||
    lower.endsWith(".docx") ||
    lower.endsWith(".doc")
  ) {
    return "docx";
  }
  if (
    m.includes("presentationml") ||
    m === "application/vnd.ms-powerpoint" ||
    lower.endsWith(".pptx") ||
    lower.endsWith(".ppt")
  ) {
    return "pptx";
  }
  if (
    m.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(lower)
  ) {
    return "image";
  }

  // Fallback
  if (lower.endsWith(".pdf")) return "pdf_text";
  return "text";
}

export function isAllowedMime(mime: string, filename: string): boolean {
  const allowed = [
    "text/plain",
    "text/markdown",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  if (allowed.includes(mime)) return true;
  // Extension fallback
  const lower = filename.toLowerCase();
  return /\.(txt|md|pdf|docx?|pptx?|jpe?g|png|webp|gif)$/i.test(lower);
}

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
