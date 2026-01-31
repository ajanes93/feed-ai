import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchSource, fetchAllSources } from "../services/fetcher";
import type { Source } from "../sources";

const rssSource: Source = {
  id: "test-rss",
  name: "Test RSS",
  type: "rss",
  url: "https://example.com/feed.xml",
  category: "dev",
};

const apiSource: Source = {
  id: "test-api",
  name: "Test API",
  type: "api",
  url: "https://example.com/api/jobs",
  category: "jobs",
};

const RSS_FEED = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Article One</title>
      <link>https://example.com/1</link>
      <description>First &amp; best article</description>
      <pubDate>Mon, 27 Jan 2025 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Article Two</title>
      <link>https://example.com/2</link>
      <description>&lt;p&gt;HTML content&lt;/p&gt;</description>
      <pubDate>Tue, 28 Jan 2025 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM_FEED = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom Entry</title>
    <link href="https://example.com/atom/1"/>
    <summary>Atom summary</summary>
    <published>2025-01-28T12:00:00Z</published>
  </entry>
</feed>`;

const JOBICY_RESPONSE = JSON.stringify({
  jobs: [
    {
      id: 1,
      jobTitle: "Senior Vue Dev",
      url: "https://jobicy.com/1",
      jobDescription: "<p>Great job</p>",
      pubDate: "2025-01-28T12:00:00Z",
    },
    {
      id: 2,
      jobTitle: "Frontend Lead",
      url: "https://jobicy.com/2",
      jobDescription: "Another role",
      pubDate: "2025-01-28T10:00:00Z",
    },
  ],
});

function stubFetchWith(body: string, status = 200, headers = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(body, { status, headers }))
  );
}

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
    // HTML entities should be decoded
    expect(items[0].content).toBe("First & best article");
  });

  it("strips HTML from content", async () => {
    stubFetchWith(RSS_FEED);

    const items = await fetchSource(rssSource);

    // <p>HTML content</p> with encoded entities
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
    expect(items[0].content).toBe("Great job"); // HTML stripped
    expect(items[0].sourceId).toBe("test-api");
  });

  it("returns empty array on HTTP error", async () => {
    stubFetchWith("Not found", 404);

    const items = await fetchSource(rssSource);

    expect(items).toEqual([]);
  });

  it("returns empty array on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network failure"))
    );

    const items = await fetchSource(rssSource);

    expect(items).toEqual([]);
  });

  it("limits items to 20", async () => {
    const manyItems = Array.from({ length: 30 }, (_, i) => `
      <item>
        <title>Item ${i}</title>
        <link>https://example.com/${i}</link>
      </item>`).join("");
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
        .mockResolvedValueOnce(new Response("error", { status: 500 }))
    );

    const source2: Source = { ...rssSource, id: "test-rss-2", url: "https://example.com/feed2.xml" };
    const { health } = await fetchAllSources([rssSource, source2]);

    expect(health).toHaveLength(2);
    const success = health.find((h) => h.sourceId === "test-rss");
    const failure = health.find((h) => h.sourceId === "test-rss-2");
    expect(success?.success).toBe(true);
    expect(failure?.success).toBe(true); // fetchSource returns [] on error, not throw
    expect(failure?.itemCount).toBe(0);
  });
});
