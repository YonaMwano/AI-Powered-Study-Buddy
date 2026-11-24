/**
 * Post-processor that strips markdown / emoji / dirty formatting
 * so the AI JSON can never leak ** # ``` etc into the UI or exports.
 */

const MARKDOWN_PATTERNS: Array<[RegExp, string]> = [
  [/\*\*([^*]+)\*\*/g, "$1"],
  [/__([^_]+)__/g, "$1"],
  [/\*([^*]+)\*/g, "$1"],
  [/_([^_]+)_/g, "$1"],
  [/`([^`]+)`/g, "$1"],
  [/^#{1,6}\s+/gm, ""],
  [/^\s*[-*+]\s+/gm, ""],
  [/^\s*\d+\.\s+/gm, ""],
  [/\[([^\]]+)\]\([^)]+\)/g, "$1"],
  [/!\[([^\]]*)\]\([^)]+\)/g, "$1"],
];

// Remove most emoji (including ZWJ sequences) while keeping basic punctuation
const EMOJI_RE =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}]/gu;

export function stripMarkdown(input: string): string {
  if (!input) return "";
  let s = input;
  for (const [re, rep] of MARKDOWN_PATTERNS) {
    s = s.replace(re, rep);
  }
  s = s.replace(EMOJI_RE, "");
  // Normalize dashes / ellipsis
  s = s.replace(/—|–/g, "-");
  s = s.replace(/\.{3,}/g, "…");
  s = s.replace(/\s{2,}/g, " ");
  return s.trim();
}

export function sanitizeStringArray(arr: unknown, maxLen = 80): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => stripMarkdown(String(x ?? "")))
    .filter(Boolean)
    .map((s) => (s.length > maxLen * 4 ? s.slice(0, maxLen * 4).trim() + "…" : s));
}

export function sanitizeStudyPayload(raw: unknown): {
  title: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  explainer: {
    sections: Array<{
      heading: string;
      body: string[];
      keyPoints: string[];
      diagramPrompt?: string;
    }>;
  };
  quiz: {
    questions: Array<{
      type: "mcq" | "short" | "truefalse";
      prompt: string;
      options?: string[];
      answer: string;
      explanation: string;
    }>;
  };
  flashcards: {
    cards: Array<{
      front: string;
      back: string;
      imagePrompt?: string;
    }>;
  };
} {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const difficultyRaw = String(obj.difficulty ?? "intermediate").toLowerCase();
  const difficulty =
    difficultyRaw === "beginner" || difficultyRaw === "advanced"
      ? difficultyRaw
      : "intermediate";

  const title = stripMarkdown(String(obj.title ?? "Untitled Study")).slice(0, 120);

  // Explainer
  const explainerRaw = (obj.explainer ?? {}) as Record<string, unknown>;
  const sectionsRaw = Array.isArray(explainerRaw.sections)
    ? explainerRaw.sections
    : [];
  const sections = sectionsRaw.slice(0, 12).map((sec: unknown) => {
    const s = (sec && typeof sec === "object" ? sec : {}) as Record<string, unknown>;
    const body = Array.isArray(s.body)
      ? sanitizeStringArray(s.body, 120)
      : s.body
        ? [stripMarkdown(String(s.body))]
        : [];
    return {
      heading: stripMarkdown(String(s.heading ?? "Section")).slice(0, 60),
      body,
      keyPoints: sanitizeStringArray(s.keyPoints, 60).slice(0, 8),
      diagramPrompt: s.diagramPrompt
        ? stripMarkdown(String(s.diagramPrompt)).slice(0, 300)
        : undefined,
    };
  });

  // Quiz
  const quizRaw = (obj.quiz ?? {}) as Record<string, unknown>;
  const questionsRaw = Array.isArray(quizRaw.questions) ? quizRaw.questions : [];
  const questions = questionsRaw.slice(0, 15).map((q: unknown) => {
    const item = (q && typeof q === "object" ? q : {}) as Record<string, unknown>;
    const typeRaw = String(item.type ?? "mcq").toLowerCase();
    const type =
      typeRaw === "short" || typeRaw === "truefalse" ? typeRaw : "mcq";
    const options =
      type === "mcq"
        ? sanitizeStringArray(item.options, 80).slice(0, 4)
        : undefined;
    // Pad options to 4 if needed
    if (type === "mcq" && options && options.length < 4) {
      while (options.length < 4) options.push("Option " + (options.length + 1));
    }
    return {
      type: type as "mcq" | "short" | "truefalse",
      prompt: stripMarkdown(String(item.prompt ?? "")).slice(0, 400),
      options,
      answer: stripMarkdown(String(item.answer ?? "")).slice(0, 200),
      explanation: stripMarkdown(String(item.explanation ?? "")).slice(0, 400),
    };
  });

  // Flashcards
  const fcRaw = (obj.flashcards ?? {}) as Record<string, unknown>;
  const cardsRaw = Array.isArray(fcRaw.cards) ? fcRaw.cards : [];
  const cards = cardsRaw.slice(0, 30).map((c: unknown) => {
    const card = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
    return {
      front: stripMarkdown(String(card.front ?? "")).slice(0, 200),
      back: stripMarkdown(String(card.back ?? "")).slice(0, 400),
      imagePrompt: card.imagePrompt
        ? stripMarkdown(String(card.imagePrompt)).slice(0, 300)
        : undefined,
    };
  });

  return {
    title: title || "Untitled Study",
    difficulty,
    explainer: { sections },
    quiz: { questions },
    flashcards: { cards },
  };
}
