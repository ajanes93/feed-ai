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

const SCANNED_SENTINEL = "__scanned__";
const DIRECT_CAP = 20; // Max articles per pillar before triggering pre-digest
const PRE_DIGEST_BATCH = 150; // Articles per Gemini pre-digest call

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
app.use("/api/maintenance", adminAuth);
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
      fundingEvents: [],
    });
  }

  const log = createLogger(c.env.DB);
  const fundingEvents = await loadRecentFundingEvents(c.env.DB, 30, 20, log);
  return c.json({ ...mapScoreRow(row), fundingEvents });
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
    "SELECT model, provider, pillar_scores, technical_delta, economic_delta, suggested_delta, analysis, top_signals, capability_gap_note, sanity_harness_note, economic_note, labour_note, input_tokens, output_tokens, latency_ms FROM oq_model_responses WHERE score_id = ? ORDER BY model"
  )
    .bind(row.id)
    .all();

  // Strip internal ID; externalData is intentionally public for the data snapshot UI
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...publicScore } = scoreData;

  const log = createLogger(c.env.DB);
  const fundingEvents = await loadRecentFundingEvents(c.env.DB, 365, 100, log);

  return c.json({
    ...publicScore,
    fundingEvents,
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
      labourNote: m.labour_note,
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
  const log = createLogger(c.env.DB);
  const [externalData, deltas, fundingSummary] = await Promise.all([
    loadExternalData(c.env.DB, log),
    loadExternalDeltas(c.env.DB, log),
    loadFundingSummary(c.env.DB, log),
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
    fundingSummary,
    dataProcessing: {
      preDigest: {
        description:
          "When more than 20 articles exist per pillar, a map-reduce pre-digest runs before scoring. Gemini Flash summarizes articles in batches of 150 into 8-12 bullet points per batch, then the condensed summaries are fed into the multi-model scoring prompt. This ensures all articles contribute to the score, not just the most recent 20.",
        trigger: "More than 20 unscored articles in any pillar",
        model: FUNDING_MODEL_PRIMARY,
        batchSize: PRE_DIGEST_BATCH,
        directCap: DIRECT_CAP,
      },
      fundingExtraction: {
        description:
          "Funding events are extracted from articles by a separate AI process (not the scoring prompt). All articles are scanned in batches, and extracted events are deduplicated by company+amount. This runs independently of scoring to ensure complete funding data regardless of when articles were fetched.",
        model: `${FUNDING_MODEL_PRIMARY} (primary), ${FUNDING_MODEL_FALLBACK} (fallback)`,
        batchSize: FUNDING_EXTRACT_BATCH_SIZE,
        deduplication: "company+amount key",
      },
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

app.get("/api/economic-history", async (c) => {
  const days = Math.min(parseInt(c.req.query("d") ?? "90", 10) || 90, 365);
  const cutoff = new Date(Date.now() - days * 86400000)
    .toISOString()
    .split("T")[0];

  const [fredRows, scoreRows] = await c.env.DB.batch([
    c.env.DB.prepare(
      "SELECT value, fetched_at FROM oq_external_data_history WHERE key = 'fred_labour' AND fetched_at >= ? ORDER BY fetched_at ASC"
    ).bind(cutoff),
    c.env.DB.prepare(
      "SELECT date, score, score_economic, delta FROM oq_scores WHERE date >= ? ORDER BY date ASC"
    ).bind(cutoff),
  ]);

  const fredData = fredRows.results
    .map((r) => {
      try {
        const val = JSON.parse(r.value as string);
        return {
          date: (r.fetched_at as string).split("T")[0],
          softwareIndex: val.softwareIndex ?? null,
          generalIndex: val.generalIndex ?? null,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const scoreData = scoreRows.results.map((r) => ({
    date: r.date,
    score: r.score,
    scoreEconomic: r.score_economic,
    delta: r.delta,
  }));

  return c.json({ fredData, scoreData });
});

app.get("/api/prompt/:hash", async (c) => {
  const hash = c.req.param("hash");
  if (!/^[0-9a-f]{1,64}$/.test(hash)) {
    return c.json({ error: "Invalid hash" }, 400);
  }
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

app.post("/api/maintenance", (c) =>
  adminHandler(c, "maintenance", async () => {
    const results = await c.env.DB.batch([
      c.env.DB.prepare(
        "DELETE FROM oq_fetch_errors WHERE attempted_at < datetime('now', '-30 days')"
      ),
      c.env.DB.prepare(
        "DELETE FROM oq_cron_runs WHERE started_at < datetime('now', '-90 days')"
      ),
      c.env.DB.prepare(
        "DELETE FROM oq_logs WHERE created_at < datetime('now', '-30 days')"
      ),
    ]);
    return {
      deletedFetchErrors: results[0].meta.changes,
      deletedCronRuns: results[1].meta.changes,
      deletedLogs: results[2].meta.changes,
    };
  })
);

// Purge scores, linkage, and funding data — allows a fresh start without losing articles
// Also clears funding sentinels so extract-funding can re-scan all articles
app.post("/api/admin/purge-scores", (c) =>
  adminHandler(c, "purge-scores", async () => {
    const results = await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM oq_score_articles"),
      c.env.DB.prepare("DELETE FROM oq_model_responses"),
      c.env.DB.prepare("DELETE FROM oq_funding_events"),
      c.env.DB.prepare("DELETE FROM oq_ai_usage"),
      c.env.DB.prepare("DELETE FROM oq_scores"),
    ]);
    return {
      scoreArticles: results[0].meta.changes,
      modelResponses: results[1].meta.changes,
      fundingEvents: results[2].meta.changes,
      aiUsage: results[3].meta.changes,
      scores: results[4].meta.changes,
    };
  })
);

// Unified backfill endpoint: ?type=fred|dedup-funding
// - fred: backfill historical FRED labour data
// - dedup-funding: remove duplicate rows from oq_funding_events
app.post("/api/admin/backfill", async (c) => {
  const type = c.req.query("type");
  const log = createLogger(c.env.DB);

  try {
    if (type === "fred") {
      if (!c.env.FRED_API_KEY) {
        return c.json({ error: "FRED_API_KEY not configured" }, 503);
      }
      const result = await backfillFRED(c.env.DB, c.env.FRED_API_KEY, log);
      return c.json(result);
    }

    if (type === "dedup-funding") {
      const result = await dedupFundingEvents(c.env.DB, log);
      return c.json(result);
    }

    return c.json({ error: "type param required: fred | dedup-funding" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await log.error("external", `backfill-${type} failed`, { error: message });
    return c.json({ error: message }, 500);
  }
});

// Extract funding events from all articles using AI (Gemini primary, OpenAI fallback)
app.post("/api/admin/extract-funding", (c) =>
  adminHandler(c, "extract-funding", (log) =>
    extractFundingFromArticles(c.env, log)
  )
);

// Keep old endpoint as alias for backwards compatibility
app.post("/api/admin/backfill-fred", async (c) => {
  if (!c.env.FRED_API_KEY) {
    return c.json({ error: "FRED_API_KEY not configured" }, 503);
  }
  const log = createLogger(c.env.DB);
  try {
    return c.json(await backfillFRED(c.env.DB, c.env.FRED_API_KEY, log));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await log.error("external", "backfill-fred failed", { error: message });
    return c.json({ error: message }, 500);
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
  fred?: {
    softwareIndexDelta: number;
    generalIndexDelta?: number;
    previousDate?: string;
  };
}

async function loadExternalDeltas(
  db: D1Database,
  log?: Logger
): Promise<ExternalDeltas> {
  const result: ExternalDeltas = {};
  try {
    const [sweRows, sanityRows, fredRows] = await db.batch([
      db.prepare(LATEST_TWO_EXTERNAL_SQL).bind("swe_bench"),
      db.prepare(LATEST_TWO_EXTERNAL_SQL).bind("sanity_harness"),
      db.prepare(LATEST_TWO_EXTERNAL_SQL).bind("fred_labour"),
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
      } catch (err) {
        await log?.warn("external", "Corrupt swe_bench delta data", {
          error: err instanceof Error ? err.message : String(err),
        });
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
      } catch (err) {
        await log?.warn("external", "Corrupt sanity_harness delta data", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (fredRows.results.length === 2) {
      try {
        const current = JSON.parse(fredRows.results[0].value as string);
        const previous = JSON.parse(fredRows.results[1].value as string);
        if (
          typeof current.softwareIndex === "number" &&
          typeof previous.softwareIndex === "number"
        ) {
          result.fred = {
            softwareIndexDelta: round1(
              current.softwareIndex - previous.softwareIndex
            ),
            generalIndexDelta:
              typeof current.generalIndex === "number" &&
              typeof previous.generalIndex === "number"
                ? round1(current.generalIndex - previous.generalIndex)
                : undefined,
            previousDate: fredRows.results[1].fetched_at as string,
          };
        }
      } catch (err) {
        await log?.warn("external", "Corrupt fred_labour delta data", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    await log?.error("external", "loadExternalDeltas failed", {
      error: err instanceof Error ? err.message : String(err),
    });
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

// --- Funding data loading ---

interface FundingSummary {
  totalRaised: string;
  count: number;
  topRound?: { company: string; amount: string; round?: string };
}

interface FundingEventRow {
  company: string;
  amount: string | null;
  round: string | null;
  source_url: string | null;
  date: string | null;
  relevance: string | null;
}

async function loadFundingSummary(
  db: D1Database,
  log?: Logger
): Promise<FundingSummary> {
  try {
    const rows = await db
      .prepare(
        "SELECT company, amount, round, source_url, date, relevance FROM oq_funding_events WHERE company != ? ORDER BY date DESC"
      )
      .bind(SCANNED_SENTINEL)
      .all<FundingEventRow>();

    const events = dedupFundingRows(rows.results);
    if (events.length === 0) {
      return { totalRaised: "$0", count: 0 };
    }

    let totalMillions = 0;
    let topAmount = 0;
    let topRound: FundingSummary["topRound"] = undefined;

    for (const ev of events) {
      const parsed = parseAmount(ev.amount);
      if (parsed > 0) {
        totalMillions += parsed;
        if (parsed > topAmount) {
          topAmount = parsed;
          topRound = {
            company: ev.company,
            amount: ev.amount!,
            round: ev.round ?? undefined,
          };
        }
      }
    }

    return {
      totalRaised: formatTotalRaised(totalMillions),
      count: events.length,
      topRound,
    };
  } catch (err) {
    await log?.error("external", "loadFundingSummary failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { totalRaised: "$0", count: 0 };
  }
}

/** Parse "$2.1B", "$500M" etc. into millions (USD only).
 *  Bare numbers >1000 without a unit are treated as raw dollars (e.g. "$500,000" → 0.5M). */
export function parseAmount(amount: string | null | undefined): number {
  if (!amount) return 0;
  const match = amount.replace(/,/g, "").match(/^\$?\s*([\d.]+)\s*([BMKbmk])?/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  if (isNaN(num)) return 0;
  const unit = (match[2] ?? "").toUpperCase();
  if (unit === "B") return num * 1000;
  if (unit === "M") return num;
  if (unit === "K") return num / 1000;
  // No unit: if num > 1000, assume raw dollars (e.g. "$500,000" → 0.5M)
  if (num > 1000) return num / 1_000_000;
  return num; // small numbers without unit assumed to be millions
}

function formatTotalRaised(millions: number): string {
  if (millions >= 1000) {
    const b = millions / 1000;
    return `$${b % 1 === 0 ? b.toFixed(0) : b.toFixed(1)}B`;
  }
  if (millions > 0) {
    return `$${Math.round(millions)}M`;
  }
  return "$0";
}

/** Normalise a company+amount pair into a dedup key */
export function fundingDedupeKey(
  company: string,
  amount?: string | null
): string {
  const c = company.trim().toLowerCase();
  // Normalise amount: strip "up to ", whitespace, lowercase
  const a = (amount ?? "")
    .replace(/^up\s+to\s+/i, "")
    .trim()
    .toLowerCase();
  return `${c}|${a}`;
}

/** Deduplicate funding rows by company+amount key. URL is only used as a
 *  secondary check within the same key (same article covering one round
 *  reported by multiple sources). Different companies from the same article
 *  are preserved. */
function dedupFundingRows<
  T extends {
    company: string;
    amount?: string | null;
    source_url?: string | null;
  },
>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = fundingDedupeKey(r.company, r.amount);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function loadRecentFundingEvents(
  db: D1Database,
  days: number,
  limit: number,
  log?: Logger
): Promise<
  {
    company: string;
    amount?: string;
    round?: string;
    sourceUrl?: string;
    date?: string;
    relevance?: string;
  }[]
> {
  try {
    const cutoff = new Date(Date.now() - days * 86400000)
      .toISOString()
      .split("T")[0];
    // Fetch more than needed so dedup still yields enough results
    const rows = await db
      .prepare(
        "SELECT company, amount, round, source_url, date, relevance FROM oq_funding_events WHERE company != ? AND date >= ? ORDER BY date DESC LIMIT ?"
      )
      .bind(SCANNED_SENTINEL, cutoff, limit * 3)
      .all<FundingEventRow>();

    return dedupFundingRows(rows.results)
      .slice(0, limit)
      .map((r) => ({
        company: r.company,
        amount: r.amount ?? undefined,
        round: r.round ?? undefined,
        sourceUrl:
          r.source_url && /^https?:\/\//.test(r.source_url)
            ? r.source_url
            : undefined,
        date: r.date ?? undefined,
        relevance: r.relevance ?? undefined,
      }));
  } catch (err) {
    await log?.error("external", "loadRecentFundingEvents failed", {
      error: err instanceof Error ? err.message : String(err),
      days,
      limit,
    });
    return [];
  }
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

async function backfillFRED(
  db: D1Database,
  apiKey: string,
  log?: Logger
): Promise<{ inserted: number; skipped: number }> {
  // Fetch ~1 year of weekly observations for both series
  const limit = 52;
  const fetchSeries = async (seriesId: string) => {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FeedAI-OQ/1.0" },
    });
    if (!res.ok)
      throw new Error(`FRED backfill ${seriesId}: HTTP ${res.status}`);
    const data = (await res.json()) as {
      observations?: { date: string; value: string }[];
    };
    return (data.observations ?? []).filter((o) => o.value !== ".");
  };

  const [softwareObs, generalObs] = await Promise.all([
    fetchSeries("IHLIDXUSTPSOFTDEVE"),
    fetchSeries("ICSA"),
  ]);

  // Build a map of date -> { softwareIndex, generalIndex }
  const byDate = new Map<
    string,
    { softwareIndex?: number; generalIndex?: number }
  >();
  for (const o of softwareObs) {
    const val = parseFloat(o.value);
    if (!isNaN(val)) {
      byDate.set(o.date, { ...byDate.get(o.date), softwareIndex: val });
    }
  }
  for (const o of generalObs) {
    const val = parseFloat(o.value);
    if (!isNaN(val)) {
      byDate.set(o.date, { ...byDate.get(o.date), generalIndex: val });
    }
  }

  // Check which dates already have data
  const existingRows = await db
    .prepare(
      "SELECT fetched_at FROM oq_external_data_history WHERE key = 'fred_labour'"
    )
    .all<{ fetched_at: string }>();
  const existingDates = new Set(
    existingRows.results.map((r) => (r.fetched_at as string).split("T")[0])
  );

  // Sort dates ascending so chart renders chronologically
  const toInsert = [...byDate.keys()]
    .sort()
    .filter((date) => !existingDates.has(date));

  // Batch in chunks of 100 (D1 batch limit)
  for (let i = 0; i < toInsert.length; i += 100) {
    const chunk = toInsert.slice(i, i + 100);
    await db.batch(
      chunk.map((date) => {
        const entry = byDate.get(date)!;
        return db
          .prepare(
            "INSERT INTO oq_external_data_history (id, key, value, fetched_at) VALUES (?, ?, ?, ?)"
          )
          .bind(
            crypto.randomUUID(),
            "fred_labour",
            JSON.stringify({
              softwareIndex: entry.softwareIndex,
              softwareDate: date,
              generalIndex: entry.generalIndex,
              generalDate: date,
              fetchedAt: `${date}T12:00:00Z`,
            }),
            `${date}T12:00:00Z`
          );
      })
    );
  }

  const inserted = toInsert.length;
  const skipped = byDate.size - inserted;
  await log?.info("external", "FRED backfill complete", {
    inserted,
    skipped,
    totalDates: byDate.size,
  });
  return { inserted, skipped };
}

// --- AI-powered funding extraction from articles ---

const FUNDING_EXTRACT_BATCH_SIZE = 80;
const FUNDING_MODEL_PRIMARY = "gemini-2.0-flash";
const FUNDING_MODEL_FALLBACK = "gpt-4o";
const TEXT_MODEL_OPENAI = "gpt-4o-mini";
const TEXT_MODEL_CLAUDE = "claude-haiku-4-5-20251001";

function stripJsonFences(text: string): string {
  return text.replace(/```(?:json)?\s*/g, "").trim();
}

function buildFundingPrompt(articles: string): string {
  return `Extract ALL AI-related funding/investment events from these articles. Only include events with a specific company name and dollar amount.

Return JSON: { "events": [{ "company": "Name", "amount": "$XB", "round": "Series X", "valuation": "$XB", "source_url": "https://...", "date": "YYYY-MM-DD", "relevance": "AI lab funding | AI code tool | AI infrastructure" }] }

If no funding events found, return { "events": [] }. Return ONLY the JSON object.

Articles:
${articles}`;
}

type FundingCandidate = {
  company: string;
  amount?: string;
  round?: string;
  valuation?: string;
  source_url?: string;
  date?: string;
  relevance?: string;
};

function buildFundingVerificationPrompt(events: FundingCandidate[]): string {
  const eventList = events
    .map(
      (e, i) =>
        `${i + 1}. ${e.company} — ${e.amount ?? "?"} (round: ${e.round ?? "?"}, relevance: ${e.relevance ?? "?"})`
    )
    .join("\n");

  return `You are verifying whether each event below is an actual AI company funding/investment round.

KEEP only events that are genuine venture capital funding rounds, investment rounds, or equity raises by AI companies.

REJECT events that are:
- Corporate capital expenditure or infrastructure spending (e.g. "Meta spending $100B on data centers")
- VC firms raising their own funds (e.g. "General Catalyst raises $5B fund")
- Revenue figures, contracts, or government grants
- Acquisitions or M&A transactions
- Stock buybacks or market cap changes
- General financial figures mentioned in articles that are not funding rounds

Events to verify:
${eventList}

Return JSON: { "verified": [1, 3, 5] }
where the array contains the 1-based indices of events that are genuine funding rounds.
If none are valid, return { "verified": [] }. Return ONLY the JSON object.`;
}

async function callGeminiText(
  prompt: string,
  apiKey: string,
  opts?: { json?: boolean; maxTokens?: number }
): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
  const genConfig: Record<string, unknown> = {
    temperature: 0.1,
    maxOutputTokens: opts?.maxTokens ?? 4096,
  };
  if (opts?.json) genConfig.responseMimeType = "application/json";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${FUNDING_MODEL_PRIMARY}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: genConfig,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini error: ${body.slice(0, 200)}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "{}";
  return {
    text,
    inputTokens: data?.usageMetadata?.promptTokenCount,
    outputTokens: data?.usageMetadata?.candidatesTokenCount,
  };
}

async function callOpenAIText(
  prompt: string,
  apiKey: string,
  opts?: { json?: boolean; maxTokens?: number; model?: string }
): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
  const body: Record<string, unknown> = {
    model: opts?.model ?? TEXT_MODEL_OPENAI,
    temperature: 0.1,
    max_tokens: opts?.maxTokens ?? 4096,
    messages: [{ role: "user", content: prompt }],
  };
  if (opts?.json) body.response_format = { type: "json_object" };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error: ${text.slice(0, 200)}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim() ?? "{}";
  return {
    text,
    inputTokens: data?.usage?.prompt_tokens,
    outputTokens: data?.usage?.completion_tokens,
  };
}

async function callClaudeText(
  prompt: string,
  apiKey: string,
  opts?: { maxTokens?: number }
): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: TEXT_MODEL_CLAUDE,
      max_tokens: opts?.maxTokens ?? 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude error: ${text.slice(0, 200)}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const text =
    data?.content?.[0]?.type === "text" ? data.content[0].text.trim() : "{}";
  return {
    text,
    inputTokens: data?.usage?.input_tokens,
    outputTokens: data?.usage?.output_tokens,
  };
}

type TextProvider = {
  name: string;
  model: string;
  call: (
    prompt: string,
    opts?: { json?: boolean; maxTokens?: number }
  ) => Promise<{ text: string; inputTokens?: number; outputTokens?: number }>;
};

function buildTextProviders(env: Env): TextProvider[] {
  const providers: TextProvider[] = [];
  if (env.GEMINI_API_KEY) {
    providers.push({
      name: "gemini",
      model: FUNDING_MODEL_PRIMARY,
      call: (prompt, opts) => callGeminiText(prompt, env.GEMINI_API_KEY!, opts),
    });
  }
  if (env.OPENAI_API_KEY) {
    providers.push({
      name: "openai",
      model: TEXT_MODEL_OPENAI,
      call: (prompt, opts) => callOpenAIText(prompt, env.OPENAI_API_KEY!, opts),
    });
  }
  if (env.ANTHROPIC_API_KEY) {
    providers.push({
      name: "anthropic",
      model: TEXT_MODEL_CLAUDE,
      call: (prompt, opts) =>
        callClaudeText(prompt, env.ANTHROPIC_API_KEY!, opts),
    });
  }
  return providers;
}

async function extractFundingFromArticles(
  env: Env,
  log: Logger
): Promise<{
  extracted: number;
  articlesScanned: number;
  batches: number;
  skippedDupes: number;
}> {
  // Find articles not yet scanned for funding (no row in oq_funding_events with their ID)
  // Limit to 800 per call (10 batches of 80) — call repeatedly to process all articles
  const EXTRACT_LIMIT = FUNDING_EXTRACT_BATCH_SIZE * 10;
  const articles = await env.DB.prepare(
    `SELECT a.id, a.title, a.url, a.source, a.summary, a.published_at
     FROM oq_articles a
     LEFT JOIN oq_funding_events fe
       ON fe.extracted_from_article_id = a.id
     WHERE fe.id IS NULL
     ORDER BY a.published_at DESC
     LIMIT ?`
  )
    .bind(EXTRACT_LIMIT)
    .all();

  if (articles.results.length === 0) {
    return { extracted: 0, articlesScanned: 0, batches: 0, skippedDupes: 0 };
  }

  const textProviders = buildTextProviders(env);

  // Load existing funding keys for dedup
  const existing = await env.DB.prepare(
    "SELECT company, amount, source_url FROM oq_funding_events WHERE company != ?"
  )
    .bind(SCANNED_SENTINEL)
    .all<{
      company: string;
      amount: string | null;
      source_url: string | null;
    }>();
  const existingKeys = new Set(
    existing.results.map((r) => fundingDedupeKey(r.company, r.amount))
  );

  let totalExtracted = 0;
  let totalSkipped = 0;
  const totalBatches = Math.ceil(
    articles.results.length / FUNDING_EXTRACT_BATCH_SIZE
  );

  // Process in batches
  for (
    let i = 0;
    i < articles.results.length;
    i += FUNDING_EXTRACT_BATCH_SIZE
  ) {
    const batchNum = i / FUNDING_EXTRACT_BATCH_SIZE + 1;
    const batch = articles.results.slice(i, i + FUNDING_EXTRACT_BATCH_SIZE);

    const articleText = batch.map(formatArticleLine).join("\n");

    // Call Gemini, fall back to OpenAI
    let responseText: string;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let provider = "gemini";
    let model = FUNDING_MODEL_PRIMARY;
    let wasFallback = false;

    try {
      if (!env.GEMINI_API_KEY) throw new Error("No GEMINI_API_KEY");
      const r = await callGeminiText(
        buildFundingPrompt(articleText),
        env.GEMINI_API_KEY,
        { json: true }
      );
      responseText = r.text;
      inputTokens = r.inputTokens;
      outputTokens = r.outputTokens;
    } catch (geminiErr) {
      await log.warn("extract-funding", `Gemini failed batch ${batchNum}`, {
        error:
          geminiErr instanceof Error ? geminiErr.message : String(geminiErr),
      });
      if (!env.OPENAI_API_KEY) throw geminiErr;
      wasFallback = true;
      provider = "openai";
      model = FUNDING_MODEL_FALLBACK;
      const r = await callOpenAIText(
        buildFundingPrompt(articleText),
        env.OPENAI_API_KEY,
        { json: true, model: FUNDING_MODEL_FALLBACK }
      );
      responseText = r.text;
      inputTokens = r.inputTokens;
      outputTokens = r.outputTokens;
    }

    // AI usage tracked in the batch below (atomic with sentinel writes)
    const aiUsageStmt = env.DB.prepare(
      "INSERT INTO oq_ai_usage (id, model, provider, input_tokens, output_tokens, total_tokens, latency_ms, was_fallback, error, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      crypto.randomUUID(),
      model,
      provider,
      inputTokens ?? null,
      outputTokens ?? null,
      (inputTokens ?? 0) + (outputTokens ?? 0) || null,
      null,
      wasFallback ? 1 : 0,
      null,
      "success"
    );

    // Parse response
    const cleaned = stripJsonFences(responseText);
    let events: FundingCandidate[] = [];
    try {
      const parsed = JSON.parse(cleaned);
      events = Array.isArray(parsed.events) ? parsed.events : [];
    } catch {
      await log.warn("extract-funding", `Parse failed batch ${batchNum}`, {
        raw: cleaned.slice(0, 200),
      });
    }

    // Dedup
    const dedupedCandidates = events.filter((fe) => {
      if (typeof fe.company !== "string" || !fe.company) return false;
      const key = fundingDedupeKey(fe.company, fe.amount);
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });

    // AI verification: filter out false positives (capex, VC fund raises, etc.)
    let toInsert = dedupedCandidates;
    if (dedupedCandidates.length > 0 && textProviders.length > 0) {
      try {
        const verifyPrompt = buildFundingVerificationPrompt(dedupedCandidates);
        const vr = await textProviders[0].call(verifyPrompt, { json: true });
        const verifyParsed = JSON.parse(stripJsonFences(vr.text));
        const verifiedIndices = new Set<number>(
          Array.isArray(verifyParsed.verified) ? verifyParsed.verified : []
        );
        toInsert = dedupedCandidates.filter((_, idx) =>
          verifiedIndices.has(idx + 1)
        );
        if (toInsert.length !== dedupedCandidates.length) {
          await log.info(
            "extract-funding",
            `Verification filtered batch ${batchNum}`,
            { before: dedupedCandidates.length, after: toInsert.length }
          );
        }
      } catch (verifyErr) {
        await log.warn(
          "extract-funding",
          `Verification failed batch ${batchNum}, using unverified`,
          {
            error:
              verifyErr instanceof Error
                ? verifyErr.message
                : String(verifyErr),
          }
        );
        // Fall through with unverified candidates
      }
    }

    // Find article IDs to mark as scanned — use a sentinel row per article
    const batchIds = batch.map((a) => a.id as string);

    // Build all inserts: AI usage + funding events + sentinel rows (atomic batch)
    const stmts: D1PreparedStatement[] = [aiUsageStmt];

    for (const fe of toInsert) {
      // Find the article this event came from by matching source_url
      const matchedArticle = batch.find(
        (a) =>
          fe.source_url &&
          (a.url as string).toLowerCase() === fe.source_url.toLowerCase()
      );
      stmts.push(
        env.DB.prepare(
          "INSERT INTO oq_funding_events (id, company, amount, round, valuation, source_url, date, relevance, extracted_from_article_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          crypto.randomUUID(),
          fe.company,
          fe.amount ?? null,
          fe.round ?? null,
          fe.valuation ?? null,
          fe.source_url ?? null,
          fe.date ?? null,
          fe.relevance ?? null,
          (matchedArticle?.id as string) ?? null
        )
      );
    }

    // Mark all batch articles as scanned using a sentinel row
    // (company=SCANNED_SENTINEL is never shown — filtered by dedup and queries)
    for (const articleId of batchIds) {
      stmts.push(
        env.DB.prepare(
          "INSERT INTO oq_funding_events (id, company, amount, extracted_from_article_id) VALUES (?, ?, NULL, ?)"
        ).bind(crypto.randomUUID(), SCANNED_SENTINEL, articleId)
      );
    }

    // D1 batch limit is 100 — chunk
    for (let j = 0; j < stmts.length; j += 100) {
      await env.DB.batch(stmts.slice(j, j + 100));
    }

    totalExtracted += toInsert.length;
    totalSkipped += events.length - toInsert.length;

    await log.info("extract-funding", `Batch ${batchNum} complete`, {
      articles: batch.length,
      eventsFound: events.length,
      inserted: toInsert.length,
      skippedDupes: events.length - toInsert.length,
    });
  }

  return {
    extracted: totalExtracted,
    articlesScanned: articles.results.length,
    batches: totalBatches,
    skippedDupes: totalSkipped,
  };
}

async function dedupFundingEvents(
  db: D1Database,
  log?: Logger
): Promise<{ deleted: number; remaining: number }> {
  const rows = await db
    .prepare(
      "SELECT id, company, amount, source_url FROM oq_funding_events WHERE company != ? ORDER BY created_at ASC"
    )
    .bind(SCANNED_SENTINEL)
    .all<{
      id: string;
      company: string;
      amount: string | null;
      source_url: string | null;
    }>();

  const keepIds = new Set(dedupFundingRows(rows.results).map((r) => r.id));
  const toDelete = rows.results
    .filter((r) => !keepIds.has(r.id))
    .map((r) => r.id);

  if (toDelete.length > 0) {
    for (let i = 0; i < toDelete.length; i += 100) {
      const chunk = toDelete.slice(i, i + 100);
      await db.batch(
        chunk.map((id) =>
          db.prepare("DELETE FROM oq_funding_events WHERE id = ?").bind(id)
        )
      );
    }
  }

  await log?.info("external", "Funding dedup complete", {
    deleted: toDelete.length,
    remaining: keepIds.size,
  });
  return { deleted: toDelete.length, remaining: keepIds.size };
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

function formatArticleLine(a: {
  title: unknown;
  summary?: unknown;
  source: unknown;
  url: unknown;
}): string {
  const title = String(a.title).toWellFormed();
  const summary = a.summary
    ? ` — ${String(a.summary).slice(0, 200).toWellFormed()}`
    : "";
  return `- ${title}${summary} (${a.source}) [${a.url}]`;
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

  // Score all articles not yet linked to a score — no time window.
  // First run scores everything; subsequent runs only pick up new articles.
  const articles = await env.DB.prepare(
    "SELECT a.id, a.title, a.url, a.source, a.pillar, a.summary FROM oq_articles a LEFT JOIN oq_score_articles sa ON a.id = sa.article_id WHERE sa.article_id IS NULL ORDER BY a.published_at DESC"
  ).all();

  const pillars: OQPillar[] = [
    "capability",
    "labour_market",
    "sentiment",
    "industry",
    "barriers",
  ];

  // Check if any pillar has more articles than the direct cap
  const pillarArticles = Object.fromEntries(
    pillars.map((pillar) => [
      pillar,
      articles.results.filter((a) => a.pillar === pillar),
    ])
  ) as Record<OQPillar, typeof articles.results>;

  const needsPreDigest = pillars.some(
    (p) => pillarArticles[p].length > DIRECT_CAP
  );

  let articlesByPillar: Record<OQPillar, string>;
  let preDigestPartial = false;

  // Collect pre-digest AI usage to link to scoreId later
  const preDigestUsages: {
    model: string;
    provider: string;
    inputTokens?: number;
    outputTokens?: number;
  }[] = [];

  const textProviders = buildTextProviders(env);

  if (needsPreDigest && textProviders.length > 0) {
    // Map-reduce: pre-digest large article sets, round-robin across providers
    await log?.info("score", "Pre-digest triggered", {
      articleCounts: Object.fromEntries(
        pillars.map((p) => [p, pillarArticles[p].length])
      ),
      providers: textProviders.map((p) => p.name),
    });

    const digestedPillars: Partial<Record<OQPillar, string>> = {};
    let batchIndex = 0; // Global batch counter for round-robin

    for (const pillar of pillars) {
      const pillarArts = pillarArticles[pillar];
      if (pillarArts.length <= DIRECT_CAP) {
        // Small enough — pass directly
        digestedPillars[pillar] = pillarArts.map(formatArticleLine).join("\n");
        continue;
      }

      // Pre-digest in batches, then merge summaries
      const batchSummaries: string[] = [];

      for (let i = 0; i < pillarArts.length; i += PRE_DIGEST_BATCH) {
        const batch = pillarArts.slice(i, i + PRE_DIGEST_BATCH);
        const batchText = batch.map(formatArticleLine).join("\n");
        const batchFallback = batch
          .slice(0, DIRECT_CAP)
          .map(formatArticleLine)
          .join("\n");

        const preDigestPrompt = `You are summarizing articles for the "${pillar}" pillar of an AI replacement tracker.
Distill these ${batch.length} articles into 8-12 bullet points capturing the most significant signals.
Each bullet should reference specific data points, companies, or metrics where possible.
Include the source URL [url] for the most important signals.
Focus on what matters for assessing whether AI will replace software engineers.

Articles:
${batchText}

Return ONLY bullet points, one per line, starting with "- ".`;

        // Round-robin across providers, fallback to next on failure
        let succeeded = false;
        const startProvider = batchIndex % textProviders.length;
        for (let attempt = 0; attempt < textProviders.length; attempt++) {
          const provider =
            textProviders[(startProvider + attempt) % textProviders.length];
          try {
            const r = await provider.call(preDigestPrompt, {
              maxTokens: 2048,
            });
            if (r.text) batchSummaries.push(r.text);

            preDigestUsages.push({
              model: provider.model,
              provider: provider.name,
              inputTokens: r.inputTokens,
              outputTokens: r.outputTokens,
            });
            succeeded = true;
            break;
          } catch (err) {
            await log?.warn(
              "score",
              `Pre-digest ${provider.name} failed for ${pillar}`,
              {
                error: err instanceof Error ? err.message : String(err),
              }
            );
          }
        }

        if (!succeeded) {
          preDigestPartial = true;
          batchSummaries.push(batchFallback);
        }
        batchIndex++;
        // Stagger between batches to avoid rate limits (1s delay)
        if (i + PRE_DIGEST_BATCH < pillarArts.length) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      digestedPillars[pillar] =
        `[Pre-digested from ${pillarArts.length} articles]\n` +
        batchSummaries.join("\n");
    }

    articlesByPillar = digestedPillars as Record<OQPillar, string>;
  } else if (needsPreDigest) {
    await log?.warn(
      "score",
      "Pre-digest skipped: no API keys configured, capping at DIRECT_CAP",
      {
        articleCounts: Object.fromEntries(
          pillars.map((p) => [p, pillarArticles[p].length])
        ),
      }
    );
    preDigestPartial = true;
    // Fallback: cap at DIRECT_CAP per pillar
    articlesByPillar = Object.fromEntries(
      pillars.map((pillar) => [
        pillar,
        pillarArticles[pillar]
          .slice(0, DIRECT_CAP)
          .map(formatArticleLine)
          .join("\n"),
      ])
    ) as Record<OQPillar, string>;
  } else {
    // Normal path: all pillars already <= DIRECT_CAP, pass directly
    articlesByPillar = Object.fromEntries(
      pillars.map((pillar) => [
        pillar,
        pillarArticles[pillar].map(formatArticleLine).join("\n"),
      ])
    ) as Record<OQPillar, string>;
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
  const [externalData, fundingSummary] = await Promise.all([
    loadExternalData(env.DB, log),
    loadFundingSummary(env.DB, log),
  ]);

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
  if (preDigestPartial) qualityFlags.push("pre_digest_partial");

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
    fundingSummary,
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
    labourNote: result.labourNote,
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
      fn: async () => {
        // Combine scoring AI usage + pre-digest AI usage
        const allUsageStmts: D1PreparedStatement[] = [];

        for (const usage of result.aiUsages) {
          allUsageStmts.push(
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
          );
        }

        for (const usage of preDigestUsages) {
          const inTok = usage.inputTokens ?? 0;
          const outTok = usage.outputTokens ?? 0;
          allUsageStmts.push(
            env.DB.prepare(
              "INSERT INTO oq_ai_usage (id, model, provider, input_tokens, output_tokens, total_tokens, latency_ms, was_fallback, error, status, score_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ).bind(
              crypto.randomUUID(),
              usage.model,
              usage.provider,
              usage.inputTokens ?? null,
              usage.outputTokens ?? null,
              inTok + outTok || null,
              null,
              0,
              null,
              "success",
              scoreId
            )
          );
        }

        if (allUsageStmts.length === 0) return;
        // D1 batch limit is 100 — chunk
        for (let i = 0; i < allUsageStmts.length; i += 100) {
          await env.DB.batch(allUsageStmts.slice(i, i + 100));
        }
      },
    },
    {
      label: "article_linkage",
      fn: async () => {
        if (articleIds.length === 0) return;
        // D1 batch limit is 100 — chunk inserts
        for (let i = 0; i < articleIds.length; i += 100) {
          const chunk = articleIds.slice(i, i + 100);
          await env.DB.batch(
            chunk.map((articleId) =>
              env.DB.prepare(
                "INSERT INTO oq_score_articles (score_id, article_id) VALUES (?, ?)"
              ).bind(scoreId, articleId)
            )
          );
        }
      },
    },
    {
      label: "model_responses",
      fn: () =>
        result.modelResponses.length > 0
          ? env.DB.batch(
              result.modelResponses.map((mr) =>
                env.DB.prepare(
                  "INSERT INTO oq_model_responses (id, score_id, model, provider, raw_response, pillar_scores, technical_delta, economic_delta, suggested_delta, analysis, top_signals, capability_gap_note, sanity_harness_note, economic_note, labour_note, input_tokens, output_tokens, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
                  mr.parsed.labour_note ?? null,
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
  labourNote?: string;
  promptHash: string;
  externalData?: string;
  isDecay?: boolean;
  dataQualityFlags?: string;
}

async function saveScore(db: D1Database, data: ScoreInsert): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      "INSERT INTO oq_scores (id, date, score, score_technical, score_economic, delta, delta_explanation, analysis, signals, pillar_scores, model_scores, model_agreement, model_spread, capability_gap, sanity_harness_note, economic_note, labour_note, prompt_hash, external_data, is_decay, data_quality_flags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
      data.labourNote ?? null,
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
    labourNote: row.labour_note,
    externalData: row.external_data
      ? safeJsonParse(row.external_data, null)
      : null,
    promptHash: row.prompt_hash,
    createdAt: row.created_at,
  };
}

// --- Exports ---

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

export {
  fetchOQArticles,
  generateDailyScore,
  extractFeedItems,
  stripHtml,
  stripJsonFences,
  buildFundingVerificationPrompt,
  buildTextProviders,
};
export type { FundingCandidate, TextProvider };

// Crons moved to GitHub Actions (.github/workflows/oq-cron.yml).
// The worker exposes HTTP endpoints that the workflow calls directly.
export default {
  fetch: app.fetch,
};
