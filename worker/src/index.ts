import { Hono } from "hono";
import { cors } from "hono/cors";
import { Env } from "./types";
import { sources, FRESHNESS_THRESHOLDS } from "./sources";
import type { SourceFetchResult } from "./services/fetcher";
import { fetchAllSources } from "./services/fetcher";
import { generateDigest } from "./services/summarizer";

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

interface DbItem {
  id: string;
  category: string;
  title: string;
  summary: string;
  why_it_matters: string | null;
  source_name: string;
  source_url: string;
  published_at: string | null;
  position: number;
}

function mapItemFromDb(row: DbItem) {
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

// Get digest by date
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
    items: items.results.map((row) => mapItemFromDb(row as unknown as DbItem)),
  });
});

// List available dates
app.get("/api/digests", async (c) => {
  const result = await c.env.DB.prepare(
    "SELECT date, item_count FROM digests ORDER BY date DESC LIMIT 30"
  ).all();

  return c.json(result.results);
});

// Source health (protected)
app.get("/api/health", async (c) => {
  if (!c.env.ADMIN_KEY) {
    return c.json({ error: "ADMIN_KEY not configured" }, 500);
  }
  const authHeader = c.req.header("Authorization");
  if (authHeader !== `Bearer ${c.env.ADMIN_KEY}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const result = await c.env.DB.prepare(
    "SELECT * FROM source_health ORDER BY last_success_at ASC"
  ).all();

  const now = Math.floor(Date.now() / 1000);
  const healthData = result.results.map((row) => {
    const source = sources.find((s) => s.id === row.source_id);
    const thresholdDays = source
      ? FRESHNESS_THRESHOLDS[source.category]
      : 14;
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

// Manual trigger (protected)
app.post("/api/generate", async (c) => {
  if (!c.env.ADMIN_KEY) {
    return c.json({ error: "ADMIN_KEY not configured" }, 500);
  }
  const authHeader = c.req.header("Authorization");
  if (authHeader !== `Bearer ${c.env.ADMIN_KEY}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return generateDailyDigest(c.env);
});

// Cron handler
async function generateDailyDigest(env: Env): Promise<Response> {
  const today = new Date().toISOString().split("T")[0];
  const digestId = `digest-${today}`;

  // Check if already generated
  const existing = await env.DB.prepare("SELECT id FROM digests WHERE date = ?")
    .bind(today)
    .first();

  if (existing) {
    return new Response(`Digest already exists for ${today}`, { status: 200 });
  }

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
    ).bind(digestId, today, digestItems.length),
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
