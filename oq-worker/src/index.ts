import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { XMLParser } from "fast-xml-parser";
import type { OQPillar } from "@feed-ai/shared/oq-types";
import type { Env } from "./types";
import { oqSources } from "./sources";
import { runScoring } from "./services/scorer";
import { buildScoringPrompt, hashPrompt } from "./services/prompt";
import {
  fetchSanityHarness,
  buildSanityHarnessArticleSummary,
} from "./services/sanity-harness";
import { fetchSWEBenchLeaderboard } from "./services/swe-bench";
import { fetchFREDData, type FREDSeriesTrend } from "./services/fred";

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
app.use("/api/admin/*", adminAuth);
app.use("/api/fetch-sanity", adminAuth);
app.use("/api/fetch-swebench", adminAuth);
app.use("/api/fetch-fred", adminAuth);

// --- Admin dashboard ---

app.get("/api/admin/dashboard", async (c) => {
  const db = c.env.DB;

  const [aiRows, sourceRows, scoreCount, articleCount, subscriberCount] =
    await db.batch([
      db.prepare(
        "SELECT id, model, provider, input_tokens, output_tokens, total_tokens, latency_ms, was_fallback, error, status, created_at FROM oq_ai_usage ORDER BY created_at DESC LIMIT 50"
      ),
      db.prepare(
        "SELECT source, pillar, COUNT(*) as article_count, MAX(fetched_at) as last_fetched FROM oq_articles GROUP BY source ORDER BY source"
      ),
      db.prepare("SELECT COUNT(*) as count FROM oq_scores"),
      db.prepare("SELECT COUNT(*) as count FROM oq_articles"),
      db.prepare("SELECT COUNT(*) as count FROM oq_subscribers"),
    ]);

  const recentCalls = aiRows.results.map((row) => ({
    id: row.id,
    model: row.model,
    provider: row.provider,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    latencyMs: row.latency_ms,
    wasFallback: row.was_fallback === 1,
    error: row.error,
    status: row.status,
    createdAt: row.created_at,
  }));

  const totalTokens = recentCalls.reduce(
    (sum, c) => sum + ((c.totalTokens as number) ?? 0),
    0
  );

  const sources = sourceRows.results.map((row) => ({
    sourceName: row.source,
    pillar: row.pillar,
    articleCount: row.article_count,
    lastFetched: row.last_fetched,
  }));

  return c.json({
    ai: { recentCalls, totalTokens },
    sources,
    totalScores: (scoreCount.results[0]?.count as number) ?? 0,
    totalArticles: (articleCount.results[0]?.count as number) ?? 0,
    totalSubscribers: (subscriberCount.results[0]?.count as number) ?? 0,
  });
});

app.get("/api/admin/external-history", async (c) => {
  const key = c.req.query("key");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "90"), 365);

  const rows = key
    ? await c.env.DB.prepare(
        "SELECT key, value, fetched_at FROM oq_external_data_history WHERE key = ? ORDER BY fetched_at DESC LIMIT ?"
      )
        .bind(key, limit)
        .all()
    : await c.env.DB.prepare(
        "SELECT key, value, fetched_at FROM oq_external_data_history ORDER BY fetched_at DESC LIMIT ?"
      )
        .bind(limit)
        .all();

  return c.json(
    rows.results.map((row) => ({
      key: row.key,
      value: JSON.parse(row.value as string),
      fetchedAt: row.fetched_at,
    }))
  );
});

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
        "Tracking begins today. SWE-bench Verified: ~79% | Bash Only: ~77%. High scores on curated bugs — real enterprise engineering is far harder.",
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
        "SWE-bench Verified: ~79% | Bash Only: ~77% — curated benchmarks; real engineering is harder.",
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
  const externalData = await loadExternalData(c.env.DB);
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
      verified: externalData.sweBench
        ? `${externalData.sweBench.topVerified}%`
        : "~79%",
      bashOnly: externalData.sweBench
        ? `${externalData.sweBench.topBashOnly}%`
        : "~77%",
      description:
        "SWE-bench scores on curated open-source issues. Real enterprise engineering involves ambiguous requirements, system design, and cross-team coordination.",
    },
    whatWouldChange: {
      to50: [
        "SWE-bench Verified consistently above 90% with diverse agents",
        "Top SanityHarness agent >85% AND all languages >60%",
        "Multiple Fortune 500 companies reporting 50%+ reduction in engineering headcount",
        "Indeed software job posting index dropping significantly faster than general postings",
      ],
      to70: [
        "AI autonomously shipping and maintaining production systems at multiple companies for 6+ months",
        "Median SanityHarness agent pass rate >70%",
        "Measurable, sustained decline in software engineering salaries",
        "Major open-source projects primarily maintained by AI agents",
      ],
      below20: [
        "AI coding tool market contracting",
        "Major failures of AI-generated production code causing regulatory backlash",
        "SWE-bench Verified progress plateauing for 12+ months",
        "Top SanityHarness agent plateaus or regresses",
        "Debugging AI code consistently taking longer than writing it from scratch",
      ],
    },
  });
});

// --- Admin endpoints ---

app.post("/api/fetch", async (c) => {
  const result = await fetchOQArticles(c.env.DB);
  await logAdminAction(c.env.DB, "fetch", "/api/fetch", 200, result);
  return c.json(result);
});

app.post("/api/score", async (c) => {
  const result = await generateDailyScore(c.env);
  await logAdminAction(c.env.DB, "score", "/api/score", 200, result);
  return c.json(result);
});

app.post("/api/fetch-sanity", async (c) => {
  try {
    const result = await fetchAndStoreSanityHarness(c.env.DB);
    await logAdminAction(c.env.DB, "fetch-sanity", "/api/fetch-sanity", 200, result);
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SanityHarness fetch failed";
    await logAdminAction(c.env.DB, "fetch-sanity", "/api/fetch-sanity", 500, { error: msg });
    return c.json({ error: msg }, 500);
  }
});

app.post("/api/fetch-swebench", async (c) => {
  try {
    const result = await fetchAndStoreSWEBench(c.env.DB);
    await logAdminAction(c.env.DB, "fetch-swebench", "/api/fetch-swebench", 200, result);
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SWE-bench fetch failed";
    await logAdminAction(c.env.DB, "fetch-swebench", "/api/fetch-swebench", 500, { error: msg });
    return c.json({ error: msg }, 500);
  }
});

app.post("/api/fetch-fred", async (c) => {
  if (!c.env.FRED_API_KEY) {
    return c.json({ error: "FRED_API_KEY not configured" }, 503);
  }
  try {
    const result = await fetchAndStoreFRED(c.env.DB, c.env.FRED_API_KEY);
    await logAdminAction(c.env.DB, "fetch-fred", "/api/fetch-fred", 200, result);
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "FRED fetch failed";
    await logAdminAction(c.env.DB, "fetch-fred", "/api/fetch-fred", 500, { error: msg });
    return c.json({ error: msg }, 500);
  }
});

// --- External data loading ---

interface ExternalData {
  sanityHarness?: {
    topPassRate: number;
    topAgent: string;
    topModel: string;
    medianPassRate: number;
    languageBreakdown: string;
  };
  sweBench?: {
    topVerified: number;
    topVerifiedModel: string;
    topBashOnly: number;
    topBashOnlyModel: string;
  };
  softwareIndex?: number;
  softwareDate?: string;
  softwareTrend?: FREDSeriesTrend;
  generalIndex?: number;
  generalDate?: string;
  generalTrend?: FREDSeriesTrend;
}

const LATEST_EXTERNAL_SQL =
  "SELECT value FROM oq_external_data_history WHERE key = ? ORDER BY fetched_at DESC LIMIT 1";

async function loadExternalData(db: D1Database): Promise<ExternalData> {
  const result: ExternalData = {};
  try {
    const [sanity, swe, fred] = await db.batch([
      db.prepare(LATEST_EXTERNAL_SQL).bind("sanity_harness"),
      db.prepare(LATEST_EXTERNAL_SQL).bind("swe_bench"),
      db.prepare(LATEST_EXTERNAL_SQL).bind("fred_labour"),
    ]);

    if (sanity.results[0]) {
      result.sanityHarness = JSON.parse(sanity.results[0].value as string);
    }
    if (swe.results[0]) {
      result.sweBench = JSON.parse(swe.results[0].value as string);
    }
    if (fred.results[0]) {
      const data = JSON.parse(fred.results[0].value as string);
      result.softwareIndex = data.softwareIndex;
      result.softwareDate = data.softwareDate;
      result.softwareTrend = data.softwareTrend;
      result.generalIndex = data.generalIndex;
      result.generalDate = data.generalDate;
      result.generalTrend = data.generalTrend;
    }
  } catch (err) {
    console.error(
      "[oq] loadExternalData failed:",
      err instanceof Error ? err.message : err
    );
  }
  return result;
}

// --- External data fetching ---

async function storeExternalData(
  db: D1Database,
  key: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO oq_external_data_history (id, key, value) VALUES (?, ?, ?)"
    )
    .bind(crypto.randomUUID(), key, JSON.stringify(data))
    .run();
}

async function fetchAndStoreSanityHarness(
  db: D1Database
): Promise<{ stored: boolean; topPassRate: number }> {
  const data = await fetchSanityHarness();

  // Validate critical fields before storing
  if (
    typeof data.topPassRate !== "number" ||
    data.topPassRate < 0 ||
    data.topPassRate > 100
  ) {
    throw new Error(
      `SanityHarness: invalid topPassRate ${data.topPassRate}`
    );
  }
  if (!data.topAgent || !data.topModel) {
    throw new Error("SanityHarness: missing topAgent or topModel");
  }

  const summary = buildSanityHarnessArticleSummary(data);
  const today = new Date().toISOString().split("T")[0];

  // Store as synthetic article (deduplicate by day)
  await db
    .prepare(
      "INSERT INTO oq_articles (id, title, url, source, pillar, summary, published_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(url) DO NOTHING"
    )
    .bind(
      crypto.randomUUID(),
      `SanityHarness Agent Benchmark Update — ${today}`,
      `https://sanityboard.lr7.dev#sanityharness-${today}`,
      "SanityHarness",
      "capability",
      summary,
      new Date().toISOString()
    )
    .run();

  await storeExternalData(db, "sanity_harness", data);
  return { stored: true, topPassRate: data.topPassRate };
}

async function fetchAndStoreSWEBench(
  db: D1Database
): Promise<{ stored: boolean; verified: number; bashOnly: number }> {
  const data = await fetchSWEBenchLeaderboard();

  // Validate critical fields before storing
  if (
    typeof data.topVerified !== "number" ||
    data.topVerified < 0 ||
    data.topVerified > 100
  ) {
    throw new Error(`SWE-bench: invalid topVerified ${data.topVerified}`);
  }

  await storeExternalData(db, "swe_bench", data);
  return {
    stored: true,
    verified: data.topVerified,
    bashOnly: data.topBashOnly,
  };
}

async function fetchAndStoreFRED(
  db: D1Database,
  apiKey: string
): Promise<{ stored: boolean; softwareIndex?: number; generalIndex?: number }> {
  const data = await fetchFREDData(apiKey);

  // Validate: at least one index should be present
  if (data.softwareIndex === undefined && data.generalIndex === undefined) {
    throw new Error("FRED: no valid observation data returned");
  }

  await storeExternalData(db, "fred_labour", data);
  return {
    stored: true,
    softwareIndex: data.softwareIndex,
    generalIndex: data.generalIndex,
  };
}

// --- Article fetching ---

async function fetchOQArticles(
  db: D1Database
): Promise<{ fetched: number; errors: FetchError[] }> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const errors: FetchError[] = [];
  let fetched = 0;
  const yesterday = new Date(Date.now() - 86400000).toISOString();

  for (const source of oqSources) {
    try {
      const res = await fetch(source.url, {
        headers: { "User-Agent": "FeedAI-OQ/1.0" },
      });
      if (!res.ok) {
        errors.push({
          sourceId: source.id,
          errorType: "http_error",
          message: `HTTP ${res.status}`,
          httpStatus: res.status,
        });
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
            item.title,
            item.url,
            source.name,
            source.pillar,
            item.summary ?? null,
            item.publishedAt ?? yesterday
          )
          .run();
        if (result.meta.changes > 0) fetched++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({
        sourceId: source.id,
        errorType: /timeout/i.test(message) ? "timeout" : "parse_error",
        message,
      });
    }
  }

  return { fetched, errors };
}

interface FetchError {
  sourceId: string;
  errorType: "http_error" | "parse_error" | "timeout";
  message: string;
  httpStatus?: number;
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
    "SELECT id, title, url, source, pillar, summary FROM oq_articles WHERE fetched_at >= ? ORDER BY published_at DESC"
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
      isDecay: shouldDecay,
    });

    return { score: newScore, delta, date: today };
  }

  // Load external data for prompt context
  const externalData = await loadExternalData(env.DB);

  // Track data quality — flag missing external data sources
  const qualityFlags: string[] = [];
  if (!externalData.sanityHarness) qualityFlags.push("missing_sanity_harness");
  if (!externalData.sweBench) qualityFlags.push("missing_swe_bench");
  if (externalData.softwareIndex === undefined)
    qualityFlags.push("missing_fred_software");
  if (externalData.generalIndex === undefined)
    qualityFlags.push("missing_fred_general");

  const pillarCounts = Object.entries(articlesByPillar).filter(
    ([, v]) => v.length > 0
  );
  if (pillarCounts.length < 5)
    qualityFlags.push(
      `sparse_pillars:${pillarCounts.map(([k]) => k).join(",")}`
    );
  if (totalArticles < 5) qualityFlags.push(`low_article_count:${totalArticles}`);

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
    sanityHarness: externalData.sanityHarness,
    sweBench: externalData.sweBench,
    softwareIndex: externalData.softwareIndex,
    softwareDate: externalData.softwareDate,
    softwareTrend: externalData.softwareTrend,
    generalIndex: externalData.generalIndex,
    generalDate: externalData.generalDate,
    generalTrend: externalData.generalTrend,
  });

  const scoreId = await saveScore(env.DB, {
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
    externalData: JSON.stringify(externalData),
    dataQualityFlags:
      qualityFlags.length > 0 ? JSON.stringify(qualityFlags) : undefined,
  });

  // Link AI usage records to this score (batched)
  if (result.aiUsages.length > 0) {
    await env.DB.batch(
      result.aiUsages.map((usage) =>
        env.DB.prepare(
          "INSERT INTO oq_ai_usage (id, model, provider, input_tokens, output_tokens, total_tokens, latency_ms, was_fallback, error, status, score_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          crypto.randomUUID(),
          usage.model,
          usage.provider,
          usage.inputTokens ?? null,
          usage.outputTokens ?? null,
          usage.totalTokens ?? null,
          usage.latencyMs ?? null,
          usage.wasFallback ? 1 : 0,
          usage.error ?? null,
          usage.status,
          scoreId
        )
      )
    );
  }

  // Link articles to this score
  const articleIds = articles.results
    .map((a) => a.id as string)
    .filter(Boolean);
  if (articleIds.length > 0) {
    await env.DB.batch(
      articleIds.map((articleId) =>
        env.DB.prepare(
          "INSERT INTO oq_score_articles (score_id, article_id) VALUES (?, ?)"
        ).bind(scoreId, articleId)
      )
    );
  }

  // Store individual model responses for transparency
  if (result.modelResponses.length > 0) {
    await env.DB.batch(
      result.modelResponses.map((mr) =>
        env.DB.prepare(
          "INSERT INTO oq_model_responses (id, score_id, model, provider, raw_response, pillar_scores, technical_delta, economic_delta, suggested_delta, analysis, top_signals, capability_gap_note, input_tokens, output_tokens, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          crypto.randomUUID(),
          scoreId,
          mr.model,
          mr.provider,
          mr.rawResponse,
          JSON.stringify(mr.parsed.pillar_scores),
          mr.parsed.technical_delta,
          mr.parsed.economic_delta,
          mr.parsed.suggested_delta,
          mr.parsed.analysis,
          JSON.stringify(mr.parsed.top_signals),
          mr.parsed.capability_gap_note ?? null,
          mr.inputTokens ?? null,
          mr.outputTokens ?? null,
          mr.latencyMs ?? null
        )
      )
    );
  }

  try {
    const prompt = buildScoringPrompt({
      currentScore: prevScore,
      technicalScore: prevTechnical,
      economicScore: prevEconomic,
      history,
      articlesByPillar,
      sanityHarness: externalData.sanityHarness,
      sweBench: externalData.sweBench,
      softwareIndex: externalData.softwareIndex,
      softwareDate: externalData.softwareDate,
      softwareTrend: externalData.softwareTrend,
      generalIndex: externalData.generalIndex,
      generalDate: externalData.generalDate,
      generalTrend: externalData.generalTrend,
    });
    await env.DB.prepare(
      "INSERT INTO oq_prompt_versions (id, hash, prompt_text) VALUES (?, ?, ?) ON CONFLICT(hash) DO NOTHING"
    )
      .bind(crypto.randomUUID(), result.promptHash, prompt)
      .run();
  } catch {
    // Non-critical
  }

  return { score: result.score, delta: result.delta, date: today };
}

// --- D1 helpers ---

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
  externalData?: string;
  isDecay?: boolean;
  dataQualityFlags?: string;
}

async function saveScore(db: D1Database, data: ScoreInsert): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO oq_scores (id, date, score, score_technical, score_economic, delta, analysis, signals, pillar_scores, model_scores, model_agreement, model_spread, capability_gap, prompt_hash, external_data, is_decay, data_quality_flags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      id,
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
      data.promptHash,
      data.externalData ?? null,
      data.isDecay ? 1 : 0,
      data.dataQualityFlags ?? null
    )
    .run();
  return id;
}

function safeJsonParse(value: unknown, fallback: unknown = []) {
  try {
    return JSON.parse(value as string);
  } catch {
    return fallback;
  }
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
    signals: safeJsonParse(row.signals, []),
    pillarScores: safeJsonParse(row.pillar_scores, {}),
    modelScores: safeJsonParse(row.model_scores, []),
    modelAgreement: row.model_agreement,
    modelSpread: row.model_spread,
    capabilityGap: row.capability_gap,
    promptHash: row.prompt_hash,
    createdAt: row.created_at,
  };
}

// --- Exports ---

async function logCronRun(
  db: D1Database,
  run: {
    id: string;
    startedAt: string;
    completedAt?: string;
    fetchStatus: string;
    fetchArticles?: number;
    fetchErrors?: FetchError[];
    scoreStatus: string;
    scoreResult?: unknown;
    externalFetchStatus?: Record<string, string>;
    error?: string;
  }
): Promise<void> {
  try {
    await db
      .prepare(
        "INSERT OR REPLACE INTO oq_cron_runs (id, started_at, completed_at, fetch_status, fetch_articles, fetch_errors, score_status, score_result, external_fetch_status, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        run.id,
        run.startedAt,
        run.completedAt ?? null,
        run.fetchStatus,
        run.fetchArticles ?? 0,
        run.fetchErrors?.length ? JSON.stringify(run.fetchErrors) : null,
        run.scoreStatus,
        run.scoreResult ? JSON.stringify(run.scoreResult) : null,
        run.externalFetchStatus
          ? JSON.stringify(run.externalFetchStatus)
          : null,
        run.error ?? null
      )
      .run();
  } catch {
    // Best-effort logging
  }
}

async function logAdminAction(
  db: D1Database,
  action: string,
  endpoint: string,
  status: number,
  summary?: unknown
): Promise<void> {
  try {
    await db
      .prepare(
        "INSERT INTO oq_admin_actions (id, action, endpoint, result_status, result_summary) VALUES (?, ?, ?, ?, ?)"
      )
      .bind(
        crypto.randomUUID(),
        action,
        endpoint,
        status,
        summary ? JSON.stringify(summary).slice(0, 2000) : null
      )
      .run();
  } catch {
    // Best-effort logging
  }
}

async function persistFetchErrors(
  db: D1Database,
  errors: FetchError[]
): Promise<void> {
  if (errors.length === 0) return;
  try {
    await db.batch(
      errors.map((err) =>
        db
          .prepare(
            "INSERT INTO oq_fetch_errors (id, source_id, error_type, error_message, http_status) VALUES (?, ?, ?, ?, ?)"
          )
          .bind(
            crypto.randomUUID(),
            err.sourceId,
            err.errorType,
            err.message,
            err.httpStatus ?? null
          )
      )
    );
  } catch {
    // Best-effort logging
  }
}

export { fetchOQArticles, generateDailyScore, extractFeedItems, stripHtml };

export default {
  fetch: app.fetch,

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const runId = crypto.randomUUID();
        const startedAt = new Date().toISOString();
        let fetchStatus = "pending";
        let fetchArticles = 0;
        let fetchErrors: FetchError[] = [];
        let scoreStatus = "pending";
        let scoreResult: unknown = null;
        const externalStatus: Record<string, string> = {};

        try {
          // Weekly external data fetches (Sundays)
          const dayOfWeek = new Date().getUTCDay();
          if (dayOfWeek === 0) {
            console.log("[oq] Cron: fetching external data (weekly)");
            const results = await Promise.allSettled([
              fetchAndStoreSanityHarness(env.DB),
              fetchAndStoreSWEBench(env.DB),
              ...(env.FRED_API_KEY
                ? [fetchAndStoreFRED(env.DB, env.FRED_API_KEY)]
                : []),
            ]);

            const labels = [
              "sanity_harness",
              "swe_bench",
              ...(env.FRED_API_KEY ? ["fred"] : []),
            ];
            results.forEach((r, i) => {
              externalStatus[labels[i]] =
                r.status === "fulfilled" ? "success" : `failed: ${r.reason}`;
            });
          }

          console.log("[oq] Cron: fetching articles");
          const fetchResult = await fetchOQArticles(env.DB);
          fetchStatus = "success";
          fetchArticles = fetchResult.fetched;
          fetchErrors = fetchResult.errors;

          // Persist any fetch errors
          if (fetchErrors.length > 0) {
            await persistFetchErrors(env.DB, fetchErrors);
          }

          console.log("[oq] Cron: generating daily score");
          scoreResult = await generateDailyScore(env);
          scoreStatus = "success";
        } catch (err) {
          const phase =
            fetchStatus === "pending" ? "fetch" : "score";
          if (phase === "fetch") fetchStatus = "failed";
          else scoreStatus = "failed";

          await logCronRun(env.DB, {
            id: runId,
            startedAt,
            completedAt: new Date().toISOString(),
            fetchStatus,
            fetchArticles,
            fetchErrors,
            scoreStatus,
            scoreResult,
            externalFetchStatus: externalStatus,
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }

        await logCronRun(env.DB, {
          id: runId,
          startedAt,
          completedAt: new Date().toISOString(),
          fetchStatus,
          fetchArticles,
          fetchErrors,
          scoreStatus,
          scoreResult,
          externalFetchStatus:
            Object.keys(externalStatus).length > 0
              ? externalStatus
              : undefined,
        });
      })()
    );
  },
};
