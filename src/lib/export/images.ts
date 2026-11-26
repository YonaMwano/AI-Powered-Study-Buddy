/**
 * Fetch remote images to base64 data-URIs for PDF / PPTX embedding.
 * Fails soft: returns null if download fails (export continues without image).
 */

export async function urlToDataUri(
  url: string | null | undefined,
  timeoutMs = 12_000
): Promise<string | null> {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("data:")) return url;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "image/*" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const contentType =
      res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 8_000_000) return null;
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch (err) {
    console.warn("image fetch failed", url.slice(0, 80), err);
    return null;
  }
}

/** Resolve all diagram + flashcard image URLs on a study to data URIs (in place copy). */
export async function resolveStudyImages<T extends {
  explainer?: { sections?: Array<{ diagramUrl?: string | null }> };
  flashcards?: { cards?: Array<{ imageUrl?: string | null }> };
}>(study: T): Promise<T> {
  const sections = study.explainer?.sections ?? [];
  const cards = study.flashcards?.cards ?? [];

  const sectionUrls = await Promise.all(
    sections.map((s) => urlToDataUri(s.diagramUrl))
  );
  const cardUrls = await Promise.all(
    cards.map((c) => urlToDataUri(c.imageUrl))
  );

  return {
    ...study,
    explainer: study.explainer
      ? {
          ...study.explainer,
          sections: sections.map((s, i) => ({
            ...s,
            diagramUrl: sectionUrls[i] || null,
          })),
        }
      : study.explainer,
    flashcards: study.flashcards
      ? {
          ...study.flashcards,
          cards: cards.map((c, i) => ({
            ...c,
            imageUrl: cardUrls[i] || null,
          })),
        }
      : study.flashcards,
  };
}
