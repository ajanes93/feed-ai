import { Hono } from "hono";
import { cors } from "hono/cors";
import { Env } from "./types";
import { sources, FRESHNESS_THRESHOLDS } from "./sources";
import type { SourceFetchResult } from "./services/fetcher";
import { fetchAllSources } from "./services/fetcher";
import { generateDigest } from "./services/summarizer";

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

app.post("/api/generate", async (c) => {
  if (!isAuthorized(c.req.header("Authorization") ?? "", c.env.ADMIN_KEY)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return generateDailyDigest(c.env);
});

app.post("/api/rebuild/:date", async (c) => {
  if (!isAuthorized(c.req.header("Authorization") ?? "", c.env.ADMIN_KEY)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const date = c.req.param("date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "Invalid date format, use YYYY-MM-DD" }, 400);
  }
  // RSS feeds only contain recent items — rebuilding older digests would use today's feed data
  const msAgo = Date.now() - new Date(date + "T00:00:00Z").getTime();
  if (msAgo > 48 * 60 * 60 * 1000) {
    return c.json({ error: "Can only rebuild digests from the last 48 hours" }, 400);
  }
  return rebuildDigest(c.env, date);
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
    return new Response("No items fetched", { status: 500 });
  }

  // Generate digest with AI (Gemini primary, Claude fallback)
  console.log("Generating digest...");
  const digestItems = await generateDigest(
    rawItems,
    { gemini: env.GEMINI_API_KEY, anthropic: env.ANTHROPIC_API_KEY },
    digestId
  );
  console.log(`Generated ${digestItems.length} digest items`);

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
        item.whyItMatters,
        item.sourceName,
        item.sourceUrl,
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
