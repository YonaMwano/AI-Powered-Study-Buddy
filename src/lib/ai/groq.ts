const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";

export type GroqModel =
  | "openai/gpt-oss-20b"
  | "openai/gpt-oss-120b"
  | "qwen/qwen3.8-27b"
  | "llama-3.3-70b-versatile"
  | "llama-3.1-8b-instant"
  | "meta-llama/llama-4-scout-17b-16e-instruct";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

interface GroqOptions {
  model: GroqModel | string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
}

export async function callGroq(options: GroqOptions): Promise<{
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const res = await fetch(GROQ_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.max_tokens ?? 4096,
      response_format: options.response_format,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Groq error", res.status, errText);
    throw new Error(`Groq API error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const usage = data.usage ?? {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };

  return { content, usage };
}

/**
 * Vision extraction for images / scanned pages.
 * Batches up to 3 images per request.
 */
export async function visionExtract(
  images: string[],
  extraContext?: string
): Promise<{
  text: string;
  tables: string[];
  headings: string[];
  tokens: number;
}> {
  const model = "meta-llama/llama-4-scout-17b-16e-instruct";
  const fallback = "llama-3.2-90b-vision-preview";

  const batches: string[][] = [];
  for (let i = 0; i < images.length; i += 3) {
    batches.push(images.slice(i, i + 3));
  }

  let combinedText = "";
  let tables: string[] = [];
  let headings: string[] = [];
  let totalTokens = 0;

  for (const batch of batches) {
    const contentParts: Array<{
      type: string;
      text?: string;
      image_url?: { url: string };
    }> = [
      {
        type: "text",
        text: `Extract all readable text, tables, dates, and headings from the provided image(s). 
Return ONLY valid JSON matching this schema:
{
  "text": "full concatenated plain text",
  "tables": ["markdown-like table rows as strings"],
  "headings": ["heading1", "heading2"]
}
RULES:
- No markdown formatting symbols in text values.
- If unsure, use empty arrays.
- Preserve order of content.
${extraContext ? `Context: ${extraContext}` : ""}`,
      },
    ];

    for (const img of batch) {
      contentParts.push({
        type: "image_url",
        image_url: { url: img },
      });
    }

    try {
      const { content, usage } = await callGroq({
        model,
        messages: [{ role: "user", content: contentParts }],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      });
      totalTokens += usage.total_tokens;

      const parsed = JSON.parse(content);
      if (parsed.text)
        combinedText += (combinedText ? "\n\n" : "") + parsed.text;
      if (Array.isArray(parsed.tables)) tables = tables.concat(parsed.tables);
      if (Array.isArray(parsed.headings))
        headings = headings.concat(parsed.headings);
    } catch (primaryErr) {
      console.warn("Primary vision model failed, trying fallback", primaryErr);
      try {
        const { content, usage } = await callGroq({
          model: fallback,
          messages: [{ role: "user", content: contentParts }],
          temperature: 0.1,
          max_tokens: 4096,
        });
        totalTokens += usage.total_tokens;
        try {
          const parsed = JSON.parse(content);
          if (parsed.text)
            combinedText += (combinedText ? "\n\n" : "") + parsed.text;
          if (Array.isArray(parsed.tables))
            tables = tables.concat(parsed.tables);
          if (Array.isArray(parsed.headings))
            headings = headings.concat(parsed.headings);
        } catch {
          combinedText += (combinedText ? "\n\n" : "") + content;
        }
      } catch (fallbackErr) {
        console.error("Vision fallback also failed", fallbackErr);
      }
    }
  }

  return {
    text: combinedText.trim(),
    tables,
    headings,
    tokens: totalTokens,
  };
}
