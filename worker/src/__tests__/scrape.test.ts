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

const WEAREIMPS_SOURCE = sourceFactory.build({
  id: "weareimps",
  name: "WeAreImps",
  type: "scrape" as const,
  url: "https://www.weareimps.com/news",
  category: "sport",
});

/**
 * Generate Jina Reader markdown output format
 */
function jinaMarkdown(
  articles: Array<{ title: string; url: string }>,
  navLinks: string[] = []
) {
  const nav = navLinks
    .map((l) => `[${l}](https://example.com/${l})`)
    .join("\n");
  const content = articles
    .map((a) => `### [${a.title}](${a.url})`)
    .join("\n\n");

  return `Title: Test Site

URL Source: https://example.com

Markdown Content:
${nav}

${content}
`;
}

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

describe("fetchScrapeSource with Jina Reader", () => {
  it("extracts article links from Jina markdown", async () => {
    const markdown = jinaMarkdown([
      {
        title: "Give Yourself a Promotion",
        url: "https://every.to/context-window/give-yourself-a-promotion",
      },
      {
        title: "Compound Engineering",
        url: "https://every.to/source-code/compound-engineering",
      },
      {
        title: "Teach Your AI",
        url: "https://every.to/source-code/teach-your-ai-to-think",
      },
    ]);

    const mock = fetchMock.get("https://r.jina.ai");
    mock
      .intercept({ method: "GET", path: "/https://every.to/newsletter" })
      .reply(200, markdown);

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toHaveLength(3);
    expect(items[0].title).toBe("Give Yourself a Promotion");
    expect(items[0].link).toBe(
      "https://every.to/context-window/give-yourself-a-promotion"
    );
    expect(items[0].sourceId).toBe("every-to");
  });

  it("works with WeAreImps source", async () => {
    const markdown = jinaMarkdown([
      {
        title: "Imps win 3-0",
        url: "https://www.weareimps.com/news/imps-win",
      },
      {
        title: "Match preview",
        url: "https://www.weareimps.com/news/match-preview",
      },
    ]);

    const mock = fetchMock.get("https://r.jina.ai");
    mock
      .intercept({ method: "GET", path: "/https://www.weareimps.com/news" })
      .reply(200, markdown);

    const items = await fetchScrapeSource(WEAREIMPS_SOURCE);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Imps win 3-0");
    expect(items[0].sourceId).toBe("weareimps");
  });

  it("excludes navigation links", async () => {
    const markdown = `Title: Test

URL Source: https://every.to/newsletter

Markdown Content:
### [Newsletter](https://every.to/newsletter)
### [Podcast](https://every.to/podcast)
### [Store](https://every.to/store)
### [Login](https://every.to/login)
### [Search](https://every.to/search)
### [About](https://every.to/about)
`;

    const mock = fetchMock.get("https://r.jina.ai");
    mock
      .intercept({ method: "GET", path: "/https://every.to/newsletter" })
      .reply(200, markdown);

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toEqual([]);
  });

  it("deduplicates URLs", async () => {
    const markdown = jinaMarkdown([
      { title: "Article One", url: "https://every.to/source-code/article-one" },
      {
        title: "Article One Again",
        url: "https://every.to/source-code/article-one",
      },
      { title: "Article Two", url: "https://every.to/source-code/article-two" },
    ]);

    const mock = fetchMock.get("https://r.jina.ai");
    mock
      .intercept({ method: "GET", path: "/https://every.to/newsletter" })
      .reply(200, markdown);

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Article One");
    expect(items[1].title).toBe("Article Two");
  });

  it("returns empty array on HTTP error", async () => {
    const mock = fetchMock.get("https://r.jina.ai");
    mock
      .intercept({ method: "GET", path: "/https://every.to/newsletter" })
      .reply(503, "Service unavailable");

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toEqual([]);
  });

  it("returns empty array on minimal content", async () => {
    const mock = fetchMock.get("https://r.jina.ai");
    mock
      .intercept({ method: "GET", path: "/https://every.to/newsletter" })
      .reply(200, "Short");

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toEqual([]);
  });

  it("handles markdown with ## headings", async () => {
    const markdown = `Title: Test

URL Source: https://example.com

Markdown Content:
## [Two Hash Title](https://every.to/article/two-hash)
### [Three Hash Title](https://every.to/article/three-hash)
`;

    const mock = fetchMock.get("https://r.jina.ai");
    mock
      .intercept({ method: "GET", path: "/https://every.to/newsletter" })
      .reply(200, markdown);

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    // Should match both ## and ### patterns
    expect(items).toHaveLength(2);
  });

  it("limits results to 20 items", async () => {
    const articles = Array.from({ length: 30 }, (_, i) => ({
      title: `Article ${i}`,
      url: `https://every.to/source-code/article-${i}`,
    }));

    const mock = fetchMock.get("https://r.jina.ai");
    mock
      .intercept({ method: "GET", path: "/https://every.to/newsletter" })
      .reply(200, jinaMarkdown(articles));

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toHaveLength(20);
  });

  it("skips image links", async () => {
    const markdown = `Title: Test

URL Source: https://example.com

Markdown Content:
### [Image Link](https://example.com/image.png)
### [Real Article](https://every.to/article/real)
### [Another Image](https://example.com/photo.jpg)
`;

    const mock = fetchMock.get("https://r.jina.ai");
    mock
      .intercept({ method: "GET", path: "/https://every.to/newsletter" })
      .reply(200, markdown);

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Real Article");
  });
});
