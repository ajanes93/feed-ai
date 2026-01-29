import { Hono } from "hono";
import { cors } from "hono/cors";
import { Env } from "./types";
import { sources } from "./sources";
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
    items: items.results.map((row) => ({
      id: row.id,
      category: row.category,
      title: row.title,
      summary: row.summary,
      whyItMatters: row.why_it_matters,
      sourceName: row.source_name,
      sourceUrl: row.source_url,
      position: row.position,
    })),
  });
});

// List available dates
app.get("/api/digests", async (c) => {
  const result = await c.env.DB.prepare(
    "SELECT date, item_count FROM digests ORDER BY date DESC LIMIT 30"
  ).all();

  return c.json(result.results);
});

// Manual trigger (for testing)
app.post("/api/generate", async (c) => {
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
  const rawItems = await fetchAllSources(sources);
  console.log(`Fetched ${rawItems.length} items`);

  if (rawItems.length === 0) {
    return new Response("No items fetched", { status: 500 });
  }

  // Generate digest with Claude
  console.log("Generating digest...");
  const digestItems = await generateDigest(
    rawItems,
    env.ANTHROPIC_API_KEY,
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
        "INSERT INTO items (id, digest_id, category, title, summary, why_it_matters, source_name, source_url, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        item.id,
        item.digestId,
        item.category,
        item.title,
        item.summary,
        item.whyItMatters,
        item.sourceName,
        item.sourceUrl,
        item.position
      )
    ),
  ];

  await env.DB.batch(statements);

  return new Response(`Generated digest with ${digestItems.length} items`, {
    status: 200,
  });
}

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(generateDailyDigest(env));
  },
};
