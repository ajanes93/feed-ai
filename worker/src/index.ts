import { Hono, type Context, type Next } from "hono";
import { cors } from "hono/cors";
import { Env, RawItem, DigestItem, countByCategory } from "./types";
import { todayDate } from "@feed-ai/shared/utils";
import { sources, FRESHNESS_THRESHOLDS, type Source } from "./sources";
import type { SourceFetchResult } from "./services/fetcher";
import { fetchAllSources } from "./services/fetcher";
import {
  generateDigest,
  DigestError,
  type SummarizerLog,
} from "./services/summarizer";
import {
  logEvent,
  logEvents,
  recordAIUsage,
  type AIUsageEntry,
} from "./services/logger";
import { enrichSingleItem } from "./services/comments";

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  if (aBuf.byteLength !== bBuf.byteLength) return false;
  return crypto.subtle.timingSafeEqual(aBuf, bBuf);
}

function isAuthorized(authHeader: string, adminKey?: string): boolean {
  if (!adminKey) return false;
  const expected = `Bearer ${adminKey}`;
  return (
    authHeader.length === expected.length &&
    timingSafeEqual(authHeader, expected)
  );
}

function safeJsonParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// --- Shared mapping helpers ---

function mapSourceHealth(row: Record<string, unknown>) {
  const source = sources.find((s) => s.id === row.source_id);
  const thresholdDays = source ? FRESHNESS_THRESHOLDS[source.category] : 14;
  const thresholdSec = thresholdDays * 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  const lastSuccess = row.last_success_at as number | null;
  const stale = !lastSuccess || now - lastSuccess > thresholdSec;

  return {
    sourceId: row.source_id,
    sourceName: source?.name ?? row.source_id,
    category: source?.category ?? "unknown",
    lastSuccessAt: lastSuccess,
    lastErrorAt: row.last_error_at,
    lastError: row.last_error,
    itemCount: row.item_count,
    consecutiveFailures: row.consecutive_failures,
    stale,
    thresholdDays,
  };
}

function mapAIUsage(row: Record<string, unknown>) {
  return {
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
  };
}

function mapErrorLog(row: Record<string, unknown>) {
  return {
    id: row.id,
    level: row.level,
    category: row.category,
    message: row.message,
    details: row.details ? safeJsonParse(row.details as string) : null,
    sourceId: row.source_id,
    digestId: row.digest_id,
    createdAt: row.created_at,
  };
}

function mapDigestItem(row: Record<string, unknown>) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    summary: row.summary,
    whyItMatters: row.why_it_matters,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    commentsUrl: row.comments_url ?? undefined,
    publishedAt: row.published_at,
    position: row.position,
    commentSummary: row.comment_summary ?? undefined,
    commentCount: row.comment_count ?? undefined,
    commentScore: row.comment_score ?? undefined,
    commentSummarySource: row.comment_summary_source ?? undefined,
  };
}

async function logSettledFailures(
  db: D1Database,
  label: string,
  results: PromiseSettledResult<unknown>[]
) {
  for (const r of results) {
    if (r.status === "rejected") {
      console.warn(`${label} failed:`, r.reason);
      await logEvent(db, {
        level: "error",
        category: "general",
        message: `${label} failed: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
      });
    }
  }
}

// --- App ---

export const app = new Hono<{ Bindings: Env }>();

app.use(
  "/*",
  cors({
    origin: (origin) => {
      if (!origin) return "";
      const { hostname } = new URL(origin);
      if (
        hostname === "localhost" ||
        hostname.endsWith(".andresjanes.com") ||
        hostname.endsWith(".andresjanes.pages.dev")
      ) {
        return origin;
      }
      return "";
    },
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Catch-all error handler
app.onError(async (err, c) => {
  console.error("Unhandled error:", err);
  await logEvent(c.env.DB, {
    level: "error",
    category: "general",
    message: err.message,
    details: { stack: err.stack },
  });
  return c.json({ error: "Internal server error" }, 500);
});

// Get today's digest
app.get("/api/today", async (c) => {
  const today = todayDate();
  return c.redirect(`/api/digest/${today}`);
});

app.get("/api/digest/:date", async (c) => {
  const date = c.req.param("date");

  const digest = await c.env.DB.prepare("SELECT * FROM digests WHERE date = ?")
    .bind(date)
    .first();

  if (!digest) {
    return c.json({ error: "No digest for this date", date }, 404);
  }

  const items = await c.env.DB.prepare(
    "SELECT * FROM items WHERE digest_id = ? ORDER BY position"
  )
    .bind(digest.id)
    .all();

  return c.json({
    id: digest.id,
    date: digest.date,
    itemCount: digest.item_count,
    items: items.results.map((row) =>
      mapDigestItem(row as Record<string, unknown>)
    ),
  });
});

// List available dates
app.get("/api/digests", async (c) => {
  const result = await c.env.DB.prepare(
    "SELECT date, item_count FROM digests ORDER BY date DESC LIMIT 30"
  ).all();

  return c.json(result.results);
});

app.get("/api/health", async (c) => {
  const result = await c.env.DB.prepare(
    "SELECT * FROM source_health ORDER BY last_success_at ASC"
  ).all();

  return c.json(
    result.results
      .filter((row) => activeSourceIds.has(row.source_id as string))
      .map((row) => mapSourceHealth(row as Record<string, unknown>))
  );
});

// Auth middleware for admin endpoints
const authMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
  if (!isAuthorized(c.req.header("Authorization") ?? "", c.env.ADMIN_KEY)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
};
app.use("/api/admin/*", authMiddleware);

// --- Dashboard summary (single endpoint for all dashboard data) ---
app.get("/api/admin/dashboard", async (c) => {
  const [aiUsage, recentErrors, sourceHealth, digestCount] = await Promise.all([
    c.env.DB.prepare(
      "SELECT * FROM ai_usage ORDER BY created_at DESC LIMIT 30"
    ).all(),
    c.env.DB.prepare(
      "SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 20"
    ).all(),
    c.env.DB.prepare(
      "SELECT * FROM source_health ORDER BY last_success_at ASC"
    ).all(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM digests").first(),
  ]);

  const mappedUsage = aiUsage.results.map((row) =>
    mapAIUsage(row as Record<string, unknown>)
  );

  return c.json({
    ai: {
      recentCalls: mappedUsage,
      totalTokens: aiUsage.results.reduce(
        (sum, r) => sum + ((r.total_tokens as number) || 0),
        0
      ),
      rateLimitCount: aiUsage.results.filter((r) => r.status === "rate_limited")
        .length,
      fallbackCount: aiUsage.results.filter((r) => r.was_fallback === 1).length,
    },
    sources: sourceHealth.results
      .filter((row) => activeSourceIds.has(row.source_id as string))
      .map((row) => mapSourceHealth(row as Record<string, unknown>)),
    errors: recentErrors.results.map((row) =>
      mapErrorLog(row as Record<string, unknown>)
    ),
    totalDigests: (digestCount as Record<string, unknown>)?.count ?? 0,
  });
});

// --- Logs endpoint for debugging ---
app.get("/api/admin/logs", async (c) => {
  const level = c.req.query("level"); // info, warn, error
  const category = c.req.query("category"); // ai, fetch, parse, general, digest, summarizer
  const limit = Math.min(
    parseInt(c.req.query("limit") || "100", 10) || 100,
    500
  );
  const digestId = c.req.query("digest_id");

  let query = "SELECT * FROM error_logs WHERE 1=1";
  const bindings: (string | number)[] = [];

  if (level) {
    query += " AND level = ?";
    bindings.push(level);
  }
  if (category) {
    query += " AND category = ?";
    bindings.push(category);
  }
  if (digestId) {
    query += " AND digest_id = ?";
    bindings.push(digestId);
  }

  query += " ORDER BY created_at DESC LIMIT ?";
  bindings.push(limit);

  const result = await c.env.DB.prepare(query)
    .bind(...bindings)
    .all();

  return c.json({
    count: result.results.length,
    logs: result.results.map((row) =>
      mapErrorLog(row as Record<string, unknown>)
    ),
  });
});

// Auth middleware for write endpoints
app.use("/api/fetch", authMiddleware);
app.use("/api/generate", authMiddleware);
app.use("/api/rebuild", authMiddleware);
app.use("/api/enrich-comments", authMiddleware);

app.post("/api/fetch", async (c) => {
  let result;
  try {
    result = await runFetchAndStore(c.env);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Failed to fetch sources: ${message}` }, 500);
  }

  const { items, health } = result;
  const perSource = health.map((h) => ({
    sourceId: h.sourceId,
    items: h.itemCount,
    error: h.error ?? null,
  }));

  return c.json({
    totalItems: items.length,
    sourcesOk: health.filter((h) => h.success).length,
    sourcesTotal: health.length,
    zeroItems: perSource.filter((s) => s.items === 0 && !s.error),
    errors: perSource.filter((s) => s.error),
  });
});

app.post("/api/generate", async (c) => {
  return generateDailyDigest(c.env);
});

app.post("/api/rebuild", async (c) => {
  const today = todayDate();
  return rebuildDigest(c.env, today);
});

// --- Comment enrichment (self-chaining via waitUntil) ---

const ENRICH_BATCH_SIZE = 3;

function safeWaitUntil(
  c: Context<{ Bindings: Env }>,
  fn: () => Promise<unknown>
) {
  try {
    if (c.executionCtx) {
      c.executionCtx.waitUntil(fn());
    } else {
      console.warn("No execution context — skipping background task");
    }
  } catch (err) {
    console.error("Failed to schedule background task:", err);
  }
}

const MAX_ENRICHMENT_ROUNDS = 10;

async function fireEnrichmentSafe(env: Env, round: number) {
  try {
    await env.SELF.fetch(
      new Request(`https://self/api/enrich-comments?round=${round}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.ADMIN_KEY}` },
      })
    );
  } catch (err) {
    await logEvent(env.DB, {
      level: "error",
      category: "digest",
      message: `Failed to fire comment enrichment: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

app.post("/api/enrich-comments", async (c) => {
  const round = parseInt(c.req.query("round") || "1", 10);
  const result = await enrichDigestComments(c.env);

  // Self-chain: if more items remain and under circuit breaker limit
  if (result.remaining > 0 && round < MAX_ENRICHMENT_ROUNDS) {
    safeWaitUntil(c, () => fireEnrichmentSafe(c.env, round + 1));
  } else if (result.remaining > 0) {
    await logEvent(c.env.DB, {
      level: "warn",
      category: "digest",
      message: `Comment enrichment hit max rounds (${MAX_ENRICHMENT_ROUNDS}), ${result.remaining} items still unenriched`,
    });
  }

  return c.json({ ...result, round });
});

async function enrichDigestComments(
  env: Env
): Promise<{ enriched: number; remaining: number; skipped: number }> {
  const today = todayDate();
  const digestId = `digest-${today}`;
  const logs: SummarizerLog[] = [];
  const aiUsages: AIUsageEntry[] = [];

  const geminiKey = env.GEMINI_API_KEY;
  if (!geminiKey) {
    return { enriched: 0, remaining: 0, skipped: 0 };
  }

  // Find unenriched items from Reddit or HN sources (skip already-processed)
  const unenriched = await env.DB.prepare(
    `SELECT id, title, source_url, comments_url FROM items
     WHERE digest_id = ? AND comment_summary IS NULL AND comment_summary_source IS NULL
     AND (source_url LIKE '%reddit.com%' OR source_name LIKE 'Hacker News%' OR comments_url LIKE 'https://news.ycombinator.com/%')
     LIMIT ?`
  )
    .bind(digestId, ENRICH_BATCH_SIZE)
    .all();

  const candidates = unenriched.results as Array<{
    id: string;
    title: string;
    source_url: string;
    comments_url: string | null;
  }>;

  if (candidates.length === 0) {
    await logEvent(env.DB, {
      level: "info",
      category: "digest",
      message: "Comment enrichment: no unenriched items remain",
      digestId,
    });
    return { enriched: 0, remaining: 0, skipped: 0 };
  }

  const markSkipped = (id: string) =>
    env.DB.prepare(
      `UPDATE items SET comment_summary_source = 'skipped' WHERE id = ?`
    )
      .bind(id)
      .run();

  let enriched = 0;
  let skipped = 0;

  for (const item of candidates) {
    try {
      const result = await enrichSingleItem(
        item.title,
        item.source_url,
        geminiKey,
        logs,
        item.comments_url ?? undefined
      );

      if (result) {
        await env.DB.prepare(
          `UPDATE items SET comment_summary = ?, comment_count = ?, comment_score = ?, comment_summary_source = 'generated'
           WHERE id = ?`
        )
          .bind(
            result.commentSummary,
            result.commentCount,
            result.commentScore,
            item.id
          )
          .run();
        aiUsages.push(result.aiUsage);
        enriched++;
      } else {
        await markSkipped(item.id);
        skipped++;
      }
    } catch (err) {
      logs.push({
        level: "warn",
        message: `Failed to enrich "${item.title}": ${err instanceof Error ? err.message : String(err)}`,
      });
      await markSkipped(item.id);
      skipped++;
    }
  }

  // Record AI usages
  if (aiUsages.length > 0) {
    await recordAIUsage(env.DB, aiUsages);
  }

  // Log all comment enrichment logs
  if (logs.length > 0) {
    await logEvents(
      env.DB,
      logs.map((l) => ({
        level: l.level,
        category: "digest",
        message: l.message,
        digestId,
      }))
    );
  }

  // Count truly unenriched items remaining (no comment_summary_source set)
  const remainingCount = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM items
     WHERE digest_id = ? AND comment_summary IS NULL AND comment_summary_source IS NULL
     AND (source_url LIKE '%reddit.com%' OR source_name LIKE 'Hacker News%' OR comments_url LIKE 'https://news.ycombinator.com/%')`
  )
    .bind(digestId)
    .first<{ count: number }>();

  const remaining = remainingCount?.count ?? 0;

  await logEvent(env.DB, {
    level: "info",
    category: "digest",
    message: `Comment enrichment batch: ${enriched} enriched, ${skipped} skipped, ${remaining} remaining`,
    digestId,
  });

  return { enriched, remaining, skipped };
}

// Cron handler
async function generateDailyDigest(env: Env): Promise<Response> {
  const today = todayDate();

  // Check if already generated
  const existing = await env.DB.prepare("SELECT id FROM digests WHERE date = ?")
    .bind(today)
    .first();

  if (existing) {
    await logEvent(env.DB, {
      level: "info",
      category: "digest",
      message: `Digest already exists for ${today}, skipping generation`,
      digestId: `digest-${today}`,
    });
    return new Response(`Digest already exists for ${today}`, { status: 200 });
  }

  return buildAndSaveDigest(env, today);
}

// Rebuild: delete existing digest for date, then regenerate
async function rebuildDigest(env: Env, date: string): Promise<Response> {
  const digestId = `digest-${date}`;

  // Delete existing digest and its items
  await env.DB.batch([
    env.DB.prepare("DELETE FROM items WHERE digest_id = ?").bind(digestId),
    env.DB.prepare("DELETE FROM digests WHERE id = ?").bind(digestId),
  ]);

  await logEvent(env.DB, {
    level: "info",
    category: "digest",
    message: `Deleted existing digest for rebuild`,
    digestId,
  });

  return buildAndSaveDigest(env, date);
}

// --- Digest pipeline helpers ---

const sourceCategoryMap = new Map(sources.map((s) => [s.id, s.category]));
const activeSourceIds = new Set(sources.map((s) => s.id));

// --- Store raw items in DB for accumulation throughout the day ---

async function storeRawItems(
  db: D1Database,
  items: RawItem[],
  date: string
): Promise<void> {
  if (items.length === 0) return;

  // Upsert: insert new items, backfill comments_url only when missing
  const statements = items.map((item) =>
    db
      .prepare(
        "INSERT INTO raw_items (id, source_id, title, link, comments_url, content, published_at, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source_id, link) DO UPDATE SET comments_url = excluded.comments_url WHERE excluded.comments_url IS NOT NULL AND raw_items.comments_url IS NULL"
      )
      .bind(
        crypto.randomUUID(),
        item.sourceId,
        item.title,
        item.link,
        item.commentsUrl ?? null,
        item.content?.slice(0, 500) ?? null,
        item.publishedAt ?? null,
        date
      )
  );

  // D1 batch limit is 100 statements — chunk if needed
  for (let i = 0; i < statements.length; i += 100) {
    await db.batch(statements.slice(i, i + 100));
  }
}

// --- Shared fetch + store logic ---

function filterSourcesByCategories(
  categories?: Source["category"][]
): Source[] {
  if (!categories) return sources;
  return sources.filter((s) => categories.includes(s.category));
}

async function runFetchAndStore(env: Env, categories?: Source["category"][]) {
  const today = todayDate();
  const filtered = filterSourcesByCategories(categories);
  const { items, health } = await fetchAllSources(filtered);
  await recordSourceHealth(env, health);
  await storeRawItems(env.DB, items, today);
  return { items, health, today };
}

// --- Fetch-only: accumulate articles without summarizing ---

export async function fetchAndStoreArticles(
  env: Env,
  categories?: Source["category"][]
): Promise<Response> {
  const start = Date.now();
  const filtered = filterSourcesByCategories(categories);
  const label = categories ? categories.join("+") : "all";

  await logEvent(env.DB, {
    level: "info",
    category: "fetch",
    message: `Starting scheduled fetch-and-store (${label})`,
    details: {
      date: todayDate(),
      sourceCount: filtered.length,
      categories: label,
    },
  });

  let result;
  try {
    result = await runFetchAndStore(env, categories);
  } catch (err) {
    await logEvent(env.DB, {
      level: "error",
      category: "fetch",
      message: `Failed to fetch/store (${label}): ${err instanceof Error ? err.message : String(err)}`,
    });
    return new Response("Failed to store items", { status: 500 });
  }

  const { items, health, today } = result;
  const failedSources = health.filter((h) => !h.success);

  if (failedSources.length > 0) {
    await logEvent(env.DB, {
      level: "warn",
      category: "fetch",
      message: `${failedSources.length} sources failed during fetch-and-store`,
      details: {
        failedSources: failedSources.map((s) => ({
          id: s.sourceId,
          error: s.error,
        })),
      },
    });
  }

  await logEvent(env.DB, {
    level: "info",
    category: "fetch",
    message: `Fetch-and-store complete (${label}): ${items.length} items stored for ${today}`,
    details: {
      fetched: items.length,
      successSources: health.filter((h) => h.success).length,
      failedSources: failedSources.length,
      categories: label,
      durationMs: Date.now() - start,
    },
  });

  return new Response(`Stored ${items.length} ${label} items for ${today}`, {
    status: 200,
  });
}

// --- Load accumulated raw items from DB ---

async function loadRecentRawItems(db: D1Database): Promise<RawItem[]> {
  // Include articles from the last 24 hours so nothing falls through the cracks
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const result = await db
    .prepare("SELECT * FROM raw_items WHERE date >= ?")
    .bind(yesterday)
    .all();

  return result.results.map((row) => ({
    id: row.id as string,
    sourceId: row.source_id as string,
    title: (row.title as string) || "",
    link: (row.link as string) || "",
    commentsUrl: (row.comments_url as string) ?? undefined,
    content: (row.content as string) ?? undefined,
    publishedAt: (row.published_at as number) ?? undefined,
  }));
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function deduplicateItems(
  items: RawItem[],
  db: D1Database
): Promise<RawItem[]> {
  const recent = await db
    .prepare(
      "SELECT source_url, title FROM items WHERE digest_id IN (SELECT id FROM digests WHERE date >= ?)"
    )
    .bind(new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0])
    .all();
  const seenUrls = new Set(recent.results.map((r) => r.source_url as string));
  const seenTitles = new Set(
    recent.results.map((r) => normalizeTitle(r.title as string))
  );

  // Filter against previous digests AND within this batch
  const deduped: RawItem[] = [];
  const batchTitles = new Set<string>();

  for (const item of items) {
    const normalized = normalizeTitle(item.title);

    // Skip if URL or title seen in recent digests
    if (seenUrls.has(item.link) || seenTitles.has(normalized)) continue;

    // Skip if same normalized title already in this batch (cross-source dupe)
    if (batchTitles.has(normalized)) continue;

    batchTitles.add(normalized);
    deduped.push(item);
  }

  return deduped;
}

export function capPerSource(items: RawItem[], max: number): RawItem[] {
  const bySource = new Map<string, RawItem[]>();
  for (const item of items) {
    if (!bySource.has(item.sourceId)) {
      bySource.set(item.sourceId, []);
    }
    bySource.get(item.sourceId)!.push(item);
  }

  return Array.from(bySource.values()).flatMap((sourceItems) => {
    sourceItems.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
    return sourceItems.slice(0, max);
  });
}

export function splitJobsAndNews(items: RawItem[]) {
  const jobItems = items.filter(
    (item) => sourceCategoryMap.get(item.sourceId) === "jobs"
  );
  const newsItems = items.filter(
    (item) => sourceCategoryMap.get(item.sourceId) !== "jobs"
  );
  return { jobItems, newsItems };
}

async function buildAndSaveDigest(env: Env, date: string): Promise<Response> {
  const digestId = `digest-${date}`;
  const pipelineStart = Date.now();

  await logEvent(env.DB, {
    level: "info",
    category: "digest",
    message: "Starting digest pipeline",
    details: { date, sourceCount: sources.length },
    digestId,
  });

  // --- Load accumulated raw_items (populated by fetch crons) ---
  const allRawItems = await loadRecentRawItems(env.DB);

  await logEvent(env.DB, {
    level: "info",
    category: "digest",
    message: `Loaded ${allRawItems.length} accumulated items (last 24h)`,
    digestId,
  });

  if (allRawItems.length === 0) {
    await logEvent(env.DB, {
      level: "error",
      category: "fetch",
      message: "No items available from any source — aborting digest",
      digestId,
    });
    return new Response("No items fetched", { status: 500 });
  }

  // --- Dedup against previous digests ---
  const dedupedItems = await deduplicateItems(allRawItems, env.DB);

  await logEvent(env.DB, {
    level: "info",
    category: "digest",
    message: `Dedup: ${allRawItems.length} → ${dedupedItems.length} items`,
    details: {
      removed: allRawItems.length - dedupedItems.length,
    },
    digestId,
  });

  if (dedupedItems.length === 0) {
    await logEvent(env.DB, {
      level: "warn",
      category: "digest",
      message: "All items were duplicates of recent digests",
      details: { totalCount: allRawItems.length },
      digestId,
    });
    return new Response("All items were duplicates of recent digests", {
      status: 200,
    });
  }

  // --- Split jobs/news (no per-source cap — let AI see everything) ---
  const { jobItems, newsItems } = splitJobsAndNews(dedupedItems);

  await logEvent(env.DB, {
    level: "info",
    category: "digest",
    message: `Split ${dedupedItems.length} items: ${newsItems.length} news, ${jobItems.length} jobs (no per-source cap)`,
    details: {
      newsSources: [...new Set(newsItems.map((i) => i.sourceId))],
      jobSources: [...new Set(jobItems.map((i) => i.sourceId))],
      sourceBreakdown: dedupedItems.reduce(
        (acc, item) => {
          acc[item.sourceId] = (acc[item.sourceId] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    },
    digestId,
  });

  // --- Generate digests ---
  const apiKeys = {
    gemini: env.GEMINI_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
  };
  const allDigestItems: DigestItem[] = [];
  const allAiUsages: AIUsageEntry[] = [];

  async function recordUsages() {
    if (allAiUsages.length === 0) return;
    const tasks = allAiUsages.flatMap((usage) => {
      const recordTask = recordAIUsage(env.DB, usage);
      if (usage.status === "success") return [recordTask];

      const logTask = logEvent(env.DB, {
        level: usage.status === "rate_limited" ? "warn" : "error",
        category: "ai",
        message: `${usage.provider} ${usage.status}: ${usage.error || "unknown"}`,
        details: { model: usage.model, latencyMs: usage.latencyMs },
        digestId,
      });
      return [recordTask, logTask];
    });
    const results = await Promise.allSettled(tasks);
    await logSettledFailures(env.DB, "AI usage recording", results);
  }

  async function runDigest(rawItems: RawItem[], type: "news" | "jobs") {
    await logEvent(env.DB, {
      level: "info",
      category: "summarizer",
      message: `Generating ${type} digest from ${rawItems.length} items`,
      details: {
        sources: [...new Set(rawItems.map((i) => i.sourceId))],
        titles: rawItems.map((i) => i.title),
      },
      digestId,
    });

    try {
      const { items, aiUsages, logs } = await generateDigest(
        rawItems,
        apiKeys,
        type
      );
      allDigestItems.push(...items);
      allAiUsages.push(...aiUsages);

      // Persist all summarizer logs to DB
      await logEvents(
        env.DB,
        logs.map((log) => ({
          level: log.level,
          category: "summarizer" as const,
          message: `[${type}] ${log.message}`,
          details: log.details,
          digestId,
        }))
      );

      await logEvent(env.DB, {
        level: "info",
        category: "summarizer",
        message: `${type} digest complete: ${items.length} items`,
        details: {
          categories: countByCategory(items),
        },
        digestId,
      });
    } catch (err) {
      if (err instanceof DigestError) allAiUsages.push(...err.aiUsages);
      await logEvent(env.DB, {
        level: "error",
        category: "summarizer",
        message: `${type} digest generation failed: ${err instanceof Error ? err.message : String(err)}`,
        details: { stack: err instanceof Error ? err.stack : undefined },
        digestId,
      });
    }
  }

  if (newsItems.length > 0) {
    await runDigest(newsItems, "news");
  } else {
    await logEvent(env.DB, {
      level: "warn",
      category: "digest",
      message: "No news items to generate digest from",
      digestId,
    });
  }

  if (jobItems.length > 0) {
    await runDigest(jobItems, "jobs");
  } else {
    await logEvent(env.DB, {
      level: "info",
      category: "digest",
      message: "No job items found — skipping jobs digest",
      digestId,
    });
  }

  // Assign digestId and sequential positions to all items
  for (let i = 0; i < allDigestItems.length; i++) {
    allDigestItems[i].id = `${digestId}-${i}`;
    allDigestItems[i].digestId = digestId;
    allDigestItems[i].position = i;
  }

  await recordUsages();

  if (allDigestItems.length === 0) {
    await logEvent(env.DB, {
      level: "error",
      category: "digest",
      message:
        "No digest items generated from any source — pipeline produced nothing",
      details: {
        newsItemsInput: newsItems.length,
        jobItemsInput: jobItems.length,
      },
      digestId,
    });
    return new Response("No digest items generated", { status: 500 });
  }

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO digests (id, date, item_count) VALUES (?, ?, ?)"
    ).bind(digestId, date, allDigestItems.length),
    ...allDigestItems.map((item) =>
      env.DB.prepare(
        "INSERT INTO items (id, digest_id, category, title, summary, why_it_matters, source_name, source_url, comments_url, published_at, position, comment_summary, comment_count, comment_score, comment_summary_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        item.id,
        item.digestId,
        item.category,
        item.title,
        item.summary,
        item.whyItMatters ?? null,
        item.sourceName,
        item.sourceUrl ?? null,
        item.commentsUrl ?? null,
        item.publishedAt ?? null,
        item.position,
        item.commentSummary ?? null,
        item.commentCount ?? null,
        item.commentScore ?? null,
        item.commentSummarySource ?? null
      )
    ),
  ]);

  const pipelineMs = Date.now() - pipelineStart;

  await logEvent(env.DB, {
    level: "info",
    category: "digest",
    message: `Digest pipeline complete: ${allDigestItems.length} items saved`,
    details: {
      pipelineMs,
      totalItems: allDigestItems.length,
      categories: countByCategory(allDigestItems),
    },
    digestId,
  });

  return new Response(`Generated digest with ${allDigestItems.length} items`, {
    status: 200,
  });
}

async function recordSourceHealth(env: Env, results: SourceFetchResult[]) {
  const now = Math.floor(Date.now() / 1000);
  const statements = results.map((r) => {
    if (r.success) {
      return env.DB.prepare(
        `INSERT INTO source_health (source_id, last_success_at, item_count, consecutive_failures)
         VALUES (?, ?, ?, 0)
         ON CONFLICT(source_id) DO UPDATE SET
           last_success_at = ?, item_count = ?, consecutive_failures = 0`
      ).bind(r.sourceId, now, r.itemCount, now, r.itemCount);
    }
    return env.DB.prepare(
      `INSERT INTO source_health (source_id, last_error_at, last_error, consecutive_failures)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(source_id) DO UPDATE SET
         last_error_at = ?, last_error = ?,
         consecutive_failures = source_health.consecutive_failures + 1`
    ).bind(r.sourceId, now, r.error ?? null, now, r.error ?? null);
  });

  // Log source failures (best-effort)
  const logResults = await Promise.allSettled(
    results
      .filter((r) => !r.success)
      .map((r) =>
        logEvent(env.DB, {
          level: "warn",
          category: "fetch",
          message: `Source fetch failed: ${r.error}`,
          sourceId: r.sourceId,
        })
      )
  );
  await logSettledFailures(env.DB, "Source failure logging", logResults);

  try {
    await env.DB.batch(statements);
  } catch (err) {
    console.error("Failed to record source health:", err);
    await logEvent(env.DB, {
      level: "error",
      category: "general",
      message: `Failed to record source health: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Fetch crons split by category (minute offsets):
    //   :00 = AI sources, :05 = Dev sources, :10 = Jobs+Sport sources
    // Digest + enrich at 18:00 / 18:05
    const time = new Date(event.scheduledTime);
    const hour = time.getUTCHours();
    const minute = time.getUTCMinutes();

    // Category mapping by minute offset for fetch windows
    const fetchCategories: Record<number, Source["category"][]> = {
      0: ["ai"],
      5: ["dev"],
      10: ["jobs", "sport"],
    };

    ctx.waitUntil(
      (async () => {
        // 18:05 — enrich comments
        if (hour === 18 && minute === 5) {
          await logEvent(env.DB, {
            level: "info",
            category: "digest",
            message: "Comment enrichment cron triggered",
          });
          const result = await enrichDigestComments(env);
          if (result.remaining > 0) {
            ctx.waitUntil(fireEnrichmentSafe(env, 2));
          }
          return;
        }

        // 18:00 — full digest generation
        if (hour === 18 && minute === 0) {
          await logEvent(env.DB, {
            level: "info",
            category: "digest",
            message: "Cron triggered at 18:00 UTC — full digest",
          });
          return generateDailyDigest(env);
        }

        // Fetch windows: :00 AI, :05 Dev, :10 Jobs+Sport
        const categories = fetchCategories[minute];
        if (categories) {
          const label = categories.join("+");
          await logEvent(env.DB, {
            level: "info",
            category: "fetch",
            message: `Cron triggered at ${hour}:${String(minute).padStart(2, "0")} UTC — fetch ${label}`,
          });
          return fetchAndStoreArticles(env, categories);
        }
      })()
    );
  },
};
