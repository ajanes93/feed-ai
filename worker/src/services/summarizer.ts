import Anthropic from "@anthropic-ai/sdk";
import { RawItem, DigestItem, countByCategory } from "../types";
import { todayDate } from "@feed-ai/shared/utils";
import { CATEGORY_LIMITS, sources } from "../sources";
import type { AIUsageEntry } from "./logger";

interface DigestItemRaw {
  title: string;
  summary: string;
  why_it_matters?: string;
  category: string;
  source_name: string;
  item_index: number;
}

export interface DigestResult {
  items: DigestItem[];
  aiUsages: AIUsageEntry[];
  /** Structured log entries from the summarizer pipeline for the caller to persist */
  logs: SummarizerLog[];
}

export interface SummarizerLog {
  level: "info" | "warn" | "error";
  message: string;
  details?: Record<string, unknown>;
}

type DigestType = "news" | "jobs";

function groupBySource(items: RawItem[]): string {
  const groups = new Map<string, { index: number; item: RawItem }[]>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const arr = groups.get(item.sourceId) || [];
    arr.push({ index: i, item });
    groups.set(item.sourceId, arr);
  }

  return Array.from(groups.entries())
    .map(([sourceId, sourceItems]) => {
      const itemLines = sourceItems
        .map(
          ({ index, item }) =>
            `  [${index}] ${item.title}\n     ${item.content?.slice(0, 200) || "No description"}\n     URL: ${item.link}`
        )
        .join("\n\n");
      return `### ${sourceId}\n${itemLines}`;
    })
    .join("\n\n");
}

function buildNewsPrompt(items: RawItem[]): string {
  const grouped = groupBySource(items);
  const maxItems =
    CATEGORY_LIMITS.ai + CATEGORY_LIMITS.dev + CATEGORY_LIMITS.sport;

  return `You are curating a daily tech digest for a senior software engineer interested in AI, Vue.js, frontend, web development, and Lincoln City FC football.

Today's date is ${todayDate()}.

Items are grouped by source. Select the most important items, ensuring coverage across sources — pick at least 1 item from each source that has noteworthy content.

${grouped}

You MUST return at least 8 items — aim for 15-20. Return at least 3 AI items, at least 4 Dev items, and include Sport items when available from sources like weareimps, stacey-west, or lincoln-city-bluesky. Always pick the best available even if nothing seems groundbreaking — more coverage is better than fewer items.

Select up to ${maxItems} items total (${CATEGORY_LIMITS.ai} AI, ${CATEGORY_LIMITS.dev} Dev, ${CATEGORY_LIMITS.sport} Sport). Prefer items published today or yesterday. Prioritize:
- Major AI announcements or breakthroughs
- Significant open source releases
- Industry news that affects developers
- Lincoln City FC match reports, team news, and transfer updates
- Ensure diversity across sources — don't pick all items from one source
- If the same story appears from multiple sources, pick only ONE (prefer the most detailed)

For each selected item, provide:
- item_index: The [number] shown before the item above
- title: A clear, concise title (rewrite if needed)
- summary: 2-3 sentence summary of why this matters
- why_it_matters: 1 sentence on personal relevance to a senior full-stack developer (for tech) or Lincoln City fan (for sport)
- category: One of "ai", "dev", "sport"
- source_name: Original source name

Return ONLY a JSON array, no other text:
[{"item_index": 0, "title": "...", "summary": "...", "why_it_matters": "...", "category": "...", "source_name": "..."}]`;
}

function buildJobsPrompt(items: RawItem[]): string {
  const grouped = groupBySource(items);

  return `You are filtering job listings for a senior Vue.js developer based in the UK, looking for remote roles.

Today's date is ${todayDate()}.

${grouped}

You MUST return at least 3 items — aim for 5-8. Always pick the closest matches even if none are a perfect fit — more options are better than fewer.

Select ${CATEGORY_LIMITS.jobs} relevant job listings. STRICT REQUIREMENTS:
- The role MUST mention Vue.js, Nuxt, or VueJS — reject anything that doesn't
- Remote roles accessible from the UK
- Senior, lead, or staff level positions only — exclude mid-level and junior roles
- Salary £75k+ (include roles with undisclosed salary)
- Exclude roles that are clearly US-only or on-site only

For each selected job, provide:
- item_index: The [number] shown before the item above
- title: Job title and company (e.g. "Senior Vue.js Engineer — Acme Corp")
- summary: 2-3 sentences about the role, including salary/location if available
- why_it_matters: 1 sentence on why this role is a good fit
- category: "jobs"
- source_name: Original source name

Return ONLY a JSON array, no other text:
[{"item_index": 0, "title": "...", "summary": "...", "why_it_matters": "...", "category": "jobs", "source_name": "..."}]`;
}

class AIError extends Error {
  usage: AIUsageEntry;
  constructor(usage: AIUsageEntry) {
    super(`${usage.provider} error: ${usage.error}`);
    this.usage = usage;
  }
}

export class DigestError extends Error {
  aiUsages: AIUsageEntry[];
  constructor(message: string, aiUsages: AIUsageEntry[]) {
    super(message);
    this.aiUsages = aiUsages;
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

async function callGemini(
  prompt: string,
  apiKey: string
): Promise<{ text: string; usage: AIUsageEntry }> {
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
    aiError(
      "gemini-2.0-flash",
      "gemini",
      latencyMs,
      false,
      body.slice(0, 500),
      res.status === 429 ? "rate_limited" : "error"
    );
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

async function callClaude(
  prompt: string,
  apiKey: string,
  wasFallback: boolean
): Promise<{ text: string; usage: AIUsageEntry }> {
  const start = Date.now();
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });
  const latencyMs = Date.now() - start;

  if (!response.content || response.content.length === 0) {
    aiError(
      "claude-haiku-4-5-20251001",
      "anthropic",
      latencyMs,
      wasFallback,
      "Empty response"
    );
  }
  const content = response.content[0];
  if (content.type !== "text") {
    aiError(
      "claude-haiku-4-5-20251001",
      "anthropic",
      latencyMs,
      wasFallback,
      "Unexpected response type"
    );
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
  apiKeys: { gemini?: string; anthropic?: string },
  logs: SummarizerLog[]
): Promise<{ parsed: DigestItemRaw[]; usages: AIUsageEntry[] }> {
  const usages: AIUsageEntry[] = [];
  let lastError = "";

  async function tryProvider(
    name: string,
    call: () => Promise<{ text: string; usage: AIUsageEntry }>
  ): Promise<DigestItemRaw[] | null> {
    try {
      logs.push({ level: "info", message: `Calling ${name}` });
      const result = await call();
      usages.push(result.usage);
      logs.push({
        level: "info",
        message: `${name} returned response`,
        details: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          latencyMs: result.usage.latencyMs,
          responseLength: result.text.length,
          responsePreview: result.text.slice(0, 500),
        },
      });
      return parseAIResponse(result.text, logs);
    } catch (err) {
      if (err instanceof AIError) usages.push(err.usage);
      lastError = err instanceof Error ? err.message : String(err);
      logs.push({
        level: "warn",
        message: `${name} failed: ${lastError}`,
      });
      return null;
    }
  }

  if (apiKeys.gemini) {
    const parsed = await tryProvider("Gemini", () =>
      callGemini(prompt, apiKeys.gemini!)
    );
    if (parsed) return { parsed, usages };
    if (!apiKeys.anthropic)
      throw new DigestError(lastError || "Gemini failed", usages);
    logs.push({ level: "info", message: "Falling back to Claude" });
  }

  if (apiKeys.anthropic) {
    const parsed = await tryProvider("Claude", () =>
      callClaude(prompt, apiKeys.anthropic!, usages.length > 0)
    );
    if (parsed) return { parsed, usages };
    throw new DigestError(lastError || "Claude failed", usages);
  }

  throw new DigestError(
    "No AI API key configured (GEMINI_API_KEY or ANTHROPIC_API_KEY)",
    usages
  );
}

function tryRecoverTruncatedJSON(
  json: string,
  logs: SummarizerLog[]
): DigestItemRaw[] | null {
  try {
    const lastComplete = json.lastIndexOf("}");
    if (lastComplete <= 0) return null;
    const recovered = json.slice(0, lastComplete + 1) + "]";
    const parsed = JSON.parse(recovered);
    if (Array.isArray(parsed) && parsed.length > 0) {
      logs.push({
        level: "warn",
        message: `Recovered ${parsed.length} items from truncated response`,
      });
      return parsed;
    }
  } catch (err) {
    logs.push({
      level: "error",
      message: `Truncation recovery also failed: ${(err as Error).message}`,
    });
  }
  return null;
}

function parseAIResponse(
  responseText: string,
  logs: SummarizerLog[]
): DigestItemRaw[] {
  const cleaned = responseText
    .replace(/```(?:json)?\s*/g, "")
    .replace(/```\s*$/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      logs.push({
        level: "info",
        message: `Parsed ${parsed.length} items from AI response`,
      });
      return parsed;
    }
    logs.push({
      level: "error",
      message: "AI returned empty or non-array JSON",
      details: { parsedType: typeof parsed, isArray: Array.isArray(parsed) },
    });
  } catch (err) {
    logs.push({
      level: "warn",
      message: `Initial JSON parse failed: ${(err as Error).message}`,
      details: { responsePreview: cleaned.slice(0, 300) },
    });
    const recovered = tryRecoverTruncatedJSON(cleaned, logs);
    if (recovered) return recovered;
  }

  throw new Error("Expected non-empty JSON array from AI");
}

function isValidDigestItem(item: DigestItemRaw, itemCount: number): boolean {
  return (
    typeof item.item_index === "number" &&
    Number.isInteger(item.item_index) &&
    item.item_index >= 0 &&
    item.item_index < itemCount &&
    typeof item.title === "string" &&
    typeof item.summary === "string" &&
    typeof item.category === "string" &&
    typeof item.source_name === "string"
  );
}

function applyCategoryLimits(items: DigestItemRaw[]): DigestItemRaw[] {
  const counts: Record<string, number> = {};
  const result: DigestItemRaw[] = [];

  for (const item of items) {
    const count = (counts[item.category] || 0) + 1;
    const limit =
      CATEGORY_LIMITS[item.category as keyof typeof CATEGORY_LIMITS];

    if (!limit || count <= limit) {
      counts[item.category] = count;
      result.push(item);
    }
  }

  return result;
}

export async function generateDigest(
  items: RawItem[],
  apiKeys: { gemini?: string; anthropic?: string },
  type: DigestType = "news"
): Promise<DigestResult> {
  const logs: SummarizerLog[] = [];

  logs.push({
    level: "info",
    message: `Starting ${type} digest generation`,
    details: {
      inputItemCount: items.length,
      sources: [...new Set(items.map((i) => i.sourceId))],
      itemTitles: items.map((i) => i.title),
    },
  });

  const prompt =
    type === "jobs" ? buildJobsPrompt(items) : buildNewsPrompt(items);

  logs.push({
    level: "info",
    message: `Built ${type} prompt`,
    details: { promptLength: prompt.length },
  });

  const { parsed, usages } = await callAI(prompt, apiKeys, logs);

  logs.push({
    level: "info",
    message: `AI returned ${parsed.length} raw items`,
    details: {
      categories: countByCategory(parsed),
    },
  });

  const validated = parsed.filter((item) => {
    const valid = isValidDigestItem(item, items.length);
    if (!valid) {
      logs.push({
        level: "warn",
        message: "Dropping malformed digest item",
        details: {
          item_index: item.item_index,
          title: item.title,
          category: item.category,
          hasTitle: typeof item.title === "string",
          hasSummary: typeof item.summary === "string",
          hasCategory: typeof item.category === "string",
          hasSourceName: typeof item.source_name === "string",
          indexValid:
            typeof item.item_index === "number" &&
            item.item_index >= 0 &&
            item.item_index < items.length,
        },
      });
    }
    return valid;
  });

  if (validated.length !== parsed.length) {
    logs.push({
      level: "warn",
      message: `Validation dropped ${parsed.length - validated.length} items`,
      details: { before: parsed.length, after: validated.length },
    });
  }

  const limited = applyCategoryLimits(validated);

  if (limited.length !== validated.length) {
    logs.push({
      level: "info",
      message: `Category limits reduced items from ${validated.length} to ${limited.length}`,
    });
  }

  const sourceNameMap = new Map(sources.map((s) => [s.id, s.name]));

  const digestItems: DigestItem[] = limited.map((item, index) => {
    const rawItem = items[item.item_index];
    return {
      id: String(index),
      digestId: "",
      category: item.category,
      title: item.title,
      summary: item.summary,
      whyItMatters: item.why_it_matters,
      sourceName: sourceNameMap.get(rawItem.sourceId) ?? item.source_name,
      sourceUrl: rawItem.link,
      commentsUrl: rawItem.commentsUrl,
      publishedAt: rawItem.publishedAt
        ? new Date(rawItem.publishedAt).toISOString()
        : undefined,
      position: index,
    };
  });

  logs.push({
    level: "info",
    message: `${type} digest complete: ${digestItems.length} final items`,
    details: {
      categories: countByCategory(digestItems),
    },
  });

  return { items: digestItems, aiUsages: usages, logs };
}
