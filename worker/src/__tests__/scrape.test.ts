import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { fetchMock } from "cloudflare:test";
import { fetchScrapeSource } from "../services/scrape";
import { sourceFactory } from "./factories";
import { mockFetchResponse } from "./helpers";

const EVERY_TO_SOURCE = sourceFactory.build({
  id: "every-to",
  name: "Every.to",
  type: "scrape" as const,
  url: "https://every.to/newsletter",
  category: "ai",
});

function everyToHtml(articles: Array<{ href: string; title: string }>) {
  const cards = articles
    .map(
      (a) => `
    <a href="${a.href}">
      <img src="https://cdn.every.to/thumb.jpg" />
      <h3>${a.title}</h3>
    </a>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
<body>
  <nav>
    <a href="/newsletter">Newsletter</a>
    <a href="/podcast">Podcast</a>
    <a href="/store">Store</a>
  </nav>
  ${cards}
</body>
</html>`;
}

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

describe("fetchScrapeSource", () => {
  it("extracts article links from HTML", async () => {
    const html = everyToHtml([
      {
        href: "/context-window/give-yourself-a-promotion",
        title: "Give Yourself a Promotion",
      },
      {
        href: "/source-code/compound-engineering",
        title: "Compound Engineering",
      },
      {
        href: "/source-code/teach-your-ai-to-think",
        title: "Teach Your AI",
      },
    ]);

    mockFetchResponse("https://every.to", "/newsletter", html);

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toHaveLength(3);
    expect(items[0].title).toBe("Give Yourself a Promotion");
    expect(items[0].link).toBe(
      "https://every.to/context-window/give-yourself-a-promotion"
    );
    expect(items[0].sourceId).toBe("every-to");
  });

  it("excludes navigation links (single-segment paths)", async () => {
    const html = `<!DOCTYPE html>
<html><body>
  <a href="/newsletter"><h3>Newsletter</h3></a>
  <a href="/podcast"><h3>Podcast</h3></a>
  <a href="/store"><h3>Store</h3></a>
  <a href="/courses"><h3>Courses</h3></a>
  <a href="/consulting"><h3>Consulting</h3></a>
  <a href="/columnists"><h3>Columnists</h3></a>
  <a href="/products"><h3>Products</h3></a>
</body></html>`;

    mockFetchResponse("https://every.to", "/newsletter", html);

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toEqual([]);
  });

  it("deduplicates URLs", async () => {
    const html = everyToHtml([
      { href: "/source-code/article-one", title: "Article One" },
      { href: "/source-code/article-one", title: "Article One Again" },
      { href: "/source-code/article-two", title: "Article Two" },
    ]);

    mockFetchResponse("https://every.to", "/newsletter", html);

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

  it("returns empty array on HTTP error", async () => {
    mockFetchResponse(
      "https://every.to",
      "/newsletter",
      "Service unavailable",
      503
    );

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toEqual([]);
  });

  it("ignores links without h3 titles", async () => {
    const html = `<!DOCTYPE html>
<html><body>
  <a href="/source-code/no-title"><span>Not a title</span></a>
  <a href="/source-code/has-title"><h3>Has Title</h3></a>
</body></html>`;

    mockFetchResponse("https://every.to", "/newsletter", html);

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Has Title");
  });

  it("strips nested HTML tags from titles", async () => {
    const html = `<!DOCTYPE html>
<html><body>
  <a href="/source-code/nested-tags">
    <h3>Title with <em>emphasis</em> and <strong>bold</strong></h3>
  </a>
</body></html>`;

    mockFetchResponse("https://every.to", "/newsletter", html);

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Title with emphasis and bold");
  });

  it("limits results to 20 items", async () => {
    const articles = Array.from({ length: 30 }, (_, i) => ({
      href: `/source-code/article-${i}`,
      title: `Article ${i}`,
    }));

    mockFetchResponse("https://every.to", "/newsletter", everyToHtml(articles));

    const items = await fetchScrapeSource(EVERY_TO_SOURCE);

    expect(items).toHaveLength(20);
  });
});
