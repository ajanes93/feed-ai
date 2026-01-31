import { describe, it, expect, beforeEach } from "vitest";
import { env, fetchMock } from "cloudflare:test";
import { app } from "../index";
import { sources } from "../sources";
import { seedDigest } from "./helpers";

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

/**
 * Mock every source URL to return valid feed data.
 * Groups sources by origin and registers intercepts for each path.
 */
function mockAllSources() {
  const byOrigin = new Map<
    string,
    { path: string; source: (typeof sources)[number] }[]
  >();

  for (const source of sources) {
    const url = new URL(source.url);
    const origin = url.origin;
    const path = url.pathname + url.search;
    const group = byOrigin.get(origin) || [];
    group.push({ path, source });
    byOrigin.set(origin, group);
  }

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
    // Mock every source URL to return 500
    const byOrigin = new Map<string, string[]>();
    for (const source of sources) {
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
