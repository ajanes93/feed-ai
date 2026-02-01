import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { fetchMock } from "cloudflare:test";
import { fetchSource, fetchAllSources } from "../services/fetcher";
import { sourceFactory } from "./factories";
import {
  mockFetchResponse,
  RSS_FEED,
  ATOM_FEED,
  JOBICY_RESPONSE,
} from "./helpers";

const RSS_SOURCE = sourceFactory.build({
  id: "test-rss",
  name: "Test RSS",
  type: "rss",
  url: "https://example.com/feed.xml",
});

const API_SOURCE = sourceFactory.build({
  id: "test-api",
  name: "Test API",
  type: "api",
  url: "https://example.com/api/jobs",
  category: "jobs",
});

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

describe("fetchSource", () => {
  it("parses RSS feed items", async () => {
    mockFetchResponse("https://example.com", "/feed.xml", RSS_FEED);

    const items = await fetchSource(RSS_SOURCE);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Article One");
    expect(items[0].link).toBe("https://example.com/1");
    expect(items[0].sourceId).toBe("test-rss");
    expect(items[0].content).toBe("First & best article");
  });

  it("strips HTML from content", async () => {
    mockFetchResponse("https://example.com", "/feed.xml", RSS_FEED);

    const items = await fetchSource(RSS_SOURCE);

    expect(items[1].content).toBe("HTML content");
  });

  it("parses Atom feed items", async () => {
    mockFetchResponse("https://example.com", "/feed.xml", ATOM_FEED);

    const items = await fetchSource(RSS_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Atom Entry");
    expect(items[0].link).toBe("https://example.com/atom/1");
  });

  it("parses JSON API (Jobicy) responses", async () => {
    mockFetchResponse(
      "https://example.com",
      "/api/jobs",
      JOBICY_RESPONSE,
      200,
      {
        "content-type": "application/json",
      }
    );

    const items = await fetchSource(API_SOURCE);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Senior Vue Dev");
    expect(items[0].link).toBe("https://jobicy.com/1");
    expect(items[0].content).toBe("Great job");
    expect(items[0].sourceId).toBe("test-api");
  });

  it("returns empty array on HTTP error", async () => {
    mockFetchResponse("https://example.com", "/feed.xml", "Not found", 404);

    const items = await fetchSource(RSS_SOURCE);

    expect(items).toEqual([]);
  });

  it("returns empty array on network error", async () => {
    const mock = fetchMock.get("https://example.com");
    mock
      .intercept({ method: "GET", path: "/feed.xml" })
      .replyWithError(new Error("Network failure"));

    const items = await fetchSource(RSS_SOURCE);

    expect(items).toEqual([]);
  });

  it("handles empty RSS feed", async () => {
    const emptyFeed = `<?xml version="1.0"?><rss><channel><title>Empty</title></channel></rss>`;
    mockFetchResponse("https://example.com", "/feed.xml", emptyFeed);

    const items = await fetchSource(RSS_SOURCE);

    expect(items).toEqual([]);
  });

  it("handles single item feed (not wrapped in array)", async () => {
    const singleItem = `<?xml version="1.0"?><rss><channel>
      <item><title>Only One</title><link>https://example.com/only</link></item>
    </channel></rss>`;
    mockFetchResponse("https://example.com", "/feed.xml", singleItem);

    const items = await fetchSource(RSS_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Only One");
  });

  it("handles items with missing title", async () => {
    const feed = `<?xml version="1.0"?><rss><channel>
      <item><link>https://example.com/notitle</link><description>No title here</description></item>
    </channel></rss>`;
    mockFetchResponse("https://example.com", "/feed.xml", feed);

    const items = await fetchSource(RSS_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Untitled");
  });

  it("decodes HTML entities in content", async () => {
    const feed = `<?xml version="1.0"?><rss><channel>
      <item>
        <title>Entities</title>
        <link>https://example.com/ent</link>
        <description>Tom &amp; Jerry &lt;3 &quot;quotes&quot; &#39;apos&#39;</description>
      </item>
    </channel></rss>`;
    mockFetchResponse("https://example.com", "/feed.xml", feed);

    const items = await fetchSource(RSS_SOURCE);

    expect(items[0].content).toBe(`Tom & Jerry <3 "quotes" 'apos'`);
  });

  it("handles empty JSON API response", async () => {
    mockFetchResponse(
      "https://example.com",
      "/api/jobs",
      JSON.stringify({ jobs: [] }),
      200,
      { "content-type": "application/json" }
    );

    const items = await fetchSource(API_SOURCE);

    expect(items).toEqual([]);
  });

  it("handles JSON API with missing jobs field", async () => {
    mockFetchResponse(
      "https://example.com",
      "/api/jobs",
      JSON.stringify({}),
      200,
      { "content-type": "application/json" }
    );

    const items = await fetchSource(API_SOURCE);

    expect(items).toEqual([]);
  });

  it("limits items to 20", async () => {
    const manyItems = Array.from(
      { length: 30 },
      (_, i) =>
        `<item><title>Item ${i}</title><link>https://example.com/${i}</link></item>`
    ).join("");
    const feed = `<?xml version="1.0"?><rss><channel>${manyItems}</channel></rss>`;

    mockFetchResponse("https://example.com", "/feed.xml", feed);

    const items = await fetchSource(RSS_SOURCE);

    expect(items).toHaveLength(20);
  });
});

describe("fetchAllSources", () => {
  it("filters out items older than freshness threshold", async () => {
    const now = Date.now();
    const oldDate = new Date(now - 10 * 24 * 60 * 60 * 1000).toUTCString(); // 10 days old (dev threshold = 7 days)
    const newDate = new Date(now - 1 * 60 * 60 * 1000).toUTCString();

    const feed = `<?xml version="1.0"?><rss><channel>
      <item><title>Old</title><link>https://example.com/old</link><pubDate>${oldDate}</pubDate></item>
      <item><title>New</title><link>https://example.com/new</link><pubDate>${newDate}</pubDate></item>
    </channel></rss>`;

    mockFetchResponse("https://example.com", "/feed.xml", feed);

    const { items, health } = await fetchAllSources([RSS_SOURCE]);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("New");
    expect(health).toHaveLength(1);
    expect(health[0].success).toBe(true);
  });

  it("applies different thresholds per category", async () => {
    const now = Date.now();
    const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toUTCString();

    const aiFeed = `<?xml version="1.0"?><rss><channel>
      <item><title>Old AI</title><link>https://ai.example.com/old</link><pubDate>${twoDaysAgo}</pubDate></item>
    </channel></rss>`;
    const devFeed = `<?xml version="1.0"?><rss><channel>
      <item><title>Recent Dev</title><link>https://dev.example.com/recent</link><pubDate>${twoDaysAgo}</pubDate></item>
    </channel></rss>`;

    const aiSource = sourceFactory.build({
      id: "test-ai",
      url: "https://ai.example.com/feed.xml",
      category: "ai",
    });
    const devSource = sourceFactory.build({
      id: "test-dev",
      url: "https://dev.example.com/feed.xml",
      category: "dev",
    });

    mockFetchResponse("https://ai.example.com", "/feed.xml", aiFeed);
    mockFetchResponse("https://dev.example.com", "/feed.xml", devFeed);

    const { items } = await fetchAllSources([aiSource, devSource]);

    // AI threshold is 1 day, so 2-day-old AI item is filtered out
    // Dev threshold is 7 days, so 2-day-old dev item is kept
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Recent Dev");
  });

  it("keeps items with no publish date", async () => {
    const feed = `<?xml version="1.0"?><rss><channel>
      <item><title>No Date</title><link>https://example.com/nodate</link></item>
    </channel></rss>`;

    mockFetchResponse("https://example.com", "/feed.xml", feed);

    const { items } = await fetchAllSources([RSS_SOURCE]);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("No Date");
  });

  it("reports health for each source", async () => {
    mockFetchResponse("https://example.com", "/feed.xml", RSS_FEED);
    mockFetchResponse("https://example2.com", "/feed2.xml", "error", 500);

    const source2 = sourceFactory.build({
      id: "test-rss-2",
      url: "https://example2.com/feed2.xml",
    });
    const { health } = await fetchAllSources([RSS_SOURCE, source2]);

    expect(health).toHaveLength(2);
    const successfulSource = health.find((h) => h.sourceId === "test-rss");
    const emptySource = health.find((h) => h.sourceId === "test-rss-2");
    expect(successfulSource?.success).toBe(true);
    expect(emptySource?.success).toBe(true);
    expect(emptySource?.itemCount).toBe(0);
  });
});
