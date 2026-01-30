import { Hono } from "hono";
import { cors } from "hono/cors";
import { Env } from "./types";
import { sources, FRESHNESS_THRESHOLDS } from "./sources";
import type { SourceFetchResult } from "./services/fetcher";
import { fetchAllSources } from "./services/fetcher";
import { generateDigest } from "./services/summarizer";
import { logEvent, recordAIUsage } from "./services/logger";

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  if (aBuf.byteLength !== bBuf.byteLength) return false;
  return crypto.subtle.timingSafeEqual(aBuf, bBuf);
}

const app = new Hono<{ Bindings: Env }>();

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
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  logEvent(c.env.DB, {
    level: "error",
    category: "general",
    message: err.message,
    details: { stack: err.stack },
  });
  return c.json({ error: "Internal server error" }, 500);
});

// Get today's digest
app.get("/api/today", async (c) => {
  const today = new Date().toISOString().split("T")[0];
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
    items: items.results.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id,
        category: r.category,
        title: r.title,
        summary: r.summary,
        whyItMatters: r.why_it_matters,
        sourceName: r.source_name,
        sourceUrl: r.source_url,
        publishedAt: r.published_at,
        position: r.position,
      };
    }),
  });
});

// List available dates
app.get("/api/digests", async (c) => {
  const result = await c.env.DB.prepare(
    "SELECT date, item_count FROM digests ORDER BY date DESC LIMIT 30"
  ).all();

  return c.json(result.results);
});

function isAuthorized(authHeader: string, adminKey?: string): boolean {
  if (!adminKey) return false;
  const expected = `Bearer ${adminKey}`;
  return (
    authHeader.length === expected.length &&
    timingSafeEqual(authHeader, expected)
  );
}

app.get("/api/health", async (c) => {
  if (!isAuthorized(c.req.header("Authorization") ?? "", c.env.ADMIN_KEY)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await c.env.DB.prepare(
    "SELECT * FROM source_health ORDER BY last_success_at ASC"
  ).all();

  const now = Math.floor(Date.now() / 1000);
  const healthData = result.results.map((row) => {
    const source = sources.find((s) => s.id === row.source_id);
    const thresholdDays = source ? FRESHNESS_THRESHOLDS[source.category] : 14;
    const thresholdSec = thresholdDays * 24 * 60 * 60;
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
  });

  return c.json(healthData);
});

// --- Admin: AI Usage ---
app.get("/api/admin/ai-usage", async (c) => {
  if (!isAuthorized(c.req.header("Authorization") ?? "", c.env.ADMIN_KEY)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await c.env.DB.prepare(
    "SELECT * FROM ai_usage ORDER BY created_at DESC LIMIT 100"
  ).all();

  return c.json(
    result.results.map((row) => ({
      id: row.id,
      digestId: row.digest_id,
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
    }))
  );
});

// --- Admin: Error Logs ---
app.get("/api/admin/errors", async (c) => {
  if (!isAuthorized(c.req.header("Authorization") ?? "", c.env.ADMIN_KEY)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const category = c.req.query("category");
  const level = c.req.query("level");

  let query = "SELECT * FROM error_logs";
  const conditions: string[] = [];
  const binds: string[] = [];

  if (category) {
    conditions.push("category = ?");
    binds.push(category);
  }
  if (level) {
    conditions.push("level = ?");
    binds.push(level);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY created_at DESC LIMIT 200";

  const stmt = c.env.DB.prepare(query);
  const result = await (binds.length > 0 ? stmt.bind(...binds) : stmt).all();

  return c.json(
    result.results.map((row) => ({
      id: row.id,
      level: row.level,
      category: row.category,
      message: row.message,
      details: row.details ? JSON.parse(row.details as string) : null,
      sourceId: row.source_id,
      digestId: row.digest_id,
      createdAt: row.created_at,
    }))
  );
});

// --- Admin: Dashboard summary ---
app.get("/api/admin/dashboard", async (c) => {
  if (!isAuthorized(c.req.header("Authorization") ?? "", c.env.ADMIN_KEY)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

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

  const now = Math.floor(Date.now() / 1000);

  return c.json({
    ai: {
      recentCalls: aiUsage.results.map((row) => ({
        id: row.id,
        digestId: row.digest_id,
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
      })),
      totalTokens: aiUsage.results.reduce(
        (sum, r) => sum + ((r.total_tokens as number) || 0),
        0
      ),
      rateLimitCount: aiUsage.results.filter(
        (r) => r.status === "rate_limited"
      ).length,
      fallbackCount: aiUsage.results.filter((r) => r.was_fallback === 1)
        .length,
    },
    sources: sourceHealth.results.map((row) => {
      const source = sources.find((s) => s.id === row.source_id);
      const thresholdDays = source ? FRESHNESS_THRESHOLDS[source.category] : 14;
      const thresholdSec = thresholdDays * 24 * 60 * 60;
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
      };
    }),
    errors: recentErrors.results.map((row) => ({
      id: row.id,
      level: row.level,
      category: row.category,
      message: row.message,
      details: row.details ? JSON.parse(row.details as string) : null,
      sourceId: row.source_id,
      createdAt: row.created_at,
    })),
    totalDigests: (digestCount as Record<string, unknown>)?.count ?? 0,
  });
});

app.post("/api/generate", async (c) => {
  if (!isAuthorized(c.req.header("Authorization") ?? "", c.env.ADMIN_KEY)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return generateDailyDigest(c.env);
});

app.post("/api/rebuild", async (c) => {
  if (!isAuthorized(c.req.header("Authorization") ?? "", c.env.ADMIN_KEY)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const today = new Date().toISOString().split("T")[0];
  return rebuildDigest(c.env, today);
});

// Cron handler
async function generateDailyDigest(env: Env): Promise<Response> {
  const today = new Date().toISOString().split("T")[0];

  // Check if already generated
  const existing = await env.DB.prepare("SELECT id FROM digests WHERE date = ?")
    .bind(today)
    .first();

  if (existing) {
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
  console.log(`Deleted existing digest for ${date}`);

  return buildAndSaveDigest(env, date);
}

async function buildAndSaveDigest(env: Env, date: string): Promise<Response> {
  const digestId = `digest-${date}`;

  // Fetch all sources
  console.log("Fetching sources...");
  const { items: rawItems, health } = await fetchAllSources(sources);
  console.log(`Fetched ${rawItems.length} items`);

  // Record source health
  await recordSourceHealth(env, health);

  if (rawItems.length === 0) {
    await logEvent(env.DB, {
      level: "error",
      category: "fetch",
      message: "No items fetched from any source",
      digestId,
    });
    return new Response("No items fetched", { status: 500 });
  }

  // Generate digest with AI (Gemini primary, Claude fallback)
  console.log("Generating digest...");
  const { items: digestItems, aiUsages } = await generateDigest(
    rawItems,
    { gemini: env.GEMINI_API_KEY, anthropic: env.ANTHROPIC_API_KEY },
    digestId
  );
  console.log(`Generated ${digestItems.length} digest items`);

  // Record AI usage
  for (const usage of aiUsages) {
    await recordAIUsage(env.DB, usage);
    if (usage.status !== "success") {
      await logEvent(env.DB, {
        level: usage.status === "rate_limited" ? "warn" : "error",
        category: "ai",
        message: `${usage.provider} ${usage.status}: ${usage.error || "unknown"}`,
        details: { model: usage.model, latencyMs: usage.latencyMs },
        digestId,
      });
    }
  }

  // Save to D1 using batch for atomicity
  const statements = [
    env.DB.prepare(
      "INSERT INTO digests (id, date, item_count) VALUES (?, ?, ?)"
    ).bind(digestId, date, digestItems.length),
    ...digestItems.map((item) =>
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
  ];

  await env.DB.batch(statements);

  return new Response(`Generated digest with ${digestItems.length} items`, {
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

  // Log source failures
  for (const r of results) {
    if (!r.success) {
      await logEvent(env.DB, {
        level: "warn",
        category: "fetch",
        message: `Source fetch failed: ${r.error}`,
        sourceId: r.sourceId,
      });
    }
  }

  try {
    await env.DB.batch(statements);
  } catch (err) {
    console.error("Failed to record source health:", err);
  }
}

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(generateDailyDigest(env));
  },
};
