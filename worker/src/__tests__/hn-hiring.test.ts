import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { fetchMock } from "cloudflare:test";
import { fetchHNHiring } from "../services/hn-hiring";
import { sourceFactory } from "./factories";

const HN_HIRING_SOURCE = sourceFactory.build({
  id: "hn-hiring",
  name: "HN Who's Hiring",
  type: "hn",
  url: "https://hn.algolia.com/api/v1/search?query=%22Ask%20HN%3A%20Who%20is%20hiring%22&tags=ask_hn&hitsPerPage=1",
  category: "jobs",
});

function algoliaSearchResponse(objectID: string) {
  return JSON.stringify({ hits: [{ objectID }] });
}

function algoliaItemResponse(
  children: Array<{ id: number; text: string; created_at: string }>
) {
  return JSON.stringify({ children });
}

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

describe("fetchHNHiring", () => {
  it("fetches and filters job comments by keywords", async () => {
    fetchMock
      .get("https://hn.algolia.com")
      .intercept({
        method: "GET",
        path: /\/api\/v1\/search/,
      })
      .reply(200, algoliaSearchResponse("42000"), {
        headers: { "content-type": "application/json" },
      });

    fetchMock
      .get("https://hn.algolia.com")
      .intercept({
        method: "GET",
        path: "/api/v1/items/42000",
      })
      .reply(
        200,
        algoliaItemResponse([
          {
            id: 1001,
            text: "Acme Corp | Senior Vue Developer | Remote | $150k",
            created_at: "2026-01-30T12:00:00Z",
          },
          {
            id: 1002,
            text: "SomeCompany | Rust Backend | Onsite SF",
            created_at: "2026-01-30T11:00:00Z",
          },
          {
            id: 1003,
            text: "StartupX | Laravel + TypeScript | Remote",
            created_at: "2026-01-30T10:00:00Z",
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchHNHiring(HN_HIRING_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toContain("Vue Developer");
    expect(items[0].link).toBe("https://news.ycombinator.com/item?id=1001");
    expect(items[0].sourceId).toBe("hn-hiring");
  });

  it("strips HTML from comment text", async () => {
    fetchMock
      .get("https://hn.algolia.com")
      .intercept({ method: "GET", path: /\/api\/v1\/search/ })
      .reply(200, algoliaSearchResponse("42001"), {
        headers: { "content-type": "application/json" },
      });

    fetchMock
      .get("https://hn.algolia.com")
      .intercept({ method: "GET", path: "/api/v1/items/42001" })
      .reply(
        200,
        algoliaItemResponse([
          {
            id: 2001,
            text: "<p>Company | <b>Vue.js</b> Engineer | <a href='https://apply.com'>Apply</a></p>",
            created_at: "2026-01-30T12:00:00Z",
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchHNHiring(HN_HIRING_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].content).not.toContain("<");
    expect(items[0].content).toContain("Vue.js");
  });

  it("returns empty array when search returns no hits", async () => {
    fetchMock
      .get("https://hn.algolia.com")
      .intercept({ method: "GET", path: /\/api\/v1\/search/ })
      .reply(200, JSON.stringify({ hits: [] }), {
        headers: { "content-type": "application/json" },
      });

    const items = await fetchHNHiring(HN_HIRING_SOURCE);

    expect(items).toEqual([]);
  });

  it("throws on search HTTP error", async () => {
    fetchMock
      .get("https://hn.algolia.com")
      .intercept({ method: "GET", path: /\/api\/v1\/search/ })
      .reply(500, "Server error");

    await expect(fetchHNHiring(HN_HIRING_SOURCE)).rejects.toThrow("HTTP 500");
  });

  it("throws on item fetch HTTP error", async () => {
    fetchMock
      .get("https://hn.algolia.com")
      .intercept({ method: "GET", path: /\/api\/v1\/search/ })
      .reply(200, algoliaSearchResponse("42002"), {
        headers: { "content-type": "application/json" },
      });

    fetchMock
      .get("https://hn.algolia.com")
      .intercept({ method: "GET", path: "/api/v1/items/42002" })
      .reply(500, "Server error");

    await expect(fetchHNHiring(HN_HIRING_SOURCE)).rejects.toThrow("HTTP 500");
  });

  it("limits results to 20 items", async () => {
    const manyComments = Array.from({ length: 30 }, (_, i) => ({
      id: 3000 + i,
      text: `Company ${i} | Vue.js Developer | Remote`,
      created_at: "2026-01-30T12:00:00Z",
    }));

    fetchMock
      .get("https://hn.algolia.com")
      .intercept({ method: "GET", path: /\/api\/v1\/search/ })
      .reply(200, algoliaSearchResponse("42003"), {
        headers: { "content-type": "application/json" },
      });

    fetchMock
      .get("https://hn.algolia.com")
      .intercept({ method: "GET", path: "/api/v1/items/42003" })
      .reply(200, algoliaItemResponse(manyComments), {
        headers: { "content-type": "application/json" },
      });

    const items = await fetchHNHiring(HN_HIRING_SOURCE);

    expect(items).toHaveLength(20);
  });

  it("truncates long titles to 100 chars with ellipsis", async () => {
    const longText = "A".repeat(150) + " | Vue | Remote";

    fetchMock
      .get("https://hn.algolia.com")
      .intercept({ method: "GET", path: /\/api\/v1\/search/ })
      .reply(200, algoliaSearchResponse("42004"), {
        headers: { "content-type": "application/json" },
      });

    fetchMock
      .get("https://hn.algolia.com")
      .intercept({ method: "GET", path: "/api/v1/items/42004" })
      .reply(
        200,
        algoliaItemResponse([
          { id: 4001, text: longText, created_at: "2026-01-30T12:00:00Z" },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchHNHiring(HN_HIRING_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toHaveLength(101); // 100 + ellipsis
    expect(items[0].title).toMatch(/…$/);
    expect(items[0].content).toBe(longText);
  });
});
