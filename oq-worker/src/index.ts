import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { XMLParser } from "fast-xml-parser";
import type { OQPillar } from "@feed-ai/shared/oq-types";
import type { AIUsageEntry } from "@feed-ai/shared/types";
import type { Env } from "./types";
import { oqSources } from "./sources";
import { runScoring } from "./services/scorer";
import { buildScoringPrompt, hashPrompt } from "./services/prompt";

const STARTING_SCORE = 32;
const STARTING_TECHNICAL = 25;
const STARTING_ECONOMIC = 38;
const DECAY_TARGET = 40;
const DECAY_THRESHOLD_DAYS = 7;
const DECAY_RATE = 0.1;

const app = new Hono<{ Bindings: Env }>();

app.use("/*", cors());

// --- Auth middleware for admin endpoints ---

function isAuthorized(authHeader: string, adminKey?: string): boolean {
  if (!adminKey) return false;
  const encoder = new TextEncoder();
  const expected = `Bearer ${adminKey}`;
  const aBuf = encoder.encode(authHeader);
  const bBuf = encoder.encode(expected);
  if (aBuf.byteLength !== bBuf.byteLength) return false;
  return crypto.subtle.timingSafeEqual(aBuf, bBuf);
}

async function adminAuth(
  c: Context<{ Bindings: Env }>,
  next: () => Promise<void>
) {
  if (!isAuthorized(c.req.header("authorization") ?? "", c.env.ADMIN_KEY)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
}

app.use("/api/fetch", adminAuth);
app.use("/api/score", adminAuth);

// --- Public endpoints ---

app.get("/api/today", async (c) => {
  const today = new Date().toISOString().split("T")[0];

  const row = await c.env.DB.prepare("SELECT * FROM oq_scores WHERE date = ?")
    .bind(today)
    .first();

  if (!row) {
    return c.json({
      date: today,
      score: STARTING_SCORE,
      scoreTechnical: STARTING_TECHNICAL,
      scoreEconomic: STARTING_ECONOMIC,
      delta: 0,
      analysis:
        "Tracking begins today. The Capability Gap between SWE-bench Verified (~80%) and SWE-bench Pro (~23%) tells the real story of where AI stands in software engineering.",
      signals: [],
      pillarScores: {
        capability: 0,
        labour_market: 0,
        sentiment: 0,
        industry: 0,
        barriers: 0,
      },
      modelScores: [],
      modelAgreement: "partial",
      modelSpread: 0,
      capabilityGap:
        "SWE-bench Verified: ~80% | SWE-bench Pro: ~23% — the gap is the story.",
      isSeed: true,
    });
  }

  return c.json(mapScoreRow(row));
});

app.get("/api/history", async (c) => {
  const days = Math.min(parseInt(c.req.query("d") || "30", 10) || 30, 90);

  const rows = await c.env.DB.prepare(
    "SELECT date, score, score_technical, score_economic, delta, model_spread FROM oq_scores ORDER BY date DESC LIMIT ?"
  )
    .bind(days)
    .all();

  return c.json(
    rows.results.map((row) => ({
      date: row.date,
      score: row.score,
      scoreTechnical: row.score_technical,
      scoreEconomic: row.score_economic,
      delta: row.delta,
      modelSpread: row.model_spread,
    }))
  );
});

app.post("/api/subscribe", async (c) => {
  const body = await c.req.json<{ email: string }>();
  const email = body.email?.trim().toLowerCase();

  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254
  ) {
    return c.json({ error: "Invalid email" }, 400);
  }

  try {
    await c.env.DB.prepare(
      "INSERT INTO oq_subscribers (id, email) VALUES (?, ?)"
    )
      .bind(crypto.randomUUID(), email)
      .run();
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: true, already: true });
  }
});

app.get("/api/methodology", async (c) => {
  const prompt = buildScoringPrompt({
    currentScore: 0,
    technicalScore: 0,
    economicScore: 0,
    history: "",
    articlesByPillar: {
      capability: "",
      labour_market: "",
      sentiment: "",
      industry: "",
      barriers: "",
    },
  });
  const hash = await hashPrompt(prompt);

  return c.json({
    pillars: [
      { name: "AI Capability Benchmarks", weight: 0.25, key: "capability" },
      { name: "Labour Market Signals", weight: 0.25, key: "labour_market" },
      {
        name: "Developer Sentiment & Adoption",
        weight: 0.2,
        key: "sentiment",
      },
      { name: "Industry & Economic Signals", weight: 0.2, key: "industry" },
      { name: "Structural Barriers", weight: 0.1, key: "barriers" },
    ],
    formula: {
      models: [
        "Claude (claude-sonnet-4-5-20250929)",
        "GPT-4o",
        "Gemini 2.0 Flash",
      ],
      weights: { claude: 0.4, gpt4: 0.3, gemini: 0.3 },
      dampening: 0.3,
      dailyCap: 1.2,
      scoreRange: [5, 95],
      decayTarget: DECAY_TARGET,
    },
    startingScore: STARTING_SCORE,
    currentPromptHash: hash,
    capabilityGap: {
      verified: "~80%",
      pro: "~23%",
      description:
        "The gap between SWE-bench Verified (curated open-source) and Pro (private enterprise) is the central metric.",
    },
    whatWouldChange: {
      to50: [
        "SWE-bench Pro climbing above 50% consistently",
        "Multiple Fortune 500 companies reporting 50%+ reduction in engineering headcount",
        "Indeed software job posting index dropping significantly faster than general postings",
      ],
      to70: [
        "AI autonomously shipping and maintaining production systems at multiple companies for 6+ months",
        "Measurable, sustained decline in software engineering salaries",
        "Major open-source projects primarily maintained by AI agents",
      ],
      below20: [
        "AI coding tool market contracting",
        "Major failures of AI-generated production code causing regulatory backlash",
        "SWE-bench Pro progress plateauing for 12+ months",
        "Debugging AI code consistently taking longer than writing it from scratch",
      ],
    },
  });
});

// --- Admin endpoints ---

app.post("/api/fetch", async (c) => {
  const result = await fetchOQArticles(c.env.DB);
  return c.json(result);
});

app.post("/api/score", async (c) => {
  const result = await generateDailyScore(c.env);
  return c.json(result);
});

// --- Article fetching ---

async function fetchOQArticles(
  db: D1Database
): Promise<{ fetched: number; errors: string[] }> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const errors: string[] = [];
  let fetched = 0;
  const yesterday = new Date(Date.now() - 86400000).toISOString();

  for (const source of oqSources) {
    try {
      const res = await fetch(source.url, {
        headers: { "User-Agent": "FeedAI-OQ/1.0" },
      });
      if (!res.ok) {
        errors.push(`${source.id}: HTTP ${res.status}`);
        continue;
      }

      const text = await res.text();
      const parsed = parser.parse(text);
      const items = extractFeedItems(parsed);

      for (const item of items) {
        if (!item.title || !item.url) continue;

        const result = await db
          .prepare(
            "INSERT INTO oq_articles (id, title, url, source, pillar, summary, published_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(url) DO NOTHING"
          )
          .bind(
            crypto.randomUUID(),
            item.title.slice(0, 500),
            item.url,
            source.name,
            source.pillar,
            item.summary?.slice(0, 500) ?? null,
            item.publishedAt ?? yesterday
          )
          .run();
        if (result.meta.changes > 0) fetched++;
      }
    } catch (err) {
      errors.push(
        `${source.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return { fetched, errors };
}

interface FeedItem {
  title: string;
  url: string;
  summary?: string;
  publishedAt?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFeedItems(parsed: any): FeedItem[] {
  const rssItems =
    parsed?.rss?.channel?.item ?? parsed?.["rdf:RDF"]?.item ?? [];
  const items = Array.isArray(rssItems) ? rssItems : rssItems ? [rssItems] : [];

  if (items.length > 0) {
    return items.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item: any) => ({
        title: stripHtml(item.title ?? ""),
        url: item.link ?? item["@_rdf:about"] ?? "",
        summary: stripHtml(item.description ?? item["content:encoded"] ?? ""),
        publishedAt: item.pubDate ?? item["dc:date"] ?? undefined,
      })
    );
  }

  const entries = parsed?.feed?.entry ?? [];
  const atomItems = Array.isArray(entries) ? entries : entries ? [entries] : [];

  return atomItems.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (entry: any) => ({
      title: stripHtml(
        typeof entry.title === "string"
          ? entry.title
          : (entry.title?.["#text"] ?? "")
      ),
      url:
        entry.link?.["@_href"] ??
        (Array.isArray(entry.link)
          ? entry.link.find(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (l: any) => l["@_rel"] === "alternate" || !l["@_rel"]
            )?.["@_href"]
          : "") ??
        "",
      summary: stripHtml(
        typeof entry.summary === "string"
          ? entry.summary
          : (entry.summary?.["#text"] ?? entry.content?.["#text"] ?? "")
      ),
      publishedAt: entry.published ?? entry.updated ?? undefined,
    })
  );
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}

// --- Daily score generation ---

async function generateDailyScore(env: Env): Promise<{
  score: number;
  delta: number;
  date: string;
  alreadyExists?: boolean;
}> {
  const today = new Date().toISOString().split("T")[0];

  const existing = await env.DB.prepare(
    "SELECT score, delta FROM oq_scores WHERE date = ?"
  )
    .bind(today)
    .first();

  if (existing) {
    return {
      score: existing.score as number,
      delta: existing.delta as number,
      date: today,
      alreadyExists: true,
    };
  }

  const prevRow = await env.DB.prepare(
    "SELECT score, score_technical, score_economic, date FROM oq_scores ORDER BY date DESC LIMIT 1"
  ).first();

  const prevScore = (prevRow?.score as number) ?? STARTING_SCORE;
  const prevTechnical =
    (prevRow?.score_technical as number) ?? STARTING_TECHNICAL;
  const prevEconomic = (prevRow?.score_economic as number) ?? STARTING_ECONOMIC;

  const historyRows = await env.DB.prepare(
    "SELECT date, score, delta FROM oq_scores ORDER BY date DESC LIMIT 14"
  ).all();
  const history = historyRows.results
    .map((r) => `${r.date}: ${r.score} (${r.delta > 0 ? "+" : ""}${r.delta})`)
    .join(", ");

  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const articles = await env.DB.prepare(
    "SELECT title, url, source, pillar, summary FROM oq_articles WHERE fetched_at >= ? ORDER BY published_at DESC"
  )
    .bind(yesterday)
    .all();

  const articlesByPillar: Record<OQPillar, string> = {
    capability: "",
    labour_market: "",
    sentiment: "",
    industry: "",
    barriers: "",
  };

  for (const article of articles.results) {
    const pillar = article.pillar as OQPillar;
    if (articlesByPillar[pillar] !== undefined) {
      articlesByPillar[pillar] +=
        `- ${article.title}${article.summary ? ` — ${(article.summary as string).slice(0, 200)}` : ""} (${article.source})\n`;
    }
  }

  const totalArticles = articles.results.length;
  if (totalArticles === 0) {
    const daysSinceLast = prevRow
      ? Math.floor(
          (Date.now() - new Date(prevRow.date as string).getTime()) / 86400000
        )
      : 0;

    const shouldDecay = daysSinceLast >= DECAY_THRESHOLD_DAYS;
    const delta = shouldDecay
      ? prevScore > DECAY_TARGET
        ? -DECAY_RATE
        : prevScore < DECAY_TARGET
          ? DECAY_RATE
          : 0
      : 0;
    const newScore = Math.round(Math.max(5, Math.min(95, prevScore + delta)));

    await saveScore(env.DB, {
      date: today,
      score: newScore,
      scoreTechnical: prevTechnical,
      scoreEconomic: prevEconomic,
      delta,
      analysis: shouldDecay
        ? `No significant signals for ${daysSinceLast} days. Score decaying toward baseline (${DECAY_TARGET}).`
        : "No new signals today.",
      signals: "[]",
      pillarScores: JSON.stringify({
        capability: 0,
        labour_market: 0,
        sentiment: 0,
        industry: 0,
        barriers: 0,
      }),
      modelScores: "[]",
      modelAgreement: "partial",
      modelSpread: 0,
      promptHash: shouldDecay ? "decay" : "no-articles",
    });

    return { score: newScore, delta, date: today };
  }

  const result = await runScoring({
    previousScore: prevScore,
    previousTechnical: prevTechnical,
    previousEconomic: prevEconomic,
    history,
    articlesByPillar,
    apiKeys: {
      anthropic: env.ANTHROPIC_API_KEY,
      gemini: env.GEMINI_API_KEY,
      openai: env.OPENAI_API_KEY,
    },
  });

  for (const usage of result.aiUsages) {
    await recordAIUsage(env.DB, usage);
  }

  try {
    const prompt = buildScoringPrompt({
      currentScore: prevScore,
      technicalScore: prevTechnical,
      economicScore: prevEconomic,
      history,
      articlesByPillar,
    });
    await env.DB.prepare(
      "INSERT INTO oq_prompt_versions (id, hash, prompt_text) VALUES (?, ?, ?) ON CONFLICT(hash) DO NOTHING"
    )
      .bind(crypto.randomUUID(), result.promptHash, prompt.slice(0, 10000))
      .run();
  } catch {
    // Non-critical
  }

  await saveScore(env.DB, {
    date: today,
    score: result.score,
    scoreTechnical: result.scoreTechnical,
    scoreEconomic: result.scoreEconomic,
    delta: result.delta,
    analysis: result.analysis,
    signals: JSON.stringify(result.signals),
    pillarScores: JSON.stringify(result.pillarScores),
    modelScores: JSON.stringify(result.modelScores),
    modelAgreement: result.modelAgreement,
    modelSpread: result.modelSpread,
    capabilityGap: result.capabilityGap,
    promptHash: result.promptHash,
  });

  return { score: result.score, delta: result.delta, date: today };
}

// --- D1 helpers ---

async function recordAIUsage(db: D1Database, usage: AIUsageEntry) {
  try {
    await db
      .prepare(
        "INSERT INTO oq_ai_usage (id, model, provider, input_tokens, output_tokens, total_tokens, latency_ms, was_fallback, error, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        crypto.randomUUID(),
        usage.model,
        usage.provider,
        usage.inputTokens ?? null,
        usage.outputTokens ?? null,
        usage.totalTokens ?? null,
        usage.latencyMs ?? null,
        usage.wasFallback ? 1 : 0,
        usage.error ?? null,
        usage.status
      )
      .run();
  } catch (err) {
    console.error("Failed to record AI usage:", err);
  }
}

interface ScoreInsert {
  date: string;
  score: number;
  scoreTechnical: number;
  scoreEconomic: number;
  delta: number;
  analysis: string;
  signals: string;
  pillarScores: string;
  modelScores: string;
  modelAgreement: string;
  modelSpread: number;
  capabilityGap?: string;
  promptHash: string;
}

async function saveScore(db: D1Database, data: ScoreInsert): Promise<void> {
  await db
    .prepare(
      "INSERT INTO oq_scores (id, date, score, score_technical, score_economic, delta, analysis, signals, pillar_scores, model_scores, model_agreement, model_spread, capability_gap, prompt_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      crypto.randomUUID(),
      data.date,
      data.score,
      data.scoreTechnical,
      data.scoreEconomic,
      data.delta,
      data.analysis,
      data.signals,
      data.pillarScores,
      data.modelScores,
      data.modelAgreement,
      data.modelSpread,
      data.capabilityGap ?? null,
      data.promptHash
    )
    .run();
}

function mapScoreRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    date: row.date,
    score: row.score,
    scoreTechnical: row.score_technical,
    scoreEconomic: row.score_economic,
    delta: row.delta,
    analysis: row.analysis,
    signals: JSON.parse(row.signals as string),
    pillarScores: JSON.parse(row.pillar_scores as string),
    modelScores: JSON.parse(row.model_scores as string),
    modelAgreement: row.model_agreement,
    modelSpread: row.model_spread,
    capabilityGap: row.capability_gap,
    promptHash: row.prompt_hash,
    createdAt: row.created_at,
  };
}

// --- Exports ---

export { fetchOQArticles, generateDailyScore };

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const time = new Date(event.scheduledTime);
    const hour = time.getUTCHours();
    const minute = time.getUTCMinutes();

    ctx.waitUntil(
      (async () => {
        if (hour === 5 && minute === 30) {
          console.log("[oq] Cron: fetching articles");
          await fetchOQArticles(env.DB);
        } else if (hour === 6 && minute === 30) {
          console.log("[oq] Cron: generating daily score");
          await generateDailyScore(env);
        }
      })()
    );
  },
};
