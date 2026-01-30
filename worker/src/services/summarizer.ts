import Anthropic from "@anthropic-ai/sdk";
import { RawItem, DigestItem } from "../types";
import { CATEGORY_LIMITS } from "../sources";

interface DigestItemRaw {
  title: string;
  summary: string;
  why_it_matters?: string;
  category: string;
  source_name: string;
  source_url: string;
}

function buildPrompt(items: RawItem[]): string {
  const itemList = items
    .map(
      (item, i) =>
        `${i + 1}. [${item.sourceId}] ${item.title}\n   ${item.content?.slice(0, 200) || "No description"}\n   URL: ${item.link}`
    )
    .join("\n\n");

  return `You are curating a daily digest for a senior software engineer interested in AI, Vue.js, and tech jobs.

Today's date is ${new Date().toISOString().split("T")[0]}.

Here are ${items.length} recent items from various sources:

${itemList}

Select up to ${CATEGORY_LIMITS.ai} AI items, ${CATEGORY_LIMITS.dev} Dev items, and ${CATEGORY_LIMITS.jobs} Jobs items (${Object.values(CATEGORY_LIMITS).reduce((a, b) => a + b, 0)} max total). Prefer items published today or yesterday. Prioritize:
- Major AI announcements or breakthroughs
- Relevant job opportunities (Vue, TypeScript, senior/lead, remote)
- Significant open source releases
- Industry news that affects developers

For each selected item, provide:
- title: A clear, concise title (rewrite if needed)
- summary: 2-3 sentence summary of why this matters
- why_it_matters: 1 sentence on personal relevance (optional, only if genuinely relevant)
- category: One of "ai", "jobs", "dev"
- source_name: Original source name
- source_url: Original URL

Return ONLY a JSON array, no other text:
[
  {
    "title": "...",
    "summary": "...",
    "why_it_matters": "...",
    "category": "...",
    "source_name": "...",
    "source_url": "..."
  }
]`;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");
  return text;
}

async function callClaude(prompt: string, apiKey: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  if (!response.content || response.content.length === 0) {
    throw new Error("Empty Claude response");
  }
  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected Claude response type");
  }
  return content.text;
}

async function callAI(
  prompt: string,
  apiKeys: { gemini?: string; anthropic?: string }
): Promise<string> {
  if (apiKeys.gemini) {
    try {
      console.log("Calling Gemini...");
      return await callGemini(prompt, apiKeys.gemini);
    } catch (err) {
      console.error("Gemini failed, falling back to Claude:", err);
      if (!apiKeys.anthropic) throw err;
    }
  }

  if (apiKeys.anthropic) {
    console.log("Calling Claude...");
    return await callClaude(prompt, apiKeys.anthropic);
  }

  throw new Error(
    "No AI API key configured (GEMINI_API_KEY or ANTHROPIC_API_KEY)"
  );
}

function parseAIResponse(responseText: string): DigestItemRaw[] {
  // Strip markdown fences if present
  let cleaned = responseText.replace(/```(?:json)?\s*/g, "").trim();

  // Try parsing as-is first
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // Response may be truncated — try to recover valid items
    const lastComplete = cleaned.lastIndexOf("}");
    if (lastComplete > 0) {
      const recovered = cleaned.slice(0, lastComplete + 1) + "]";
      const parsed = JSON.parse(recovered);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.warn(`Recovered ${parsed.length} items from truncated response`);
        return parsed;
      }
    }
  }

  throw new Error("Expected non-empty JSON array from AI");
}

function isValidDigestItem(item: DigestItemRaw): boolean {
  return (
    typeof item.title === "string" &&
    typeof item.summary === "string" &&
    typeof item.category === "string" &&
    typeof item.source_name === "string" &&
    typeof item.source_url === "string"
  );
}

function applyCategoryLimits(items: DigestItemRaw[]): DigestItemRaw[] {
  const counts: Record<string, number> = {};
  return items.filter((item) => {
    const count = (counts[item.category] = (counts[item.category] || 0) + 1);
    const limit = CATEGORY_LIMITS[item.category as keyof typeof CATEGORY_LIMITS];
    return !limit || count <= limit;
  });
}

export async function generateDigest(
  items: RawItem[],
  apiKeys: { gemini?: string; anthropic?: string },
  digestId: string
): Promise<DigestItem[]> {
  const prompt = buildPrompt(items);
  const responseText = await callAI(prompt, apiKeys);

  let parsed: DigestItemRaw[];
  try {
    parsed = parseAIResponse(responseText);
  } catch {
    console.error("Failed to parse AI response:", responseText);
    throw new Error("Failed to parse digest response as JSON");
  }

  const validated = parsed.filter((item) => {
    const valid = isValidDigestItem(item);
    if (!valid) console.warn("Dropping malformed digest item:", item);
    return valid;
  });

  const limited = applyCategoryLimits(validated);

  const pubDateByUrl = new Map(
    items
      .filter((raw) => raw.publishedAt && !isNaN(raw.publishedAt) && raw.link)
      .map((raw) => [raw.link, new Date(raw.publishedAt!).toISOString()])
  );

  return limited.map((item, index) => ({
    id: `${digestId}-${index}`,
    digestId,
    category: item.category,
    title: item.title,
    summary: item.summary,
    whyItMatters: item.why_it_matters,
    sourceName: item.source_name,
    sourceUrl: item.source_url,
    publishedAt: pubDateByUrl.get(item.source_url),
    position: index,
  }));
}
