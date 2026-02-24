import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { fetchMock } from "cloudflare:test";
import { fetchHimalayas } from "../services/himalayas";
import { sourceFactory } from "./factories";

const HIMALAYAS_SOURCE = sourceFactory.build({
  id: "himalayas-vue",
  name: "Himalayas Vue",
  type: "api",
  url: "https://himalayas.app/jobs/api?limit=20&q=vue&remote=true",
  category: "jobs",
});

function himalayasResponse(
  jobs: Array<{
    title: string;
    companyName: string;
    excerpt?: string;
    description?: string;
    applicationLink?: string;
    pubDate?: number;
    categories?: string[];
  }>
) {
  return JSON.stringify({ jobs });
}

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

describe("fetchHimalayas", () => {
  it("fetches and maps job listings", async () => {
    fetchMock
      .get("https://himalayas.app")
      .intercept({ method: "GET", path: /\/jobs\/api/ })
      .reply(
        200,
        himalayasResponse([
          {
            title: "Senior Vue.js Frontend Engineer",
            companyName: "Acme Corp",
            description: "<p>Remote Vue.js role with <b>TypeScript</b></p>",
            applicationLink: "https://acme.com/apply",
            pubDate: 1738300800,
          },
          {
            title: "Vue.js Developer",
            companyName: "StartupX",
            excerpt: "Remote Vue position",
            applicationLink: "https://startupx.com/jobs/1",
            pubDate: 1738214400,
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchHimalayas(HIMALAYAS_SOURCE);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Senior Vue.js Frontend Engineer — Acme Corp");
    expect(items[0].link).toBe("https://acme.com/apply");
    expect(items[0].sourceId).toBe("himalayas-vue");
    expect(items[0].content).toContain("Vue.js role with");
    expect(items[0].content).not.toContain("<");
    expect(items[1].title).toBe("Vue.js Developer — StartupX");
  });

  it("filters out non-Vue jobs by keyword", async () => {
    fetchMock
      .get("https://himalayas.app")
      .intercept({ method: "GET", path: /\/jobs\/api/ })
      .reply(
        200,
        himalayasResponse([
          {
            title: "Vue.js Developer",
            companyName: "Co",
            applicationLink: "https://co.com",
          },
          {
            title: "React Developer",
            companyName: "Other",
            applicationLink: "https://other.com",
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchHimalayas(HIMALAYAS_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toContain("Vue.js");
  });

  it("converts unix timestamp to milliseconds", async () => {
    fetchMock
      .get("https://himalayas.app")
      .intercept({ method: "GET", path: /\/jobs\/api/ })
      .reply(
        200,
        himalayasResponse([
          {
            title: "Vue Dev",
            companyName: "Co",
            applicationLink: "https://co.com",
            pubDate: 1738300800,
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchHimalayas(HIMALAYAS_SOURCE);

    expect(items[0].publishedAt).toBe(1738300800000);
  });

  it("handles missing pubDate", async () => {
    fetchMock
      .get("https://himalayas.app")
      .intercept({ method: "GET", path: /\/jobs\/api/ })
      .reply(
        200,
        himalayasResponse([
          {
            title: "Vue Dev",
            companyName: "Co",
            applicationLink: "https://co.com",
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchHimalayas(HIMALAYAS_SOURCE);

    expect(items[0].publishedAt).toBeUndefined();
  });

  it("returns empty array on HTTP error", async () => {
    fetchMock
      .get("https://himalayas.app")
      .intercept({ method: "GET", path: /\/jobs\/api/ })
      .reply(500, "Server error");

    const items = await fetchHimalayas(HIMALAYAS_SOURCE);

    expect(items).toEqual([]);
  });

  it("returns empty array when no jobs in response", async () => {
    fetchMock
      .get("https://himalayas.app")
      .intercept({ method: "GET", path: /\/jobs\/api/ })
      .reply(200, JSON.stringify({ jobs: [] }), {
        headers: { "content-type": "application/json" },
      });

    const items = await fetchHimalayas(HIMALAYAS_SOURCE);

    expect(items).toEqual([]);
  });

  it("limits results to 20 items", async () => {
    const manyJobs = Array.from({ length: 25 }, (_, i) => ({
      title: `Vue.js Job ${i}`,
      companyName: `Company ${i}`,
      applicationLink: `https://example.com/${i}`,
      pubDate: 1738300800 + i,
    }));

    fetchMock
      .get("https://himalayas.app")
      .intercept({ method: "GET", path: /\/jobs\/api/ })
      .reply(200, himalayasResponse(manyJobs), {
        headers: { "content-type": "application/json" },
      });

    const items = await fetchHimalayas(HIMALAYAS_SOURCE);

    expect(items).toHaveLength(20);
  });

  it("falls back to excerpt when description is missing", async () => {
    fetchMock
      .get("https://himalayas.app")
      .intercept({ method: "GET", path: /\/jobs\/api/ })
      .reply(
        200,
        himalayasResponse([
          {
            title: "Vue Dev",
            companyName: "Co",
            excerpt: "A great remote Vue.js opportunity",
            applicationLink: "https://co.com",
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchHimalayas(HIMALAYAS_SOURCE);

    expect(items[0].content).toBe("A great remote Vue.js opportunity");
  });
});
