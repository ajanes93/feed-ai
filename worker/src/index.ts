import { Hono, type Context, type Next } from "hono";
import { cors } from "hono/cors";
import { Env, RawItem, DigestItem, countByCategory } from "./types";
import { todayDate } from "@feed-ai/shared/utils";
import { sources, FRESHNESS_THRESHOLDS } from "./sources";
import type { SourceFetchResult } from "./services/fetcher";
import { fetchAllSources } from "./services/fetcher";
import { generateDigest, DigestError } from "./services/summarizer";
import {
  logEvent,
  logEvents,
  recordAIUsage,
  type AIUsageEntry,
} from "./services/logger";

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
    publishedAt: row.published_at,
    position: row.position,
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
    origin: [
      "https://feed-ai.pages.dev",
      "https://feed-ai.andresjanes.com",
      "http://localhost:5173",
    ],
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
const authMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
  if (!isAuthorized(c.req.header("Authorization") ?? "", c.env.ADMIN_KEY)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
};
app.use("/api/admin/*", authMiddleware);
app.use("/api/generate", authMiddleware);
app.use("/api/rebuild", authMiddleware);

app.post("/api/generate", async (c) => {
  return generateDailyDigest(c.env);
});

app.post("/api/rebuild", async (c) => {
  const today = todayDate();
  return rebuildDigest(c.env, today);
});

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
): Promise<number> {
  if (items.length === 0) return 0;

  // INSERT OR IGNORE — duplicates (same source_id + link) are silently skipped
  const statements = items.map((item) =>
    db
      .prepare(
        "INSERT OR IGNORE INTO raw_items (id, source_id, title, link, content, published_at, date) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        crypto.randomUUID(),
        item.sourceId,
        item.title,
        item.link,
        item.content?.slice(0, 500) ?? null,
        item.publishedAt ?? null,
        date
      )
  );

  // D1 batch limit is 100 statements — chunk if needed
  for (let i = 0; i < statements.length; i += 100) {
    await db.batch(statements.slice(i, i + 100));
  }

  return items.length;
}

// --- Fetch-only: accumulate articles without summarizing ---

export async function fetchAndStoreArticles(env: Env): Promise<Response> {
  const today = todayDate();
  const start = Date.now();

  await logEvent(env.DB, {
    level: "info",
    category: "fetch",
    message: "Starting scheduled fetch-and-store",
    details: { date: today, sourceCount: sources.length },
  });

  const { items: allRawItems, health } = await fetchAllSources(sources);
  await recordSourceHealth(env, health);

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

  try {
    await storeRawItems(env.DB, allRawItems, today);
  } catch (err) {
    await logEvent(env.DB, {
      level: "error",
      category: "fetch",
      message: `Failed to store raw items: ${err instanceof Error ? err.message : String(err)}`,
    });
    return new Response("Failed to store items", { status: 500 });
  }

  const durationMs = Date.now() - start;

  await logEvent(env.DB, {
    level: "info",
    category: "fetch",
    message: `Fetch-and-store complete: ${allRawItems.length} items stored for ${today}`,
    details: {
      fetched: allRawItems.length,
      successSources: health.filter((h) => h.success).length,
      failedSources: failedSources.length,
      durationMs,
    },
  });

  return new Response(`Stored ${allRawItems.length} items for ${today}`, {
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
    content: (row.content as string) ?? undefined,
    publishedAt: (row.published_at as number) ?? undefined,
  }));
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
    recent.results.map((r) => (r.title as string).toLowerCase())
  );
  const deduped = items.filter(
    (item) =>
      !seenUrls.has(item.link) && !seenTitles.has(item.title.toLowerCase())
  );
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

  // --- Fetch fresh + merge with accumulated raw_items ---
  const fetchStart = Date.now();
  const { items: freshItems, health } = await fetchAllSources(sources);
  const fetchMs = Date.now() - fetchStart;

  const successSources = health.filter((h) => h.success);
  const failedSources = health.filter((h) => !h.success);

  await logEvent(env.DB, {
    level: "info",
    category: "fetch",
    message: `Fetched ${freshItems.length} fresh items from ${successSources.length}/${health.length} sources`,
    details: {
      fetchMs,
      successSources: successSources.map((s) => ({
        id: s.sourceId,
        items: s.itemCount,
      })),
      failedSources: failedSources.map((s) => ({
        id: s.sourceId,
        error: s.error,
      })),
    },
    digestId,
  });

  await recordSourceHealth(env, health);

  // Store fresh items, then load all accumulated items (today + yesterday)
  await storeRawItems(env.DB, freshItems, date);
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
      details: {
        failedSources: failedSources.map((s) => ({
          id: s.sourceId,
          error: s.error,
        })),
      },
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
        "INSERT INTO items (id, digest_id, category, title, summary, why_it_matters, source_name, source_url, published_at, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        item.id,
        item.digestId,
        item.category,
        item.title,
        item.summary,
        item.whyItMatters ?? null,
        item.sourceName,
        item.sourceUrl ?? null,
        item.publishedAt ?? null,
        item.position
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
    // 6am and 12pm UTC: fetch-only (accumulate articles)
    // 6pm UTC: full digest generation (fetch + summarize)
    const hour = new Date(event.scheduledTime).getUTCHours();
    const isDigestTime = hour === 18;

    ctx.waitUntil(
      (async () => {
        await logEvent(env.DB, {
          level: "info",
          category: "digest",
          message: `Cron triggered at ${hour}:00 UTC — ${isDigestTime ? "full digest" : "fetch-only"}`,
        });
        return isDigestTime
          ? generateDailyDigest(env)
          : fetchAndStoreArticles(env);
      })()
    );
  },
};
