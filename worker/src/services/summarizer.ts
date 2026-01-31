import Anthropic from "@anthropic-ai/sdk";
import { RawItem, DigestItem } from "../types";
import { CATEGORY_LIMITS } from "../sources";
import type { AIUsageEntry } from "./logger";

interface DigestItemRaw {
  title: string;
  summary: string;
  why_it_matters?: string;
  category: string;
  source_name: string;
  source_url: string;
}

export interface DigestResult {
  items: DigestItem[];
  aiUsages: AIUsageEntry[];
}

type DigestType = "news" | "jobs";

function groupBySource(items: RawItem[]): string {
  const groups = new Map<string, RawItem[]>();
  for (const item of items) {
    const arr = groups.get(item.sourceId) || [];
    arr.push(item);
    groups.set(item.sourceId, arr);
  }

  return Array.from(groups.entries())
    .map(([sourceId, sourceItems]) => {
      const itemLines = sourceItems
        .map((item, i) => `  ${i + 1}. ${item.title}\n     ${item.content?.slice(0, 200) || "No description"}\n     URL: ${item.link}`)
        .join("\n\n");
      return `### ${sourceId}\n${itemLines}`;
    })
    .join("\n\n");
}

function buildNewsPrompt(items: RawItem[]): string {
  const grouped = groupBySource(items);
  const maxItems = CATEGORY_LIMITS.ai + CATEGORY_LIMITS.dev;

  return `You are curating a daily tech digest for a senior software engineer interested in AI, Vue.js, frontend, and web development.

Today's date is ${new Date().toISOString().split("T")[0]}.

Items are grouped by source. Select the most important items, ensuring coverage across sources — pick at least 1 item from each source that has noteworthy content.

${grouped}

Select up to ${maxItems} items total (up to ${CATEGORY_LIMITS.ai} AI, up to ${CATEGORY_LIMITS.dev} Dev). Prefer items published today or yesterday. Prioritize:
- Major AI announcements or breakthroughs
- Significant open source releases
- Industry news that affects developers
- Ensure diversity across sources — don't pick all items from one source

For each selected item, provide:
- title: A clear, concise title (rewrite if needed)
- summary: 2-3 sentence summary of why this matters
- why_it_matters: 1 sentence on personal relevance (optional, only if genuinely relevant)
- category: One of "ai", "dev"
- source_name: Original source name
- source_url: Original URL

Return ONLY a JSON array, no other text:
[{"title": "...", "summary": "...", "why_it_matters": "...", "category": "...", "source_name": "...", "source_url": "..."}]`;
}

function buildJobsPrompt(items: RawItem[]): string {
  const grouped = groupBySource(items);

  return `You are filtering job listings for a senior software engineer based in the UK, looking for remote roles.

Today's date is ${new Date().toISOString().split("T")[0]}.

${grouped}

Select up to ${CATEGORY_LIMITS.jobs} relevant job listings. Prioritize:
- Remote roles accessible from the UK
- Senior/lead level positions
- Vue.js, TypeScript, Laravel, full-stack, or AI/ML roles
- Salary £75k+ (include roles with undisclosed salary)
- Exclude roles that are clearly US-only, on-site only, or junior level

For each selected job, provide:
- title: Job title and company (e.g. "Senior Vue.js Engineer — Acme Corp")
- summary: 2-3 sentences about the role, including salary/location if available
- why_it_matters: Why this role is a good fit (optional)
- category: "jobs"
- source_name: Original source name
- source_url: Original URL

Return ONLY a JSON array, no other text:
[{"title": "...", "summary": "...", "why_it_matters": "...", "category": "jobs", "source_name": "...", "source_url": "..."}]`;
}

class AIError extends Error {
  usage: AIUsageEntry;
  constructor(usage: AIUsageEntry) {
    super(`${usage.provider} error: ${usage.error}`);
    this.usage = usage;
  }
}

function aiError(
  model: string,
  provider: "gemini" | "anthropic",
  latencyMs: number,
  wasFallback: boolean,
  error: string,
  status: "rate_limited" | "error" = "error"
): never {
  throw new AIError({ model, provider, latencyMs, wasFallback, error, status });
}

async function callGemini(prompt: string, apiKey: string): Promise<{ text: string; usage: AIUsageEntry }> {
  const start = Date.now();
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
  const latencyMs = Date.now() - start;

  if (!res.ok) {
    const body = await res.text();
    aiError("gemini-2.0-flash", "gemini", latencyMs, false, body.slice(0, 500), res.status === 429 ? "rate_limited" : "error");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    aiError("gemini-2.0-flash", "gemini", latencyMs, false, "Empty response");
  }

  const tokenMeta = data?.usageMetadata;
  return {
    text,
    usage: {
      model: "gemini-2.0-flash",
      provider: "gemini",
      inputTokens: tokenMeta?.promptTokenCount,
      outputTokens: tokenMeta?.candidatesTokenCount,
      totalTokens: tokenMeta?.totalTokenCount,
      latencyMs,
      wasFallback: false,
      status: "success",
    },
  };
}

async function callClaude(prompt: string, apiKey: string, wasFallback: boolean): Promise<{ text: string; usage: AIUsageEntry }> {
  const start = Date.now();
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });
  const latencyMs = Date.now() - start;

  if (!response.content || response.content.length === 0) {
    aiError("claude-haiku-4-5-20251001", "anthropic", latencyMs, wasFallback, "Empty response");
  }
  const content = response.content[0];
  if (content.type !== "text") {
    aiError("claude-haiku-4-5-20251001", "anthropic", latencyMs, wasFallback, "Unexpected response type");
  }

  return {
    text: content.text,
    usage: {
      model: "claude-haiku-4-5-20251001",
      provider: "anthropic",
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      latencyMs,
      wasFallback,
      status: "success",
    },
  };
}

async function callAI(
  prompt: string,
  apiKeys: { gemini?: string; anthropic?: string }
): Promise<{ text: string; usages: AIUsageEntry[] }> {
  const usages: AIUsageEntry[] = [];

  if (apiKeys.gemini) {
    try {
      console.log("Calling Gemini...");
      const result = await callGemini(prompt, apiKeys.gemini);
      usages.push(result.usage);
      return { text: result.text, usages };
    } catch (err) {
      if (err instanceof AIError) usages.push(err.usage);
      console.error("Gemini failed, falling back to Claude:", err);
      if (!apiKeys.anthropic) throw err;
    }
  }

  if (apiKeys.anthropic) {
    console.log("Calling Claude...");
    const result = await callClaude(prompt, apiKeys.anthropic, usages.length > 0);
    usages.push(result.usage);
    return { text: result.text, usages };
  }

  throw new Error(
    "No AI API key configured (GEMINI_API_KEY or ANTHROPIC_API_KEY)"
  );
}

function tryRecoverTruncatedJSON(json: string): DigestItemRaw[] | null {
  try {
    const lastComplete = json.lastIndexOf("}");
    if (lastComplete <= 0) return null;
    const recovered = json.slice(0, lastComplete + 1) + "]";
    const parsed = JSON.parse(recovered);
    if (Array.isArray(parsed) && parsed.length > 0) {
      console.warn(`Recovered ${parsed.length} items from truncated response`);
      return parsed;
    }
  } catch (err) {
    console.error("Truncation recovery also failed:", (err as Error).message);
  }
  return null;
}

function parseAIResponse(responseText: string): DigestItemRaw[] {
  // Strip markdown fences (opening and closing)
  const cleaned = responseText
    .replace(/```(?:json)?\s*/g, "")
    .replace(/```\s*$/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (err) {
    console.warn("Initial JSON parse failed, attempting truncation recovery:", (err as Error).message);
    const recovered = tryRecoverTruncatedJSON(cleaned);
    if (recovered) return recovered;
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
  const result: DigestItemRaw[] = [];
  const counts: Record<string, number> = {};

  for (const item of items) {
    counts[item.category] = (counts[item.category] || 0) + 1;
    const limit = CATEGORY_LIMITS[item.category as keyof typeof CATEGORY_LIMITS];
    if (!limit || counts[item.category] <= limit) {
      result.push(item);
    }
  }

  return result;
}

export async function generateDigest(
  items: RawItem[],
  apiKeys: { gemini?: string; anthropic?: string },
  digestId: string,
  type: DigestType = "news"
): Promise<DigestResult> {
  const prompt = type === "jobs" ? buildJobsPrompt(items) : buildNewsPrompt(items);
  const { text: responseText, usages } = await callAI(prompt, apiKeys);

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

  const digestItems = limited.map((item, index) => ({
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

  return { items: digestItems, aiUsages: usages };
}
