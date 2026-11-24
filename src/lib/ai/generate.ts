import { callGroq } from "@/lib/ai/groq";
import { sanitizeStudyPayload } from "@/lib/ai/sanitize";
import { StudyGenerationSchema } from "@/types";
import type { Difficulty, StudyGeneration } from "@/types";

const SYSTEM_PROMPT = `You are StudyBuddy AI, an expert tutor that produces structured study materials.
You MUST return ONLY valid JSON. Never use markdown.

RULES:
- Return ONLY valid JSON matching the schema.
- Do NOT use markdown (no **, no #, no backticks, no bullets with -).
- Bullets go in arrays, not in strings.
- No emojis. No em dash overuse. Use plain periods.
- Headings ≤ 60 chars. Each body paragraph ≤ 80 words.
- If unsure, return an empty array. Never invent citation numbers.
- quiz.options must be exactly 4 strings for mcq.
- Produce 4–8 explainer sections, 5–10 quiz questions, 8–16 flashcards.`;

function buildUserPrompt(
  text: string,
  difficulty: Difficulty,
  includeDiagrams: boolean,
  includeFlashcardImages: boolean
): string {
  return `Create a complete study set from the following material.

Difficulty: ${difficulty}
Include diagram prompts: ${includeDiagrams ? "yes (add diagramPrompt on key sections)" : "no"}
Include flashcard image prompts: ${includeFlashcardImages ? "yes (add imagePrompt on some cards)" : "no"}

Material:
"""
${text.slice(0, 28000)}
"""

Return JSON with this exact shape:
{
  "title": "string ≤ 120 chars",
  "difficulty": "beginner|intermediate|advanced",
  "explainer": {
    "sections": [
      {
        "heading": "string ≤ 60",
        "body": ["paragraph1", "paragraph2"],
        "keyPoints": ["point1", "point2"],
        "diagramPrompt": "optional short prompt for a diagram"
      }
    ]
  },
  "quiz": {
    "questions": [
      {
        "type": "mcq|short|truefalse",
        "prompt": "question text",
        "options": ["A", "B", "C", "D"],
        "answer": "correct answer text or true/false",
        "explanation": "why"
      }
    ]
  },
  "flashcards": {
    "cards": [
      { "front": "term or question", "back": "definition or answer", "imagePrompt": "optional" }
    ]
  }
}`;
}

export async function generateStudyFromText(options: {
  text: string;
  difficulty: Difficulty;
  includeDiagrams?: boolean;
  includeFlashcardImages?: boolean;
}): Promise<{
  study: StudyGeneration;
  model: string;
  tokensIn: number;
  tokensOut: number;
}> {
  const model = "openai/gpt-oss-120b";
  const fallback = "llama-3.3-70b-versatile";

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: buildUserPrompt(
        options.text,
        options.difficulty,
        !!options.includeDiagrams,
        !!options.includeFlashcardImages
      ),
    },
  ];

  let content = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let usedModel = model;

  try {
    const result = await callGroq({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });
    content = result.content;
    tokensIn = result.usage.prompt_tokens;
    tokensOut = result.usage.completion_tokens;
  } catch (err) {
    console.warn("Primary text model failed, using fallback", err);
    usedModel = fallback;
    const result = await callGroq({
      model: fallback,
      messages,
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });
    content = result.content;
    tokensIn = result.usage.prompt_tokens;
    tokensOut = result.usage.completion_tokens;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Repair attempt
    const repair = await callGroq({
      model: usedModel,
      messages: [
        ...messages,
        { role: "assistant", content },
        {
          role: "user",
          content:
            "Your previous output was not valid JSON. Return corrected JSON only, matching the schema. No markdown.",
        },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });
    content = repair.content;
    tokensOut += repair.usage.completion_tokens;
    parsed = JSON.parse(content);
  }

  // Sanitize then validate
  let sanitized = sanitizeStudyPayload(parsed);
  const first = StudyGenerationSchema.safeParse(sanitized);

  if (!first.success) {
    // One repair round with Zod errors
    const repair = await callGroq({
      model: usedModel,
      messages: [
        ...messages,
        { role: "assistant", content },
        {
          role: "user",
          content: `Your previous output failed validation. Errors: ${first.error.message}. Return corrected JSON only.`,
        },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });
    tokensOut += repair.usage.completion_tokens;
    const repairedParsed = JSON.parse(repair.content);
    sanitized = sanitizeStudyPayload(repairedParsed);
    const second = StudyGenerationSchema.safeParse(sanitized);
    if (!second.success) {
      // Soft accept sanitized payload so user still gets something
      console.warn("Zod still failed after repair, using sanitized best-effort");
    }
  }

  return {
    study: sanitized as StudyGeneration,
    model: usedModel,
    tokensIn,
    tokensOut,
  };
}
