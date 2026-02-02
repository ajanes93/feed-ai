import { describe, it, expect, beforeEach } from "vitest";
import { env, fetchMock } from "cloudflare:test";
import { app } from "../index";
import { sources } from "../sources";
import { seedDigest, seedRawItems } from "./helpers";

/**
 * Build a minimal RSS feed with one recent item for a given source.
 */
function rssFor(sourceId: string) {
  const now = new Date().toUTCString();
  return `<?xml version="1.0"?>
<rss version="2.0"><channel><title>${sourceId}</title>
<item>
  <title>${sourceId} headline</title>
  <link>https://example.com/${sourceId}</link>
  <description>Content for ${sourceId}</description>
  <pubDate>${now}</pubDate>
</item>
</channel></rss>`;
}

function jobicyJson() {
  return JSON.stringify({
    jobs: [
      {
        id: 1,
        jobTitle: "Vue Dev Role",
        url: "https://jobicy.com/vue-dev",
        jobDescription: "A great role",
        pubDate: new Date().toISOString(),
      },
    ],
  });
}

function blueskyResolveResponse() {
  return JSON.stringify({ did: "did:plc:test123" });
}

function blueskyFeedResponse(sourceId: string) {
  return JSON.stringify({
    feed: [
      {
        post: {
          uri: `at://did:plc:test123/app.bsky.feed.post/abc`,
          record: {
            text: `${sourceId} post content`,
            createdAt: new Date().toISOString(),
          },
        },
      },
    ],
  });
}

function jinaMarkdown(sourceId: string) {
  return `[${sourceId} Article](https://every.to/source-code/${sourceId}-article)`;
}

function hnHiringSearchResponse() {
  return JSON.stringify({ hits: [{ objectID: "99999" }] });
}

function hnHiringItemResponse() {
  return JSON.stringify({
    children: [
      {
        id: 10001,
        text: "TestCo | Frontend Vue Developer | Remote",
        created_at: new Date().toISOString(),
      },
    ],
  });
}

/**
 * Mock every source URL to return valid feed data.
 * Groups sources by origin and registers intercepts for each path.
 * Handles special source types (bluesky, scrape, hn-hiring).
 */
function mockAllSources() {
  const byOrigin = new Map<
    string,
    { path: string; source: (typeof sources)[number] }[]
  >();

  // Collect origins for bluesky/scrape/hn-hiring mocks
  const blueskyHandles: string[] = [];
  let hasScrape = false;
  let hasHnHiring = false;

  for (const source of sources) {
    if (source.type === "bluesky") {
      blueskyHandles.push(source.url);
      continue;
    }
    if (source.type === "scrape") {
      hasScrape = true;
      continue;
    }
    if (source.id === "hn-hiring") {
      hasHnHiring = true;
      continue;
    }

    const url = new URL(source.url);
    const origin = url.origin;
    const path = url.pathname + url.search;
    const group = byOrigin.get(origin) || [];
    group.push({ path, source });
    byOrigin.set(origin, group);
  }

  // Mock standard RSS/API sources
  for (const [origin, entries] of byOrigin) {
    const mock = fetchMock.get(origin);
    for (const { path, source } of entries) {
      const body = source.type === "api" ? jobicyJson() : rssFor(source.id);
      const headers =
        source.type === "api"
          ? { "content-type": "application/json" }
          : { "content-type": "application/xml" };
      mock.intercept({ method: "GET", path }).reply(200, body, { headers });
    }
  }

  // Mock Bluesky handle resolution + feeds
  if (blueskyHandles.length > 0) {
    const bskyMock = fetchMock.get("https://bsky.social");
    for (const handle of blueskyHandles) {
      bskyMock
        .intercept({
          method: "GET",
          path: `/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
        })
        .reply(200, blueskyResolveResponse(), {
          headers: { "content-type": "application/json" },
        });
    }

    const feedMock = fetchMock.get("https://public.api.bsky.app");
    for (const handle of blueskyHandles) {
      feedMock
        .intercept({
          method: "GET",
          path: /\/xrpc\/app\.bsky\.feed\.getAuthorFeed/,
        })
        .reply(200, blueskyFeedResponse(handle), {
          headers: { "content-type": "application/json" },
        });
    }
  }

  // Mock Jina scrape
  if (hasScrape) {
    const jinaMock = fetchMock.get("https://r.jina.ai");
    jinaMock
      .intercept({ method: "GET", path: /.*/ })
      .reply(200, jinaMarkdown("every-to"));
  }

  // Mock HN Who's Hiring
  if (hasHnHiring) {
    const algolia = fetchMock.get("https://hn.algolia.com");
    algolia
      .intercept({ method: "GET", path: /\/api\/v1\/search/ })
      .reply(200, hnHiringSearchResponse(), {
        headers: { "content-type": "application/json" },
      });
    algolia
      .intercept({ method: "GET", path: /\/api\/v1\/items/ })
      .reply(200, hnHiringItemResponse(), {
        headers: { "content-type": "application/json" },
      });
  }
}

/**
 * Mock the Gemini API to return a valid digest response.
 * Called twice per generate (news + jobs), so we need two intercepts.
 */
function mockGeminiForPipeline() {
  const mock = fetchMock.get("https://generativelanguage.googleapis.com");

  // News response — pick index 0 as "ai" and index 1 as "dev"
  const newsResponse = JSON.stringify([
    {
      item_index: 0,
      title: "Top AI Story",
      summary: "Important AI development",
      category: "ai",
      source_name: "Test",
    },
    {
      item_index: 1,
      title: "Top Dev Story",
      summary: "Important dev update",
      category: "dev",
      source_name: "Test",
    },
  ]);

  // Jobs response — pick index 0
  const jobsResponse = JSON.stringify([
    {
      item_index: 0,
      title: "Vue Dev Role — Acme",
      summary: "Remote Vue.js position",
      category: "jobs",
      source_name: "Jobicy",
    },
  ]);

  // First call = news, second call = jobs
  mock.intercept({ method: "POST", path: /.*/ }).reply(
    200,
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: newsResponse }] } }],
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 50,
        totalTokenCount: 150,
      },
    }),
    { headers: { "content-type": "application/json" } }
  );

  mock.intercept({ method: "POST", path: /.*/ }).reply(
    200,
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: jobsResponse }] } }],
      usageMetadata: {
        promptTokenCount: 80,
        candidatesTokenCount: 30,
        totalTokenCount: 110,
      },
    }),
    { headers: { "content-type": "application/json" } }
  );
}

const AUTH_HEADERS = { Authorization: "Bearer test-admin-key" };

describe("POST /api/generate (end-to-end)", () => {
  beforeEach(() => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  it("generates a full digest and saves to D1", async () => {
    mockAllSources();
    mockGeminiForPipeline();

    const res = await app.request(
      "/api/generate",
      { method: "POST", headers: AUTH_HEADERS },
      env
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Generated digest with");

    // Verify digest saved in D1
    const today = new Date().toISOString().split("T")[0];
    const digest = await env.DB.prepare("SELECT * FROM digests WHERE date = ?")
      .bind(today)
      .first();
    expect(digest).not.toBeNull();
    expect(digest!.item_count).toBeGreaterThan(0);

    // Verify items saved
    const items = await env.DB.prepare(
      "SELECT * FROM items WHERE digest_id = ? ORDER BY position"
    )
      .bind(digest!.id)
      .all();
    expect(items.results.length).toBe(digest!.item_count);

    // Verify items have correct structure
    const firstItem = items.results[0] as Record<string, unknown>;
    expect(firstItem.title).toBeTruthy();
    expect(firstItem.summary).toBeTruthy();
    expect(firstItem.category).toBeTruthy();
    expect(firstItem.position).toBe(0);

    // Verify source health was recorded
    const health = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM source_health"
    ).first();
    expect((health as Record<string, unknown>).count).toBeGreaterThan(0);

    // Verify AI usage was recorded
    const aiUsage = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM ai_usage"
    ).first();
    expect((aiUsage as Record<string, unknown>).count).toBeGreaterThan(0);
  });

  it("returns idempotent response when digest already exists", async () => {
    const today = new Date().toISOString().split("T")[0];
    await seedDigest(
      env.DB,
      { id: `digest-${today}`, date: today, itemCount: 1 },
      [
        {
          id: "existing-1",
          category: "ai",
          title: "Existing",
          summary: "Already here",
          sourceName: "Test",
          sourceUrl: "https://example.com",
          position: 0,
        },
      ]
    );

    const res = await app.request(
      "/api/generate",
      { method: "POST", headers: AUTH_HEADERS },
      env
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("already exists");
  });

  it("returns 500 when all sources fail", async () => {
    // Mock every source URL to return errors
    const byOrigin = new Map<string, string[]>();
    for (const source of sources) {
      if (source.type === "bluesky") continue;
      if (source.type === "scrape") continue;
      if (source.id === "hn-hiring") continue;
      const url = new URL(source.url);
      const paths = byOrigin.get(url.origin) || [];
      paths.push(url.pathname + url.search);
      byOrigin.set(url.origin, paths);
    }
    for (const [origin, paths] of byOrigin) {
      const mock = fetchMock.get(origin);
      for (const path of paths) {
        mock.intercept({ method: "GET", path }).reply(500, "Server Error");
      }
    }
    // Mock Bluesky to fail
    fetchMock
      .get("https://bsky.social")
      .intercept({ method: "GET", path: /.*/ })
      .reply(500, "Server Error")
      .persist();
    // Mock Jina to fail
    fetchMock
      .get("https://r.jina.ai")
      .intercept({ method: "GET", path: /.*/ })
      .reply(500, "Server Error");
    // Mock HN Algolia to fail
    fetchMock
      .get("https://hn.algolia.com")
      .intercept({ method: "GET", path: /.*/ })
      .reply(500, "Server Error");

    const res = await app.request(
      "/api/generate",
      { method: "POST", headers: AUTH_HEADERS },
      env
    );

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain("No items fetched");

    // Verify error was logged
    const logs = await env.DB.prepare(
      "SELECT * FROM error_logs WHERE category = 'fetch'"
    ).all();
    expect(logs.results.length).toBeGreaterThan(0);
  });
});

describe("POST /api/rebuild (end-to-end)", () => {
  beforeEach(() => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  it("deletes existing digest and regenerates", async () => {
    const today = new Date().toISOString().split("T")[0];

    // Seed an existing digest
    await seedDigest(
      env.DB,
      { id: `digest-${today}`, date: today, itemCount: 1 },
      [
        {
          id: "old-item",
          category: "ai",
          title: "Old Item",
          summary: "Will be replaced",
          sourceName: "Test",
          sourceUrl: "https://example.com/old",
          position: 0,
        },
      ]
    );

    mockAllSources();
    mockGeminiForPipeline();

    const res = await app.request(
      "/api/rebuild",
      { method: "POST", headers: AUTH_HEADERS },
      env
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Generated digest with");

    // Old item should be gone
    const oldItem = await env.DB.prepare(
      "SELECT * FROM items WHERE id = 'old-item'"
    ).first();
    expect(oldItem).toBeNull();

    // New digest should exist
    const digest = await env.DB.prepare("SELECT * FROM digests WHERE date = ?")
      .bind(today)
      .first();
    expect(digest).not.toBeNull();
    expect(digest!.item_count).toBeGreaterThan(0);
  });
});

describe("Raw items accumulation", () => {
  beforeEach(() => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  it("generate stores fetched articles in raw_items table", async () => {
    mockAllSources();
    mockGeminiForPipeline();

    const res = await app.request(
      "/api/generate",
      { method: "POST", headers: AUTH_HEADERS },
      env
    );

    expect(res.status).toBe(200);

    // Verify raw_items were stored
    const today = new Date().toISOString().split("T")[0];
    const rawItems = await env.DB.prepare(
      "SELECT * FROM raw_items WHERE date = ?"
    )
      .bind(today)
      .all();
    expect(rawItems.results.length).toBeGreaterThan(0);

    // Each raw item should have required fields
    const first = rawItems.results[0] as Record<string, unknown>;
    expect(first.source_id).toBeTruthy();
    expect(first.link).toBeTruthy();
    expect(first.date).toBe(today);
  });

  it("rebuild includes previously accumulated raw_items", async () => {
    const today = new Date().toISOString().split("T")[0];

    // Pre-seed raw_items from an earlier fetch (simulating 6am cron)
    await seedRawItems(env.DB, [
      {
        sourceId: "anthropic-news",
        title: "Early Morning Article",
        link: "https://example.com/early-morning",
        content: "Fetched at 6am",
        date: today,
      },
    ]);

    // Seed an existing digest to rebuild
    await seedDigest(
      env.DB,
      { id: `digest-${today}`, date: today, itemCount: 1 },
      [
        {
          id: "old-item",
          category: "ai",
          title: "Old Item",
          summary: "Will be replaced",
          sourceName: "Test",
          sourceUrl: "https://example.com/old",
          position: 0,
        },
      ]
    );

    mockAllSources();
    mockGeminiForPipeline();

    const res = await app.request(
      "/api/rebuild",
      { method: "POST", headers: AUTH_HEADERS },
      env
    );

    expect(res.status).toBe(200);

    // Verify the early morning article is still in raw_items (not deleted by rebuild)
    const rawItems = await env.DB.prepare(
      "SELECT * FROM raw_items WHERE link = ?"
    )
      .bind("https://example.com/early-morning")
      .first();
    expect(rawItems).not.toBeNull();
  });

  it("raw_items deduplicates by source_id + link", async () => {
    const today = new Date().toISOString().split("T")[0];

    // Seed same article twice
    await seedRawItems(env.DB, [
      {
        sourceId: "anthropic-news",
        title: "Same Article",
        link: "https://example.com/same",
        date: today,
      },
    ]);

    // Insert again — should be ignored due to unique constraint
    await env.DB.prepare(
      "INSERT OR IGNORE INTO raw_items (id, source_id, title, link, date) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(
        crypto.randomUUID(),
        "anthropic-news",
        "Same Article Updated",
        "https://example.com/same",
        today
      )
      .run();

    const count = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM raw_items WHERE link = ?"
    )
      .bind("https://example.com/same")
      .first();
    expect((count as Record<string, unknown>).count).toBe(1);
  });

  it("includes yesterday's raw_items in digest generation", async () => {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split("T")[0];

    // Seed a raw item from yesterday's late fetch
    await seedRawItems(env.DB, [
      {
        sourceId: "anthropic-news",
        title: "Late Yesterday Article",
        link: "https://example.com/yesterday-late",
        content: "Fetched yesterday at 6pm",
        date: yesterday,
      },
    ]);

    mockAllSources();
    mockGeminiForPipeline();

    const res = await app.request(
      "/api/generate",
      { method: "POST", headers: AUTH_HEADERS },
      env
    );

    expect(res.status).toBe(200);

    // Verify merge log shows stored items were included
    const logs = await env.DB.prepare(
      "SELECT * FROM error_logs WHERE message LIKE '%Merged items%' AND digest_id = ?"
    )
      .bind(`digest-${today}`)
      .all();
    expect(logs.results.length).toBe(1);
    // The stored count should include the yesterday item
    expect(logs.results[0].message as string).toContain("stored");
  });
});
