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
import { Logger } from "@feed-ai/shared/logger";

function createLogger(db: D1Database, context?: Record<string, unknown>) {
  return new Logger(db, { table: "oq_logs", prefix: "oq" }, context);
}

const STARTING_SCORE = 32;
const STARTING_TECHNICAL = 25;
const STARTING_ECONOMIC = 38;
const DECAY_TARGET = 40;
const DECAY_THRESHOLD_DAYS = 7;
const DECAY_RATE = 0.1;

const app = new Hono<{ Bindings: Env }>();

app.use("/*", cors());

app.onError(async (err, c) => {
  console.error("[oq:error]", err.message, err.stack);
  try {
    const log = createLogger(c.env.DB);
    await log.error("system", "Unhandled route error", {
      path: c.req.path,
      method: c.req.method,
      error: err.message,
    });
  } catch {
    // DB logging failed — console.error above is the fallback
  }
  return c.json({ error: "Internal server error" }, 500);
});

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
app.use("/api/rescore", adminAuth);
app.use("/api/admin/*", adminAuth);
app.use("/api/fetch-sanity", adminAuth);
app.use("/api/fetch-swebench", adminAuth);
app.use("/api/fetch-fred", adminAuth);

// --- Admin dashboard ---

app.get("/api/admin/dashboard", async (c) => {
  try {
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
  } catch (err) {
    try {
      const log = createLogger(c.env.DB);
      await log.error("admin", "dashboard failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    } catch {
      // DB logging failed — global onError console.error is the fallback
    }
    return c.json({ error: "Failed to load dashboard" }, 500);
  }
});

app.get("/api/admin/external-history", async (c) => {
  const key = c.req.query("key");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "90") || 90, 365);

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

app.get("/api/admin/logs", async (c) => {
  const level = c.req.query("level");
  const category = c.req.query("category");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "100") || 100, 500);

  let sql = "SELECT * FROM oq_logs";
  const conditions: string[] = [];
  const binds: (string | number)[] = [];

  if (level) {
    conditions.push("level = ?");
    binds.push(level);
  }
  if (category) {
    conditions.push("category = ?");
    binds.push(category);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY created_at DESC LIMIT ?";
  binds.push(limit);

  const stmt = c.env.DB.prepare(sql);
  const rows = await stmt.bind(...binds).all();

  return c.json(
    rows.results.map((row) => ({
      id: row.id,
      level: row.level,
      category: row.category,
      message: row.message,
      details: row.details ? safeJsonParse(row.details, {}) : null,
      createdAt: row.created_at,
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

app.get("/api/score/:date", async (c) => {
  const date = c.req.param("date");

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "Invalid date format. Use YYYY-MM-DD." }, 400);
  }

  const row = await c.env.DB.prepare("SELECT * FROM oq_scores WHERE date = ?")
    .bind(date)
    .first();

  if (!row) {
    return c.json({ error: "No score found for this date" }, 404);
  }

  const scoreData = mapScoreRow(row);

  // Load articles linked to this score
  const articleRows = await c.env.DB.prepare(
    "SELECT a.title, a.url, a.source, a.pillar, a.published_at FROM oq_score_articles sa JOIN oq_articles a ON sa.article_id = a.id WHERE sa.score_id = ? ORDER BY a.pillar, a.published_at DESC"
  )
    .bind(row.id)
    .all();

  // Load model responses for this score
  const modelRows = await c.env.DB.prepare(
    "SELECT model, provider, pillar_scores, technical_delta, economic_delta, suggested_delta, analysis, top_signals, capability_gap_note, sanity_harness_note, economic_note, input_tokens, output_tokens, latency_ms FROM oq_model_responses WHERE score_id = ? ORDER BY model"
  )
    .bind(row.id)
    .all();

  // Strip internal fields before returning
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, externalData: _ext, ...publicScore } = scoreData;

  return c.json({
    ...publicScore,
    articles: articleRows.results
      .filter((a) => /^https?:\/\//.test(String(a.url ?? "")))
      .map((a) => ({
        title: a.title,
        url: a.url,
        source: a.source,
        pillar: a.pillar,
        publishedAt: a.published_at,
      })),
    modelResponses: modelRows.results.map((m) => ({
      model: m.model,
      provider: m.provider,
      pillarScores: safeJsonParse(m.pillar_scores, {}),
      technicalDelta: m.technical_delta,
      economicDelta: m.economic_delta,
      suggestedDelta: m.suggested_delta,
      analysis: m.analysis,
      topSignals: safeJsonParse(m.top_signals, []),
      capabilityGapNote: m.capability_gap_note,
      sanityHarnessNote: m.sanity_harness_note,
      economicNote: m.economic_note,
      inputTokens: m.input_tokens,
      outputTokens: m.output_tokens,
      latencyMs: m.latency_ms,
    })),
  });
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
  } catch (err) {
    const log = createLogger(c.env.DB);
    await log.warn("system", "Subscriber insert failed (likely duplicate)", {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ ok: true, already: true });
  }
});

app.get("/api/methodology", async (c) => {
  const [externalData, deltas] = await Promise.all([
    loadExternalData(c.env.DB),
    loadExternalDeltas(c.env.DB),
  ]);
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
        : "~77%",
      verifiedSource: "https://www.swebench.com",
      pro:
        typeof externalData.sweBench?.topPro === "number" &&
        externalData.sweBench.topPro > 0
          ? `~${Math.round(externalData.sweBench.topPro)}%`
          : "~46%",
      proSource: "https://scale.com/leaderboard/swe_bench_pro_public",
      proPrivate:
        typeof externalData.sweBench?.topProPrivate === "number" &&
        externalData.sweBench.topProPrivate > 0
          ? `~${Math.round(externalData.sweBench.topProPrivate)}%`
          : "~23%",
      proPrivateSource: "https://scale.com/leaderboard/swe_bench_pro_private",
      description:
        "SWE-bench (Princeton) measures AI on curated open-source bugs. SWE-bench Pro (Scale AI SEAL) uses unfamiliar real-world repos AI hasn't seen in training.",
    },
    sanityHarness: externalData.sanityHarness
      ? {
          topPassRate: externalData.sanityHarness.topPassRate,
          topAgent: externalData.sanityHarness.topAgent,
          topModel: externalData.sanityHarness.topModel,
          medianPassRate: externalData.sanityHarness.medianPassRate,
          languageBreakdown: externalData.sanityHarness.languageBreakdown,
        }
      : null,
    fredData: {
      softwareIndex: externalData.softwareIndex,
      softwareDate: externalData.softwareDate,
      softwareTrend: externalData.softwareTrend,
      generalIndex: externalData.generalIndex,
      generalDate: externalData.generalDate,
      generalTrend: externalData.generalTrend,
    },
    lastUpdated: externalData.lastUpdated ?? {},
    deltas,
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

app.get("/api/prompt-history", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT hash, first_used, last_used, change_summary, created_at FROM oq_prompt_versions ORDER BY created_at DESC LIMIT 50"
  ).all();

  return c.json(
    rows.results.map((r) => ({
      hash: r.hash,
      firstUsed: r.first_used,
      lastUsed: r.last_used,
      changeSummary: r.change_summary,
      createdAt: r.created_at,
    }))
  );
});

app.get("/api/prompt/:hash", async (c) => {
  const hash = c.req.param("hash");
  const row = await c.env.DB.prepare(
    "SELECT hash, prompt_text, first_used, last_used, change_summary, created_at FROM oq_prompt_versions WHERE hash = ?"
  )
    .bind(hash)
    .first();

  if (!row) return c.json({ error: "Prompt version not found" }, 404);

  return c.json({
    hash: row.hash,
    promptText: row.prompt_text,
    firstUsed: row.first_used,
    lastUsed: row.last_used,
    changeSummary: row.change_summary,
    createdAt: row.created_at,
  });
});

// --- Admin endpoints ---

async function adminHandler(
  c: Context<{ Bindings: Env }>,
  action: string,
  fn: (log: Logger) => Promise<unknown>
) {
  const log = createLogger(c.env.DB);
  try {
    const result = await fn(log);
    await log.info("admin", `${action} succeeded`, { action });
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log.error("admin", `${action} failed`, { action, error: msg });
    return c.json({ error: msg }, 500);
  }
}

app.post("/api/fetch", (c) =>
  adminHandler(c, "fetch", () => fetchOQArticles(c.env.DB))
);

app.post("/api/score", (c) =>
  adminHandler(c, "score", (log) => generateDailyScore(c.env, log))
);

app.post("/api/rescore", (c) =>
  adminHandler(c, "rescore", async (log) => {
    const today = new Date().toISOString().split("T")[0];
    const existing = await c.env.DB.prepare(
      "SELECT id FROM oq_scores WHERE date = ?"
    )
      .bind(today)
      .first();
    if (existing) {
      await c.env.DB.batch([
        c.env.DB.prepare(
          "DELETE FROM oq_score_articles WHERE score_id = ?"
        ).bind(existing.id),
        c.env.DB.prepare(
          "DELETE FROM oq_model_responses WHERE score_id = ?"
        ).bind(existing.id),
        c.env.DB.prepare("DELETE FROM oq_ai_usage WHERE score_id = ?").bind(
          existing.id
        ),
        c.env.DB.prepare("DELETE FROM oq_scores WHERE id = ?").bind(
          existing.id
        ),
      ]);
      await log.info("rescore", "Deleted existing score for regeneration", {
        date: today,
        deletedScoreId: existing.id,
      });
    }
    return generateDailyScore(c.env, log);
  })
);

app.post("/api/fetch-sanity", (c) =>
  adminHandler(c, "fetch-sanity", () => fetchAndStoreSanityHarness(c.env.DB))
);

app.post("/api/fetch-swebench", (c) =>
  adminHandler(c, "fetch-swebench", () => fetchAndStoreSWEBench(c.env.DB))
);

app.post("/api/fetch-fred", (c) => {
  if (!c.env.FRED_API_KEY) {
    return c.json({ error: "FRED_API_KEY not configured" }, 503);
  }
  return adminHandler(c, "fetch-fred", (log) =>
    fetchAndStoreFRED(c.env.DB, c.env.FRED_API_KEY!, log)
  );
});

// --- External data loading ---

interface ExternalData {
  sanityHarness?: {
    topPassRate: number;
    topAgent: string;
    topModel: string;
    medianPassRate: number;
    languageBreakdown: string;
    entries?: {
      agent: string;
      model: string;
      overall: number;
      languages: Record<string, number>;
    }[];
  };
  sweBench?: {
    topVerified: number;
    topVerifiedModel: string;
    topBashOnly: number;
    topBashOnlyModel: string;
    topPro?: number;
    topProModel?: string;
    topProPrivate?: number;
    topProPrivateModel?: string;
  };
  softwareIndex?: number;
  softwareDate?: string;
  softwareTrend?: FREDSeriesTrend;
  generalIndex?: number;
  generalDate?: string;
  generalTrend?: FREDSeriesTrend;
  // Timestamps for when each external source was last fetched
  lastUpdated?: {
    sanityHarness?: string;
    sweBench?: string;
    fred?: string;
  };
}

const LATEST_EXTERNAL_SQL =
  "SELECT value, fetched_at FROM oq_external_data_history WHERE key = ? ORDER BY fetched_at DESC LIMIT 1";

const LATEST_TWO_EXTERNAL_SQL =
  "SELECT value, fetched_at FROM oq_external_data_history WHERE key = ? ORDER BY fetched_at DESC LIMIT 2";

interface ExternalDeltas {
  sweBench?: {
    verifiedDelta: number;
    bashOnlyDelta: number;
    proDelta?: number;
    proPrivateDelta?: number;
    previousDate?: string;
  };
  sanityHarness?: {
    topPassRateDelta: number;
    medianPassRateDelta: number;
    previousDate?: string;
  };
}

async function loadExternalDeltas(db: D1Database): Promise<ExternalDeltas> {
  const result: ExternalDeltas = {};
  try {
    const [sweRows, sanityRows] = await db.batch([
      db.prepare(LATEST_TWO_EXTERNAL_SQL).bind("swe_bench"),
      db.prepare(LATEST_TWO_EXTERNAL_SQL).bind("sanity_harness"),
    ]);

    if (sweRows.results.length === 2) {
      try {
        const current = JSON.parse(sweRows.results[0].value as string);
        const previous = JSON.parse(sweRows.results[1].value as string);
        result.sweBench = {
          verifiedDelta: round1(current.topVerified - previous.topVerified),
          bashOnlyDelta: round1(current.topBashOnly - previous.topBashOnly),
          proDelta:
            typeof current.topPro === "number" &&
            typeof previous.topPro === "number"
              ? round1(current.topPro - previous.topPro)
              : undefined,
          proPrivateDelta:
            typeof current.topProPrivate === "number" &&
            typeof previous.topProPrivate === "number"
              ? round1(current.topProPrivate - previous.topProPrivate)
              : undefined,
          previousDate: sweRows.results[1].fetched_at as string,
        };
      } catch {
        // Corrupt data — skip deltas
      }
    }

    if (sanityRows.results.length === 2) {
      try {
        const current = JSON.parse(sanityRows.results[0].value as string);
        const previous = JSON.parse(sanityRows.results[1].value as string);
        result.sanityHarness = {
          topPassRateDelta: round1(current.topPassRate - previous.topPassRate),
          medianPassRateDelta: round1(
            current.medianPassRate - previous.medianPassRate
          ),
          previousDate: sanityRows.results[1].fetched_at as string,
        };
      } catch {
        // Corrupt data — skip deltas
      }
    }
  } catch {
    // Non-critical — deltas are optional
  }
  return result;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

async function loadExternalData(
  db: D1Database,
  log?: Logger
): Promise<ExternalData> {
  const result: ExternalData = {};
  const lastUpdated: NonNullable<ExternalData["lastUpdated"]> = {};
  try {
    const [sanity, swe, fred] = await db.batch([
      db.prepare(LATEST_EXTERNAL_SQL).bind("sanity_harness"),
      db.prepare(LATEST_EXTERNAL_SQL).bind("swe_bench"),
      db.prepare(LATEST_EXTERNAL_SQL).bind("fred_labour"),
    ]);

    if (sanity.results[0]) {
      try {
        result.sanityHarness = JSON.parse(sanity.results[0].value as string);
        lastUpdated.sanityHarness = sanity.results[0].fetched_at as string;
      } catch {
        await log?.error("external", "Corrupt sanity_harness data in DB");
      }
    }
    if (swe.results[0]) {
      try {
        result.sweBench = JSON.parse(swe.results[0].value as string);
        lastUpdated.sweBench = swe.results[0].fetched_at as string;
      } catch {
        await log?.error("external", "Corrupt swe_bench data in DB");
      }
    }
    if (fred.results[0]) {
      try {
        const data = JSON.parse(fred.results[0].value as string);
        result.softwareIndex = data.softwareIndex;
        result.softwareDate = data.softwareDate;
        result.softwareTrend = data.softwareTrend;
        result.generalIndex = data.generalIndex;
        result.generalDate = data.generalDate;
        result.generalTrend = data.generalTrend;
        lastUpdated.fred = fred.results[0].fetched_at as string;
      } catch {
        await log?.error("external", "Corrupt fred_labour data in DB");
      }
    }
  } catch (err) {
    await log?.error("external", "loadExternalData failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  result.lastUpdated = lastUpdated;
  return result;
}

// --- External data fetching ---

// Same-day deduplication: D1 serializes requests so check-then-insert is safe.
// If concurrency were possible, a unique index on (key, fetch_date) would be needed.
async function storeExternalData(
  db: D1Database,
  key: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
): Promise<void> {
  const existing = await db
    .prepare(
      "SELECT id FROM oq_external_data_history WHERE key = ? AND date(fetched_at) = date('now') LIMIT 1"
    )
    .bind(key)
    .first<{ id: string }>();

  if (existing) {
    // Update existing row so re-fetches within the same day apply fixes
    await db
      .prepare("UPDATE oq_external_data_history SET value = ? WHERE id = ?")
      .bind(JSON.stringify(data), existing.id)
      .run();
    return;
  }

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
    throw new Error(`SanityHarness: invalid topPassRate ${data.topPassRate}`);
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

async function fetchAndStoreSWEBench(db: D1Database): Promise<{
  stored: boolean;
  verified: number;
  bashOnly: number;
  pro: number;
  proPrivate: number;
}> {
  const data = await fetchSWEBenchLeaderboard();

  // Validate critical fields before storing
  if (
    typeof data.topVerified !== "number" ||
    data.topVerified < 0 ||
    data.topVerified > 100
  ) {
    throw new Error(`SWE-bench: invalid topVerified ${data.topVerified}`);
  }

  // Warn if Pro scores look suspicious (above Verified), but still store them
  if (data.topPro > data.topVerified && data.topVerified > 0) {
    console.warn(
      `[oq:swe-bench] Pro score (${data.topPro}) exceeds Verified (${data.topVerified}) — verify parser output`
    );
  }
  if (data.topProPrivate > data.topVerified && data.topVerified > 0) {
    console.warn(
      `[oq:swe-bench] Pro Private score (${data.topProPrivate}) exceeds Verified (${data.topVerified}) — verify parser output`
    );
  }

  await storeExternalData(db, "swe_bench", data);
  return {
    stored: true,
    verified: data.topVerified,
    bashOnly: data.topBashOnly,
    pro: data.topPro,
    proPrivate: data.topProPrivate,
  };
}

async function fetchAndStoreFRED(
  db: D1Database,
  apiKey: string,
  log?: Logger
): Promise<{ stored: boolean; softwareIndex?: number; generalIndex?: number }> {
  const data = await fetchFREDData(apiKey, log);

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
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000);

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

        const pubDate = new Date(item.publishedAt ?? "");
        if (!isNaN(pubDate.getTime()) && pubDate < threeDaysAgo) continue;

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
  return text
    .replace(/<[^>]*>/g, "")
    .toWellFormed()
    .trim();
}

// --- Daily score generation ---

async function generateDailyScore(
  env: Env,
  log?: Logger
): Promise<{
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

  // Only send recent articles to models — 2-day window keeps token usage low on
  // subsequent runs while still catching anything published since the last score.
  const TWO_DAYS_MS = 2 * 86400000;
  const articleCutoff = new Date(Date.now() - TWO_DAYS_MS).toISOString();
  const articles = await env.DB.prepare(
    "SELECT a.id, a.title, a.url, a.source, a.pillar, a.summary FROM oq_articles a LEFT JOIN oq_score_articles sa ON a.id = sa.article_id WHERE a.published_at >= ? AND sa.article_id IS NULL ORDER BY a.published_at DESC"
  )
    .bind(articleCutoff)
    .all();

  const pillars: OQPillar[] = [
    "capability",
    "labour_market",
    "sentiment",
    "industry",
    "barriers",
  ];
  const articlesByPillar = Object.fromEntries(
    pillars.map((pillar) => [
      pillar,
      articles.results
        .filter((a) => a.pillar === pillar)
        .slice(0, 20)
        .map(
          (a) =>
            `- ${String(a.title).toWellFormed()}${a.summary ? ` — ${(a.summary as string).slice(0, 200).toWellFormed()}` : ""} (${a.source}) [${a.url}]\n`
        )
        .join(""),
    ])
  ) as Record<OQPillar, string>;

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
  const externalData = await loadExternalData(env.DB, log);

  // Track data quality — flag missing external data sources
  const qualityFlags: string[] = [];
  if (!externalData.sanityHarness) qualityFlags.push("missing_sanity_harness");
  if (!externalData.sweBench) qualityFlags.push("missing_swe_bench");
  if (externalData.softwareIndex === undefined)
    qualityFlags.push("missing_fred_software");
  if (externalData.generalIndex === undefined)
    qualityFlags.push("missing_fred_general");

  const activePillars = Object.entries(articlesByPillar).filter(
    ([, v]) => v.length > 0
  );
  if (activePillars.length < 5)
    qualityFlags.push(
      `sparse_pillars:${activePillars.map(([k]) => k).join(",")}`
    );
  if (totalArticles < 5)
    qualityFlags.push(`low_article_count:${totalArticles}`);

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
    log,
  });

  const scoreId = await saveScore(env.DB, {
    date: today,
    score: result.score,
    scoreTechnical: result.scoreTechnical,
    scoreEconomic: result.scoreEconomic,
    delta: result.delta,
    deltaExplanation: result.deltaExplanation,
    analysis: result.analysis,
    signals: JSON.stringify(result.signals),
    pillarScores: JSON.stringify(result.pillarScores),
    modelScores: JSON.stringify(result.modelScores),
    modelAgreement: result.modelAgreement,
    modelSpread: result.modelSpread,
    capabilityGap: result.capabilityGap,
    sanityHarnessNote: result.sanityHarnessNote,
    economicNote: result.economicNote,
    promptHash: result.promptHash,
    externalData: JSON.stringify(externalData),
    dataQualityFlags:
      qualityFlags.length > 0 ? JSON.stringify(qualityFlags) : undefined,
  });

  // Non-critical post-score writes — failures are logged but don't fail the score
  const articleIds = articles.results
    .map((a) => a.id as string)
    .filter(Boolean);

  const secondaryWrites: { label: string; fn: () => Promise<unknown> }[] = [
    {
      label: "ai_usage",
      fn: () =>
        result.aiUsages.length > 0
          ? env.DB.batch(
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
            )
          : Promise.resolve(),
    },
    {
      label: "article_linkage",
      fn: () =>
        articleIds.length > 0
          ? env.DB.batch(
              articleIds.map((articleId) =>
                env.DB.prepare(
                  "INSERT INTO oq_score_articles (score_id, article_id) VALUES (?, ?)"
                ).bind(scoreId, articleId)
              )
            )
          : Promise.resolve(),
    },
    {
      label: "model_responses",
      fn: () =>
        result.modelResponses.length > 0
          ? env.DB.batch(
              result.modelResponses.map((mr) =>
                env.DB.prepare(
                  "INSERT INTO oq_model_responses (id, score_id, model, provider, raw_response, pillar_scores, technical_delta, economic_delta, suggested_delta, analysis, top_signals, capability_gap_note, sanity_harness_note, economic_note, input_tokens, output_tokens, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
                  mr.parsed.sanity_harness_note ?? null,
                  mr.parsed.economic_note ?? null,
                  mr.inputTokens ?? null,
                  mr.outputTokens ?? null,
                  mr.latencyMs ?? null
                )
              )
            )
          : Promise.resolve(),
    },
    {
      label: "prompt_version",
      fn: () =>
        env.DB.prepare(
          "INSERT INTO oq_prompt_versions (id, hash, prompt_text, first_used, last_used) VALUES (?, ?, ?, ?, ?) ON CONFLICT(hash) DO UPDATE SET last_used = excluded.last_used"
        )
          .bind(
            crypto.randomUUID(),
            result.promptHash,
            result.promptText,
            today,
            today
          )
          .run(),
    },
    {
      label: "funding_events",
      fn: () =>
        result.fundingEvents.length > 0
          ? env.DB.batch(
              result.fundingEvents.map((fe) =>
                env.DB.prepare(
                  "INSERT INTO oq_funding_events (id, company, amount, round, valuation, source_url, date, relevance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
                ).bind(
                  crypto.randomUUID(),
                  fe.company,
                  fe.amount ?? null,
                  fe.round ?? null,
                  fe.valuation ?? null,
                  fe.source_url ?? null,
                  fe.date ?? null,
                  fe.relevance ?? null
                )
              )
            )
          : Promise.resolve(),
    },
  ];

  const writeResults = await Promise.allSettled(
    secondaryWrites.map((w) => w.fn())
  );
  for (let i = 0; i < writeResults.length; i++) {
    const r = writeResults[i];
    if (r.status === "rejected") {
      await log?.warn("score", `Failed: ${secondaryWrites[i].label}`, {
        scoreId,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
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
  deltaExplanation?: string;
  analysis: string;
  signals: string;
  pillarScores: string;
  modelScores: string;
  modelAgreement: string;
  modelSpread: number;
  capabilityGap?: string;
  sanityHarnessNote?: string;
  economicNote?: string;
  promptHash: string;
  externalData?: string;
  isDecay?: boolean;
  dataQualityFlags?: string;
}

async function saveScore(db: D1Database, data: ScoreInsert): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO oq_scores (id, date, score, score_technical, score_economic, delta, delta_explanation, analysis, signals, pillar_scores, model_scores, model_agreement, model_spread, capability_gap, sanity_harness_note, economic_note, prompt_hash, external_data, is_decay, data_quality_flags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      id,
      data.date,
      data.score,
      data.scoreTechnical,
      data.scoreEconomic,
      data.delta,
      data.deltaExplanation ?? null,
      data.analysis,
      data.signals,
      data.pillarScores,
      data.modelScores,
      data.modelAgreement,
      data.modelSpread,
      data.capabilityGap ?? null,
      data.sanityHarnessNote ?? null,
      data.economicNote ?? null,
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
    deltaExplanation: (row.delta_explanation as string) ?? undefined,
    analysis: row.analysis,
    signals: safeJsonParse(row.signals, []),
    pillarScores: safeJsonParse(row.pillar_scores, {}),
    modelScores: safeJsonParse(row.model_scores, []),
    modelAgreement: row.model_agreement,
    modelSpread: row.model_spread,
    capabilityGap: row.capability_gap,
    sanityHarnessNote: row.sanity_harness_note,
    economicNote: row.economic_note,
    externalData: row.external_data
      ? safeJsonParse(row.external_data, null)
      : null,
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
  },
  log?: Logger
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
  } catch (err) {
    await log?.error("system", "logCronRun DB write failed", {
      error: err instanceof Error ? err.message : String(err),
      runId: run.id,
    });
  }
}

export async function findCompletedCronRun(
  db: D1Database,
  date: string
): Promise<{ id: string } | null> {
  return db
    .prepare(
      "SELECT id FROM oq_cron_runs WHERE date(started_at) = ? AND fetch_status = 'success' AND score_status = 'success' LIMIT 1"
    )
    .bind(date)
    .first();
}

async function persistFetchErrors(
  db: D1Database,
  errors: FetchError[],
  log?: Logger
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
  } catch (err) {
    await log?.error("fetch", "persistFetchErrors DB write failed", {
      error: err instanceof Error ? err.message : String(err),
      errorCount: errors.length,
    });
  }
}

export { fetchOQArticles, generateDailyScore, extractFeedItems, stripHtml };

export default {
  fetch: app.fetch,

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const log = createLogger(env.DB);

        // Idempotency: skip if a successful cron already ran today
        const today = new Date().toISOString().split("T")[0];
        const existingRun = await findCompletedCronRun(env.DB, today);
        if (existingRun) {
          await log.info("cron", "Skipping duplicate run", { date: today });
          return;
        }

        const runId = crypto.randomUUID();
        const cronLog = log.child({ cronRunId: runId });
        const startedAt = new Date().toISOString();
        let fetchStatus = "pending";
        let fetchArticles = 0;
        let fetchErrors: FetchError[] = [];
        let scoreStatus = "pending";
        let scoreResult: unknown = null;
        const externalStatus: Record<string, string> = {};
        let cronError: string | undefined;

        try {
          // Daily external data fetches (same-day dedup handled by storeExternalData)
          const externalResults = await Promise.allSettled([
            fetchAndStoreSanityHarness(env.DB),
            fetchAndStoreSWEBench(env.DB),
            ...(env.FRED_API_KEY
              ? [fetchAndStoreFRED(env.DB, env.FRED_API_KEY, cronLog)]
              : []),
          ]);

          const externalLabels = [
            "sanity_harness",
            "swe_bench",
            ...(env.FRED_API_KEY ? ["fred"] : []),
          ];
          externalResults.forEach((r, i) => {
            externalStatus[externalLabels[i]] =
              r.status === "fulfilled" ? "success" : `failed: ${r.reason}`;
          });

          for (const [source, status] of Object.entries(externalStatus)) {
            if (status !== "success") {
              await cronLog.warn("external", `Fetch failed: ${source}`, {
                source,
                status,
              });
            }
          }

          // Weekly data retention cleanup (Sundays)
          const dayOfWeek = new Date().getUTCDay();
          if (dayOfWeek === 0) {
            await env.DB.batch([
              env.DB.prepare(
                "DELETE FROM oq_articles WHERE fetched_at < datetime('now', '-90 days')"
              ),
              env.DB.prepare(
                "DELETE FROM oq_fetch_errors WHERE attempted_at < datetime('now', '-30 days')"
              ),
              env.DB.prepare(
                "DELETE FROM oq_cron_runs WHERE started_at < datetime('now', '-90 days')"
              ),
              env.DB.prepare(
                "DELETE FROM oq_logs WHERE created_at < datetime('now', '-30 days')"
              ),
            ]);
          }

          const fetchResult = await fetchOQArticles(env.DB);
          fetchStatus = "success";
          fetchArticles = fetchResult.fetched;
          fetchErrors = fetchResult.errors;

          if (fetchErrors.length > 0) {
            for (const fe of fetchErrors) {
              await cronLog.warn(
                "fetch",
                `Source ${fe.sourceId}: ${fe.message}`,
                {
                  sourceId: fe.sourceId,
                  errorType: fe.errorType,
                  httpStatus: fe.httpStatus,
                }
              );
            }
            await persistFetchErrors(env.DB, fetchErrors, cronLog);
          }

          scoreResult = await generateDailyScore(env, cronLog);
          scoreStatus = "success";
        } catch (err) {
          const phase = fetchStatus === "pending" ? "fetch" : "score";
          if (phase === "fetch") fetchStatus = "failed";
          else scoreStatus = "failed";

          cronError = err instanceof Error ? err.message : String(err);
          await cronLog.error("cron", `Failed in ${phase} phase`, {
            phase,
            error: cronError,
          });
        } finally {
          await logCronRun(
            env.DB,
            {
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
              error: cronError,
            },
            cronLog
          );
        }
      })()
    );
  },
};
