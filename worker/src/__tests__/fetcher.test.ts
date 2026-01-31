import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchSource, fetchAllSources } from "../services/fetcher";
import { sourceFactory } from "./factories";
import { stubFetchWith, RSS_FEED, ATOM_FEED, JOBICY_RESPONSE } from "./helpers";

const rssSource = sourceFactory.build({ id: "test-rss", name: "Test RSS", type: "rss", url: "https://example.com/feed.xml" });
const apiSource = sourceFactory.build({ id: "test-api", name: "Test API", type: "api", url: "https://example.com/api/jobs", category: "jobs" });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchSource", () => {
  it("parses RSS feed items", async () => {
    stubFetchWith(RSS_FEED);

    const items = await fetchSource(rssSource);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Article One");
    expect(items[0].link).toBe("https://example.com/1");
    expect(items[0].sourceId).toBe("test-rss");
    expect(items[0].content).toBe("First & best article");
  });

  it("strips HTML from content", async () => {
    stubFetchWith(RSS_FEED);

    const items = await fetchSource(rssSource);

    expect(items[1].content).toBe("HTML content");
  });

  it("parses Atom feed items", async () => {
    stubFetchWith(ATOM_FEED);

    const items = await fetchSource(rssSource);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Atom Entry");
    expect(items[0].link).toBe("https://example.com/atom/1");
  });

  it("parses JSON API (Jobicy) responses", async () => {
    stubFetchWith(JOBICY_RESPONSE, 200, { "content-type": "application/json" });

    const items = await fetchSource(apiSource);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Senior Vue Dev");
    expect(items[0].link).toBe("https://jobicy.com/1");
    expect(items[0].content).toBe("Great job");
    expect(items[0].sourceId).toBe("test-api");
  });

  it("returns empty array on HTTP error", async () => {
    stubFetchWith("Not found", 404);

    const items = await fetchSource(rssSource);

    expect(items).toEqual([]);
  });

  it("returns empty array on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network failure")));

    const items = await fetchSource(rssSource);

    expect(items).toEqual([]);
  });

  it("limits items to 20", async () => {
    const manyItems = Array.from(
      { length: 30 },
      (_, i) => `<item><title>Item ${i}</title><link>https://example.com/${i}</link></item>`,
    ).join("");
    const feed = `<?xml version="1.0"?><rss><channel>${manyItems}</channel></rss>`;

    stubFetchWith(feed);

    const items = await fetchSource(rssSource);

    expect(items).toHaveLength(20);
  });
});

describe("fetchAllSources", () => {
  it("filters out items older than 48 hours", async () => {
    const now = Date.now();
    const oldDate = new Date(now - 72 * 60 * 60 * 1000).toUTCString();
    const newDate = new Date(now - 1 * 60 * 60 * 1000).toUTCString();

    const feed = `<?xml version="1.0"?><rss><channel>
      <item><title>Old</title><link>https://example.com/old</link><pubDate>${oldDate}</pubDate></item>
      <item><title>New</title><link>https://example.com/new</link><pubDate>${newDate}</pubDate></item>
    </channel></rss>`;

    stubFetchWith(feed);

    const { items, health } = await fetchAllSources([rssSource]);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("New");
    expect(health).toHaveLength(1);
    expect(health[0].success).toBe(true);
  });

  it("keeps items with no publish date", async () => {
    const feed = `<?xml version="1.0"?><rss><channel>
      <item><title>No Date</title><link>https://example.com/nodate</link></item>
    </channel></rss>`;

    stubFetchWith(feed);

    const { items } = await fetchAllSources([rssSource]);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("No Date");
  });

  it("reports health for each source", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(new Response(RSS_FEED, { status: 200 }))
        .mockResolvedValueOnce(new Response("error", { status: 500 })),
    );

    const source2 = sourceFactory.build({ id: "test-rss-2", url: "https://example.com/feed2.xml" });
    const { health } = await fetchAllSources([rssSource, source2]);

    expect(health).toHaveLength(2);
    const success = health.find((h) => h.sourceId === "test-rss");
    const failure = health.find((h) => h.sourceId === "test-rss-2");
    expect(success?.success).toBe(true);
    expect(failure?.success).toBe(true);
    expect(failure?.itemCount).toBe(0);
  });
});
