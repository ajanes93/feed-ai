import { describe, it, expect } from "vitest";
import { extractFeedItems, stripHtml } from "../index";

describe("stripHtml", () => {
  it("removes HTML tags", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("trims whitespace", () => {
    expect(stripHtml("  <p>text</p>  ")).toBe("text");
  });

  it("returns plain text unchanged", () => {
    expect(stripHtml("no tags here")).toBe("no tags here");
  });

  it("handles empty string", () => {
    expect(stripHtml("")).toBe("");
  });

  it("handles self-closing tags", () => {
    expect(stripHtml("before<br/>after")).toBe("beforeafter");
  });
});

describe("extractFeedItems", () => {
  it("parses RSS 2.0 feed with multiple items", () => {
    const parsed = {
      rss: {
        channel: {
          item: [
            {
              title: "Article 1",
              link: "https://example.com/1",
              description: "Summary 1",
              pubDate: "Mon, 01 Jan 2025 00:00:00 GMT",
            },
            {
              title: "Article 2",
              link: "https://example.com/2",
              description: "<p>HTML summary</p>",
            },
          ],
        },
      },
    };
    const items = extractFeedItems(parsed);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Article 1");
    expect(items[0].url).toBe("https://example.com/1");
    expect(items[0].summary).toBe("Summary 1");
    expect(items[0].publishedAt).toBe("Mon, 01 Jan 2025 00:00:00 GMT");
    expect(items[1].summary).toBe("HTML summary");
  });

  it("parses RSS with single item (not array)", () => {
    const parsed = {
      rss: {
        channel: {
          item: {
            title: "Only article",
            link: "https://example.com/only",
            description: "Summary",
          },
        },
      },
    };
    const items = extractFeedItems(parsed);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Only article");
  });

  it("parses RDF feed", () => {
    const parsed = {
      "rdf:RDF": {
        item: [
          {
            title: "RDF Article",
            "@_rdf:about": "https://example.com/rdf",
            description: "RDF summary",
            "dc:date": "2025-01-01",
          },
        ],
      },
    };
    const items = extractFeedItems(parsed);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://example.com/rdf");
    expect(items[0].publishedAt).toBe("2025-01-01");
  });

  it("parses Atom feed", () => {
    const parsed = {
      feed: {
        entry: [
          {
            title: "Atom Article",
            link: { "@_href": "https://example.com/atom" },
            summary: "Atom summary",
            published: "2025-01-01T12:00:00Z",
          },
        ],
      },
    };
    const items = extractFeedItems(parsed);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Atom Article");
    expect(items[0].url).toBe("https://example.com/atom");
    expect(items[0].publishedAt).toBe("2025-01-01T12:00:00Z");
  });

  it("parses Atom feed with link array", () => {
    const parsed = {
      feed: {
        entry: [
          {
            title: "Multi-link entry",
            link: [
              { "@_rel": "self", "@_href": "https://example.com/self" },
              { "@_rel": "alternate", "@_href": "https://example.com/alt" },
            ],
            summary: "Summary",
          },
        ],
      },
    };
    const items = extractFeedItems(parsed);
    expect(items[0].url).toBe("https://example.com/alt");
  });

  it("parses Atom title object (#text)", () => {
    const parsed = {
      feed: {
        entry: [
          {
            title: { "#text": "Object title", "@_type": "html" },
            link: { "@_href": "https://example.com/1" },
            summary: "Summary",
          },
        ],
      },
    };
    const items = extractFeedItems(parsed);
    expect(items[0].title).toBe("Object title");
  });

  it("uses content:encoded as fallback summary", () => {
    const parsed = {
      rss: {
        channel: {
          item: [
            {
              title: "Article",
              link: "https://example.com/1",
              "content:encoded": "<div>Full content</div>",
            },
          ],
        },
      },
    };
    const items = extractFeedItems(parsed);
    expect(items[0].summary).toBe("Full content");
  });

  it("returns empty array for empty feed", () => {
    expect(extractFeedItems({})).toEqual([]);
    expect(extractFeedItems({ rss: { channel: {} } })).toEqual([]);
  });

  it("falls back to updated date for Atom entries", () => {
    const parsed = {
      feed: {
        entry: [
          {
            title: "Entry",
            link: { "@_href": "https://example.com/1" },
            updated: "2025-06-01T00:00:00Z",
          },
        ],
      },
    };
    const items = extractFeedItems(parsed);
    expect(items[0].publishedAt).toBe("2025-06-01T00:00:00Z");
  });
});
