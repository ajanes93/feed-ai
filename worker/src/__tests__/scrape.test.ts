import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { fetchMock } from "cloudflare:test";
import { fetchScrapeSource } from "../services/scrape";
import { sourceFactory } from "./factories";

const EVERY_TO_SOURCE = sourceFactory.build({
  id: "every-to",
  name: "Every.to",
  type: "scrape" as const,
  url: "https://every.to/newsletter",
  category: "ai",
});

const JINA_MARKDOWN = `# Every Newsletter

[Give Yourself a Promotion](https://every.to/context-window/give-yourself-a-promotion)

[Compound Engineering](https://every.to/source-code/compound-engineering-how-every-codes)

[Teach Your AI](https://every.to/source-code/teach-your-ai-to-think)

[Newsletter](https://every.to/newsletter)

[Podcast](https://every.to/podcast)

[Store](https://every.to/store)
`;

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

describe("fetchScrapeSource", () => {
  it("extracts article links from Jina markdown", async () => {
    fetchMock
      .get("https://r.jina.ai")
      .intercept({
        method: "GET",
        path: "/https://every.to/newsletter",
      })
      .reply(200, JINA_MARKDOWN);

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toHaveLength(3);
    expect(items[0].title).toBe("Give Yourself a Promotion");
    expect(items[0].link).toBe(
      "https://every.to/context-window/give-yourself-a-promotion"
    );
    expect(items[0].sourceId).toBe("every-to");
  });

  it("excludes navigation links", async () => {
    const navOnly = `
[Newsletter](https://every.to/newsletter)
[Podcast](https://every.to/podcast)
[Store](https://every.to/store)
[Courses](https://every.to/courses)
[Consulting](https://every.to/consulting)
`;

    fetchMock
      .get("https://r.jina.ai")
      .intercept({
        method: "GET",
        path: "/https://every.to/newsletter",
      })
      .reply(200, navOnly);

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toEqual([]);
  });

  it("deduplicates URLs", async () => {
    const dupes = `
[Article One](https://every.to/source-code/article-one)
[Article One Again](https://every.to/source-code/article-one)
[Article Two](https://every.to/source-code/article-two)
`;

    fetchMock
      .get("https://r.jina.ai")
      .intercept({
        method: "GET",
        path: "/https://every.to/newsletter",
      })
      .reply(200, dupes);

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Article One");
    expect(items[1].title).toBe("Article Two");
  });

  it("returns empty array for unknown source id", async () => {
    const unknown = sourceFactory.build({
      id: "unknown-scrape",
      type: "scrape" as const,
      url: "https://example.com",
    });

    const items = await fetchScrapeSource(unknown);

    expect(items).toEqual([]);
  });

  it("returns empty array on Jina HTTP error", async () => {
    fetchMock
      .get("https://r.jina.ai")
      .intercept({
        method: "GET",
        path: "/https://every.to/newsletter",
      })
      .reply(503, "Service unavailable");

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toEqual([]);
  });

  it("excludes non-matching domain links", async () => {
    const mixed = `
[Article](https://every.to/source-code/good-article)
[External](https://other-site.com/some-page)
[Another](https://every.to/context-window/another-article)
`;

    fetchMock
      .get("https://r.jina.ai")
      .intercept({
        method: "GET",
        path: "/https://every.to/newsletter",
      })
      .reply(200, mixed);

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toHaveLength(2);
    expect(items.every((i) => i.link.startsWith("https://every.to/"))).toBe(
      true
    );
  });

  it("limits results to 20 items", async () => {
    const manyLinks = Array.from(
      { length: 30 },
      (_, i) => `[Article ${i}](https://every.to/source-code/article-${i})`
    ).join("\n");

    fetchMock
      .get("https://r.jina.ai")
      .intercept({
        method: "GET",
        path: "/https://every.to/newsletter",
      })
      .reply(200, manyLinks);

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toHaveLength(20);
  });
});
