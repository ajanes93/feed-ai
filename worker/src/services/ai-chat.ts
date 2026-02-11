import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../types";
import { recordAIUsage, logEvent, type AIUsageEntry } from "./logger";

const ALLOWED_PROMPTS = [
  "daily",
  "weekly",
  "monthly",
  "top_ai",
  "dev_updates",
  "lincoln",
] as const;
type PromptKey = (typeof ALLOWED_PROMPTS)[number];

const DAILY_LIMIT = 5;

export function isValidPromptKey(key: string): key is PromptKey {
  return (ALLOWED_PROMPTS as readonly string[]).includes(key);
}

// --- Rate limiting via D1 (device fingerprint) ---

export async function checkAndRecordRateLimit(
  db: D1Database,
  fingerprint: string
): Promise<{ allowed: boolean; remaining: number }> {
  const dayAgo = Math.floor(Date.now() / 1000) - 86400;

  const [, countResult] = await db.batch([
    db.prepare("DELETE FROM ai_rate_limits WHERE created_at < ?").bind(dayAgo),
    db
      .prepare(
        "SELECT COUNT(*) as count FROM ai_rate_limits WHERE fingerprint = ? AND created_at > ?"
      )
      .bind(fingerprint, dayAgo),
  ]);

  const count =
    (countResult.results[0] as Record<string, number> | undefined)?.count ?? 0;

  if (count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  await db
    .prepare(
      "INSERT INTO ai_rate_limits (id, fingerprint, created_at) VALUES (?, ?, ?)"
    )
    .bind(crypto.randomUUID(), fingerprint, Math.floor(Date.now() / 1000))
    .run();

  return { allowed: true, remaining: DAILY_LIMIT - count - 1 };
}

export async function getRemainingRequests(
  db: D1Database,
  fingerprint: string
): Promise<number> {
  const dayAgo = Math.floor(Date.now() / 1000) - 86400;
  const result = await db
    .prepare(
      "SELECT COUNT(*) as count FROM ai_rate_limits WHERE fingerprint = ? AND created_at > ?"
    )
    .bind(fingerprint, dayAgo)
    .first<{ count: number }>();
  return Math.max(0, DAILY_LIMIT - (result?.count ?? 0));
}

// --- Prompt building ---

interface DigestItemRow {
  title: string;
  summary: string;
  category: string;
  source_name: string;
  why_it_matters: string | null;
}

function getDateRange(key: PromptKey): { daysBack: number; category?: string } {
  switch (key) {
    case "daily":
      return { daysBack: 1 };
    case "weekly":
      return { daysBack: 7 };
    case "monthly":
      return { daysBack: 30 };
    case "top_ai":
      return { daysBack: 7, category: "ai" };
    case "dev_updates":
      return { daysBack: 7, category: "dev" };
    case "lincoln":
      return { daysBack: 7, category: "sport" };
  }
}

async function fetchDigestContext(
  db: D1Database,
  key: PromptKey
): Promise<DigestItemRow[]> {
  const { daysBack, category } = getDateRange(key);
  const cutoff = new Date(Date.now() - daysBack * 86400000)
    .toISOString()
    .split("T")[0];

  let query = `SELECT i.title, i.summary, i.category, i.source_name, i.why_it_matters
    FROM items i JOIN digests d ON i.digest_id = d.id WHERE d.date >= ?`;
  const bindings: string[] = [cutoff];

  if (category) {
    query += " AND i.category = ?";
    bindings.push(category);
  }

  query += " ORDER BY d.date DESC, i.position ASC LIMIT 50";

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .all();

  return result.results as unknown as DigestItemRow[];
}

const SYSTEM_PROMPT = `You are a concise AI assistant for a personal daily tech digest app. You summarize tech news, AI developments, developer tool updates, job opportunities, and Lincoln City FC football news for a senior Vue.js/full-stack developer based in the UK.

Rules:
- Use markdown formatting with headers, bullet points, and bold text
- Be direct and informative — no filler or pleasantries
- Keep responses under 800 words
- Highlight the most impactful stories first
- For tech news, note practical implications
- For Lincoln City, include match scores and league position when available`;

function buildUserPrompt(key: PromptKey, items: DigestItemRow[]): string {
  if (items.length === 0) {
    return `No digest items available for this time period. Let the user know briefly and suggest they check back later.`;
  }

  const context = items
    .map(
      (i) =>
        `- **${i.title}** [${i.category}] (${i.source_name}): ${i.summary}${i.why_it_matters ? ` — ${i.why_it_matters}` : ""}`
    )
    .join("\n");

  const instructions: Record<PromptKey, string> = {
    daily:
      "Provide a concise daily briefing highlighting the most important stories. Group by theme, not by category.",
    weekly:
      "Provide a weekly overview highlighting key themes, trends, and the most significant stories.",
    monthly:
      "Provide a monthly recap of major trends, significant releases, and the most impactful stories.",
    top_ai:
      "Provide a focused summary of the most significant AI developments, breakthroughs, and their practical implications.",
    dev_updates:
      "Provide a focused summary of important framework releases, tool updates, and web platform changes.",
    lincoln:
      "Provide a focused summary of Lincoln City FC news including match results, league position, team updates, and any transfer news.",
  };

  return `Here are the digest items:\n\n${context}\n\n${instructions[key]}`;
}

// --- AI providers (Gemini primary, Anthropic fallback — matches summarizer pattern) ---

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string
): Promise<{ text: string; usage: AIUsageEntry }> {
  const start = Date.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000,
        },
      }),
    }
  );
  const latencyMs = Date.now() - start;

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");

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
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  wasFallback: boolean
): Promise<{ text: string; usage: AIUsageEntry }> {
  const start = Date.now();
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const latencyMs = Date.now() - start;

  const textBlock = response.content.find((c) => c.type === "text");
  const text = textBlock?.type === "text" ? textBlock.text : "";
  if (!text) throw new Error("Claude returned empty response");

  return {
    text,
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

export async function generateAiResponse(
  env: Env,
  promptKey: PromptKey
): Promise<{ text: string }> {
  const items = await fetchDigestContext(env.DB, promptKey);
  const userPrompt = buildUserPrompt(promptKey, items);

  let lastError = "";

  // Try Gemini first (primary)
  if (env.GEMINI_API_KEY) {
    try {
      const result = await callGemini(
        SYSTEM_PROMPT,
        userPrompt,
        env.GEMINI_API_KEY
      );
      await recordAIUsage(env.DB, result.usage);
      await logEvent(env.DB, {
        level: "info",
        category: "ai",
        message: `AI chat (Gemini): ${promptKey} (${items.length} items, ${result.usage.latencyMs}ms)`,
      });
      return { text: result.text };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      await logEvent(env.DB, {
        level: "warn",
        category: "ai",
        message: `AI chat Gemini failed, falling back to Claude: ${lastError}`,
      });
    }
  }

  // Fallback to Claude
  if (env.ANTHROPIC_API_KEY) {
    try {
      const wasFallback = !!env.GEMINI_API_KEY;
      const result = await callClaude(
        SYSTEM_PROMPT,
        userPrompt,
        env.ANTHROPIC_API_KEY,
        wasFallback
      );
      await recordAIUsage(env.DB, result.usage);
      await logEvent(env.DB, {
        level: "info",
        category: "ai",
        message: `AI chat (Claude${wasFallback ? " fallback" : ""}): ${promptKey} (${items.length} items, ${result.usage.latencyMs}ms)`,
      });
      return { text: result.text };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      await logEvent(env.DB, {
        level: "error",
        category: "ai",
        message: `AI chat Claude also failed: ${lastError}`,
      });
    }
  }

  if (!env.GEMINI_API_KEY && !env.ANTHROPIC_API_KEY) {
    throw new Error("No AI API key configured");
  }

  throw new Error(`AI chat failed: ${lastError}`);
}
