import { describe, it, expect, beforeEach } from "vitest";
import { env, fetchMock } from "cloudflare:test";
import { app, fetchAndStoreArticles } from "../index";
import { sources } from "../sources";
import { seedDigest, seedRawItems } from "./helpers";
import worker from "../index";

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

/**
 * Generate Jina Reader markdown output format for scrape sources
 */
function jinaMarkdown(sourceId: string, baseUrl: string) {
  return `Title: ${sourceId}

URL Source: ${baseUrl}

Markdown Content:
### [${sourceId} Article](${baseUrl}/article/${sourceId}-1)
### [${sourceId} News](${baseUrl}/news/${sourceId}-2)
`;
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

    fetchMock
      .get("https://public.api.bsky.app")
      .intercept({
        method: "GET",
        path: /\/xrpc\/app\.bsky\.feed\.getAuthorFeed/,
      })
      .reply(200, blueskyFeedResponse("test"), {
        headers: { "content-type": "application/json" },
      })
      .persist();
  }

  // Mock scrape sources via Jina Reader
  if (hasScrape) {
    const jinaMock = fetchMock.get("https://r.jina.ai");
    jinaMock
      .intercept({ method: "GET", path: "/https://every.to/newsletter" })
      .reply(200, jinaMarkdown("every-to", "https://every.to"));
    jinaMock
      .intercept({ method: "GET", path: "/https://www.weareimps.com/news" })
      .reply(200, jinaMarkdown("weareimps", "https://www.weareimps.com"));
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
    const today = new Date().toISOString().split("T")[0];

    // Seed raw_items (simulating earlier fetch crons)
    await seedRawItems(env.DB, [
      {
        sourceId: "anthropic-news",
        title: "AI Breakthrough",
        link: "https://example.com/ai-news",
        content: "Major AI development",
        date: today,
      },
      {
        sourceId: "vue-blog",
        title: "Vue 4 Released",
        link: "https://example.com/vue-4",
        content: "New Vue release",
        date: today,
      },
      {
        sourceId: "vuejobs",
        title: "Vue Dev Role",
        link: "https://example.com/vue-job",
        content: "Remote Vue.js position",
        date: today,
      },
    ]);

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
    // Mock Jina Reader (scrape sources) to fail
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

describe("POST /api/fetch (end-to-end)", () => {
  beforeEach(() => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  it("fetches all sources and returns health summary", async () => {
    mockAllSources();

    const res = await app.request(
      "/api/fetch",
      { method: "POST", headers: AUTH_HEADERS },
      env
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      totalItems: number;
      sourcesOk: number;
      sourcesTotal: number;
      zeroItems: { sourceId: string }[];
      errors: { sourceId: string; error: string }[];
    };

    expect(body.sourcesTotal).toBe(sources.length);
    expect(body.sourcesOk).toBe(sources.length);
    expect(body.totalItems).toBeGreaterThan(0);
    expect(body.errors).toHaveLength(0);

    // Verify source health was recorded in DB
    const health = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM source_health"
    ).first();
    expect((health as Record<string, unknown>).count).toBeGreaterThan(0);
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

    // Seed raw_items for rebuild to use
    await seedRawItems(env.DB, [
      {
        sourceId: "anthropic-news",
        title: "Fresh AI Article",
        link: "https://example.com/fresh-ai",
        content: "New content",
        date: today,
      },
      {
        sourceId: "vuejobs",
        title: "Vue Dev Role",
        link: "https://example.com/vue-job",
        content: "Remote Vue.js position",
        date: today,
      },
    ]);

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

  it("fetch endpoint stores articles in raw_items table", async () => {
    mockAllSources();

    const res = await app.request(
      "/api/fetch",
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

    // Verify log shows accumulated items were loaded (includes yesterday's item)
    const logs = await env.DB.prepare(
      "SELECT * FROM error_logs WHERE message LIKE '%accumulated items%' AND digest_id = ?"
    )
      .bind(`digest-${today}`)
      .all();
    expect(logs.results.length).toBe(1);
    expect(logs.results[0].message as string).toContain("accumulated");
  });
});

describe("fetchAndStoreArticles (fetch-only cron)", () => {
  beforeEach(() => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  it("stores fetched articles without generating a digest", async () => {
    mockAllSources();

    const res = await fetchAndStoreArticles(env);

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Stored");

    // Verify raw_items were stored
    const today = new Date().toISOString().split("T")[0];
    const rawItems = await env.DB.prepare(
      "SELECT * FROM raw_items WHERE date = ?"
    )
      .bind(today)
      .all();
    expect(rawItems.results.length).toBeGreaterThan(0);

    // Verify NO digest was created (fetch-only mode)
    const digest = await env.DB.prepare("SELECT * FROM digests WHERE date = ?")
      .bind(today)
      .first();
    expect(digest).toBeNull();

    // Verify source health was recorded
    const health = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM source_health"
    ).first();
    expect((health as Record<string, unknown>).count).toBeGreaterThan(0);
  });

  it("logs duration and source breakdown", async () => {
    mockAllSources();

    await fetchAndStoreArticles(env);

    // Check completion log includes duration
    const logs = await env.DB.prepare(
      "SELECT * FROM error_logs WHERE message LIKE '%Fetch-and-store complete%'"
    ).all();
    expect(logs.results.length).toBe(1);
    expect(logs.results[0].message as string).toContain("items stored");
  });

  it("records source health for all sources", async () => {
    mockAllSources();

    await fetchAndStoreArticles(env);

    const health = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM source_health"
    ).first();
    expect((health as Record<string, unknown>).count).toBeGreaterThan(0);
  });
});

describe("storeRawItems edge cases", () => {
  it("truncates content to 500 characters", async () => {
    mockAllSources();
    mockGeminiForPipeline();

    // Generate digest which stores raw items with content
    await app.request(
      "/api/generate",
      { method: "POST", headers: AUTH_HEADERS },
      env
    );

    // Check all stored content is <= 500 chars
    const rawItems = await env.DB.prepare(
      "SELECT content FROM raw_items WHERE content IS NOT NULL"
    ).all();

    for (const row of rawItems.results) {
      expect((row.content as string).length).toBeLessThanOrEqual(500);
    }
  });
});

describe("Cron scheduled dispatch", () => {
  beforeEach(() => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  it("logs cron trigger with fetch-only at 6am", async () => {
    mockAllSources();

    const event = {
      scheduledTime: new Date("2025-01-28T06:00:00Z").getTime(),
      cron: "0 6 * * *",
    };
    const waitUntilPromises: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => {
        waitUntilPromises.push(p);
      },
      passThroughOnException: () => {},
    } as unknown as ExecutionContext;

    worker.scheduled(event as ScheduledEvent, env, ctx);
    await Promise.all(waitUntilPromises);

    const logs = await env.DB.prepare(
      "SELECT * FROM error_logs WHERE message LIKE '%Cron triggered%'"
    ).all();
    expect(logs.results.length).toBe(1);
    expect(logs.results[0].message as string).toContain("6:00 UTC");
    expect(logs.results[0].message as string).toContain("fetch ai");
  });

  it("dispatches summarize at 18:00 UTC", async () => {
    const today = new Date().toISOString().split("T")[0];
    await seedRawItems(env.DB, [
      {
        sourceId: "anthropic-news",
        title: "Cron AI Article",
        link: "https://example.com/cron-ai",
        content: "Content",
        date: today,
      },
      {
        sourceId: "vuejobs",
        title: "Cron Job Listing",
        link: "https://example.com/cron-job",
        content: "Job content",
        date: today,
      },
    ]);

    mockGeminiForPipeline();

    const event = {
      scheduledTime: new Date("2025-01-28T18:00:00Z").getTime(),
      cron: "0 18 * * *",
    };
    const waitUntilPromises: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => {
        waitUntilPromises.push(p);
      },
      passThroughOnException: () => {},
    } as unknown as ExecutionContext;

    worker.scheduled(event as ScheduledEvent, env, ctx);
    await Promise.all(waitUntilPromises);

    const logs = await env.DB.prepare(
      "SELECT * FROM error_logs WHERE message LIKE '%Cron triggered%'"
    ).all();
    expect(logs.results.length).toBe(1);
    expect(logs.results[0].message as string).toContain("18:00 UTC");
    expect(logs.results[0].message as string).toContain("summarize");

    // Verify a digest was created via incremental summarize
    const digest = await env.DB.prepare("SELECT * FROM digests WHERE date = ?")
      .bind(today)
      .first();
    expect(digest).not.toBeNull();
  });
});

describe("POST /api/enrich-comments", () => {
  const today = new Date().toISOString().split("T")[0];
  const digestId = `digest-${today}`;

  beforeEach(() => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  it("enriches Reddit/HN items and updates DB", async () => {
    // Seed a digest with one Reddit item and one HN item (unenriched)
    await seedDigest(env.DB, { id: digestId, date: today, itemCount: 3 }, [
      {
        id: `${digestId}-0`,
        category: "ai",
        title: "Cool AI Post",
        summary: "Summary",
        sourceName: "r/LocalLLaMA",
        sourceUrl:
          "https://www.reddit.com/r/LocalLLaMA/comments/abc/cool_ai_post",
        position: 0,
      },
      {
        id: `${digestId}-1`,
        category: "dev",
        title: "HN Frontend Story",
        summary: "Summary",
        sourceName: "Hacker News Frontend",
        sourceUrl: "https://example.com/hn-story",
        commentsUrl: "https://news.ycombinator.com/item?id=12345",
        position: 1,
      },
      {
        id: `${digestId}-2`,
        category: "dev",
        title: "Regular Article",
        summary: "Not Reddit or HN",
        sourceName: "Vue.js Blog",
        sourceUrl: "https://blog.vuejs.org/article",
        position: 2,
      },
    ]);

    // Mock Reddit API — return comments above threshold
    const redditMock = fetchMock.get("https://www.reddit.com");
    redditMock.intercept({ method: "GET", path: /.*\.json/ }).reply(
      200,
      JSON.stringify([
        { data: { children: [{ data: { score: 200, num_comments: 50 } }] } },
        {
          data: {
            children: Array.from({ length: 10 }, (_, i) => ({
              data: { body: `Comment ${i + 1} about AI`, score: 10 },
            })),
          },
        },
      ]),
      { headers: { "content-type": "application/json" } }
    );

    // Mock HN Algolia search — find the HN story
    const hnMock = fetchMock.get("https://hn.algolia.com");
    hnMock.intercept({ method: "GET", path: /\/api\/v1\/search/ }).reply(
      200,
      JSON.stringify({
        hits: [{ objectID: "12345", points: 100, num_comments: 30 }],
      }),
      { headers: { "content-type": "application/json" } }
    );

    // Mock HN Firebase — get comment IDs and texts
    // .persist() because direct URL path skips Algolia but still fetches this item
    const firebaseMock = fetchMock.get("https://hacker-news.firebaseio.com");
    firebaseMock
      .intercept({ method: "GET", path: "/v0/item/12345.json" })
      .reply(
        200,
        JSON.stringify({
          id: 12345,
          kids: [100, 101, 102],
          descendants: 30,
          score: 100,
        }),
        { headers: { "content-type": "application/json" } }
      )
      .persist();
    for (const id of [100, 101, 102]) {
      firebaseMock
        .intercept({ method: "GET", path: `/v0/item/${id}.json` })
        .reply(
          200,
          JSON.stringify({ id, text: `HN comment ${id} about frontend` }),
          { headers: { "content-type": "application/json" } }
        );
    }

    // Mock Gemini for comment summarization (called twice — Reddit + HN)
    const geminiMock = fetchMock.get(
      "https://generativelanguage.googleapis.com"
    );
    geminiMock
      .intercept({ method: "POST", path: /.*/ })
      .reply(
        200,
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: "Community discusses AI breakthroughs." }],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 50,
            candidatesTokenCount: 20,
            totalTokenCount: 70,
          },
        }),
        { headers: { "content-type": "application/json" } }
      )
      .persist();

    const res = await app.request(
      "/api/enrich-comments",
      { method: "POST", headers: AUTH_HEADERS },
      env
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalEnriched).toBeGreaterThanOrEqual(1);

    // Verify at least one item was enriched in DB
    const enrichedItems = await env.DB.prepare(
      "SELECT * FROM items WHERE digest_id = ? AND comment_summary IS NOT NULL"
    )
      .bind(digestId)
      .all();
    expect(enrichedItems.results.length).toBeGreaterThanOrEqual(1);

    // Verify the regular article was NOT touched
    const regularItem = await env.DB.prepare("SELECT * FROM items WHERE id = ?")
      .bind(`${digestId}-2`)
      .first();
    expect(regularItem!.comment_summary).toBeNull();
    expect(regularItem!.comment_summary_source).toBeNull();
  });

  it("returns zero enriched when no eligible items exist", async () => {
    await seedDigest(env.DB, { id: digestId, date: today, itemCount: 1 }, [
      {
        id: `${digestId}-0`,
        category: "dev",
        title: "Vue Blog Post",
        summary: "No comments source",
        sourceName: "Vue.js Blog",
        sourceUrl: "https://blog.vuejs.org/article",
        position: 0,
      },
    ]);

    const res = await app.request(
      "/api/enrich-comments",
      { method: "POST", headers: AUTH_HEADERS },
      env
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalEnriched).toBe(0);
  });

  it("marks items as skipped when below threshold", async () => {
    await seedDigest(env.DB, { id: digestId, date: today, itemCount: 1 }, [
      {
        id: `${digestId}-0`,
        category: "ai",
        title: "Low Score Post",
        summary: "Summary",
        sourceName: "r/LocalLLaMA",
        sourceUrl: "https://www.reddit.com/r/LocalLLaMA/comments/xyz/low_post",
        position: 0,
      },
    ]);

    // Mock Reddit — below threshold (score=5, comments=2)
    const redditMock = fetchMock.get("https://www.reddit.com");
    redditMock
      .intercept({ method: "GET", path: /.*\.json/ })
      .reply(
        200,
        JSON.stringify([
          { data: { children: [{ data: { score: 5, num_comments: 2 } }] } },
          { data: { children: [] } },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const res = await app.request(
      "/api/enrich-comments",
      { method: "POST", headers: AUTH_HEADERS },
      env
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalEnriched).toBe(0);
    expect(body.totalSkipped).toBe(1);

    // Verify item was marked as skipped
    const item = await env.DB.prepare("SELECT * FROM items WHERE id = ?")
      .bind(`${digestId}-0`)
      .first();
    expect(item!.comment_summary).toBeNull();
    expect(item!.comment_summary_source).toBe("skipped");
  });

  it("requires authentication", async () => {
    const res = await app.request(
      "/api/enrich-comments",
      { method: "POST" },
      env
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/summarize (incremental)", () => {
  const today = new Date().toISOString().split("T")[0];

  beforeEach(() => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  it("creates a new digest from unsummarized items", async () => {
    await seedRawItems(env.DB, [
      {
        sourceId: "anthropic-news",
        title: "Fresh AI Story",
        link: "https://example.com/fresh-ai",
        content: "Big AI news",
        date: today,
      },
      {
        sourceId: "vue-blog",
        title: "Vue Update",
        link: "https://example.com/vue-update",
        content: "Vue news",
        date: today,
      },
    ]);

    mockGeminiForPipeline();

    const res = await app.request(
      "/api/summarize",
      { method: "POST", headers: AUTH_HEADERS },
      env
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("created");

    // Verify digest was created
    const digest = await env.DB.prepare("SELECT * FROM digests WHERE date = ?")
      .bind(today)
      .first();
    expect(digest).not.toBeNull();
    expect(digest!.item_count).toBeGreaterThan(0);

    // Verify items were marked as summarized
    const unsummarized = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM raw_items WHERE date = ? AND summarized_at IS NULL"
    )
      .bind(today)
      .first();
    expect((unsummarized as Record<string, unknown>).count).toBe(0);
  });

  it("appends to existing digest on subsequent calls", async () => {
    // Create an existing digest with one item
    await seedDigest(
      env.DB,
      { id: `digest-${today}`, date: today, itemCount: 1 },
      [
        {
          id: `digest-${today}-0`,
          category: "ai",
          title: "Earlier Item",
          summary: "From morning summarize",
          sourceName: "Test",
          sourceUrl: "https://example.com/earlier",
          position: 0,
        },
      ]
    );

    // Seed new unsummarized items (from a later fetch)
    await seedRawItems(env.DB, [
      {
        sourceId: "anthropic-news",
        title: "Afternoon AI Story",
        link: "https://example.com/afternoon-ai",
        content: "Afternoon content",
        date: today,
      },
    ]);

    mockGeminiForPipeline();

    const res = await app.request(
      "/api/summarize",
      { method: "POST", headers: AUTH_HEADERS },
      env
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("appended");

    // Verify digest item_count increased
    const digest = await env.DB.prepare("SELECT * FROM digests WHERE date = ?")
      .bind(today)
      .first();
    expect(digest!.item_count).toBeGreaterThan(1);

    // Verify original item still exists
    const original = await env.DB.prepare("SELECT * FROM items WHERE id = ?")
      .bind(`digest-${today}-0`)
      .first();
    expect(original).not.toBeNull();
    expect(original!.title).toBe("Earlier Item");

    // Verify new items have higher positions
    const allItems = await env.DB.prepare(
      "SELECT * FROM items WHERE digest_id = ? ORDER BY position"
    )
      .bind(`digest-${today}`)
      .all();
    expect(allItems.results.length).toBe(digest!.item_count);
    // New items should start at position 1
    const newItems = allItems.results.filter(
      (i) => i.id !== `digest-${today}-0`
    );
    for (const item of newItems) {
      expect(item.position as number).toBeGreaterThanOrEqual(1);
    }
  });

  it("returns early when no unsummarized items exist", async () => {
    const res = await app.request(
      "/api/summarize",
      { method: "POST", headers: AUTH_HEADERS },
      env
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("No new items");
  });

  it("handles all-duplicate items gracefully", async () => {
    // Create existing digest with an item
    await seedDigest(
      env.DB,
      { id: `digest-${today}`, date: today, itemCount: 1 },
      [
        {
          id: `digest-${today}-0`,
          category: "ai",
          title: "Existing Article",
          summary: "Already in digest",
          sourceName: "Test",
          sourceUrl: "https://example.com/existing",
          position: 0,
        },
      ]
    );

    // Seed unsummarized item with same URL as existing digest item
    await seedRawItems(env.DB, [
      {
        sourceId: "anthropic-news",
        title: "Existing Article",
        link: "https://example.com/existing",
        content: "Same content",
        date: today,
      },
    ]);

    const res = await app.request(
      "/api/summarize",
      { method: "POST", headers: AUTH_HEADERS },
      env
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("duplicates");

    // Items should still be marked as summarized (not retried)
    const unsummarized = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM raw_items WHERE date = ? AND summarized_at IS NULL"
    )
      .bind(today)
      .first();
    expect((unsummarized as Record<string, unknown>).count).toBe(0);
  });

  it("requires authentication", async () => {
    const res = await app.request("/api/summarize", { method: "POST" }, env);
    expect(res.status).toBe(401);
  });
});

describe("Cron dispatch: summarize and enrich times", () => {
  beforeEach(() => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  it("dispatches summarize at 7:00 UTC", async () => {
    const today = new Date().toISOString().split("T")[0];
    await seedRawItems(env.DB, [
      {
        sourceId: "anthropic-news",
        title: "Morning Article",
        link: "https://example.com/morning",
        content: "Content",
        date: today,
      },
    ]);

    mockGeminiForPipeline();

    const event = {
      scheduledTime: new Date("2025-01-28T07:00:00Z").getTime(),
      cron: "0 7 * * *",
    };
    const waitUntilPromises: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => {
        waitUntilPromises.push(p);
      },
      passThroughOnException: () => {},
    } as unknown as ExecutionContext;

    worker.scheduled(event as ScheduledEvent, env, ctx);
    await Promise.all(waitUntilPromises);

    const logs = await env.DB.prepare(
      "SELECT * FROM error_logs WHERE message LIKE '%Cron triggered%'"
    ).all();
    expect(logs.results.length).toBe(1);
    expect(logs.results[0].message as string).toContain("7:00 UTC");
    expect(logs.results[0].message as string).toContain("summarize");
  });

  it("dispatches fetch at 17:00 UTC (AI category)", async () => {
    mockAllSources();

    const event = {
      scheduledTime: new Date("2025-01-28T17:00:00Z").getTime(),
      cron: "0 17 * * *",
    };
    const waitUntilPromises: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => {
        waitUntilPromises.push(p);
      },
      passThroughOnException: () => {},
    } as unknown as ExecutionContext;

    worker.scheduled(event as ScheduledEvent, env, ctx);
    await Promise.all(waitUntilPromises);

    const logs = await env.DB.prepare(
      "SELECT * FROM error_logs WHERE message LIKE '%Cron triggered%'"
    ).all();
    expect(logs.results.length).toBe(1);
    expect(logs.results[0].message as string).toContain("17:00 UTC");
    expect(logs.results[0].message as string).toContain("fetch ai");
  });

  it("dispatches summarize + enrich at 7:00 UTC", async () => {
    const today = new Date().toISOString().split("T")[0];
    // Seed an empty digest so enrichment has something to look at (but no eligible items)
    await seedDigest(
      env.DB,
      { id: `digest-${today}`, date: today, itemCount: 0 },
      []
    );

    const event = {
      scheduledTime: new Date("2025-01-28T07:00:00Z").getTime(),
      cron: "0 7 * * *",
    };
    const waitUntilPromises: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => {
        waitUntilPromises.push(p);
      },
      passThroughOnException: () => {},
    } as unknown as ExecutionContext;

    worker.scheduled(event as ScheduledEvent, env, ctx);
    await Promise.all(waitUntilPromises);

    const logs = await env.DB.prepare(
      "SELECT * FROM error_logs WHERE message LIKE '%Cron triggered%'"
    ).all();
    expect(logs.results.length).toBe(1);
    expect(logs.results[0].message as string).toContain("7:00 UTC");
    expect(logs.results[0].message as string).toContain("summarize + enrich");
  });

  it("dispatches summarize + enrich at 13:00 UTC", async () => {
    const today = new Date().toISOString().split("T")[0];
    await seedDigest(
      env.DB,
      { id: `digest-${today}`, date: today, itemCount: 0 },
      []
    );

    const event = {
      scheduledTime: new Date("2025-01-28T13:00:00Z").getTime(),
      cron: "0 13 * * *",
    };
    const waitUntilPromises: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => {
        waitUntilPromises.push(p);
      },
      passThroughOnException: () => {},
    } as unknown as ExecutionContext;

    worker.scheduled(event as ScheduledEvent, env, ctx);
    await Promise.all(waitUntilPromises);

    const logs = await env.DB.prepare(
      "SELECT * FROM error_logs WHERE message LIKE '%Cron triggered%'"
    ).all();
    expect(logs.results.length).toBe(1);
    expect(logs.results[0].message as string).toContain("13:00 UTC");
    expect(logs.results[0].message as string).toContain("summarize + enrich");
  });
});
