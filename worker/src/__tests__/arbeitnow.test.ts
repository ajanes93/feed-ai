import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { fetchMock } from "cloudflare:test";
import { fetchArbeitnow } from "../services/arbeitnow";
import { sourceFactory } from "./factories";

const ARBEITNOW_SOURCE = sourceFactory.build({
  id: "arbeitnow-remote",
  name: "Arbeitnow Remote",
  type: "api",
  url: "https://www.arbeitnow.com/api/job-board-api",
  category: "jobs",
});

function arbeitnowResponse(
  jobs: Array<{
    title?: string;
    company_name?: string;
    description?: string;
    remote?: boolean;
    url?: string;
    tags?: string[];
    created_at?: number;
  }>
) {
  return JSON.stringify({ data: jobs });
}

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

describe("fetchArbeitnow", () => {
  it("fetches and maps relevant remote job listings", async () => {
    fetchMock
      .get("https://www.arbeitnow.com")
      .intercept({ method: "GET", path: "/api/job-board-api" })
      .reply(
        200,
        arbeitnowResponse([
          {
            title: "Senior Vue.js Developer",
            company_name: "TechCorp",
            description: "<p>Build amazing <b>Vue</b> apps</p>",
            remote: true,
            url: "https://arbeitnow.com/jobs/1",
            tags: ["IT"],
            created_at: 1738300800,
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchArbeitnow(ARBEITNOW_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Senior Vue.js Developer — TechCorp");
    expect(items[0].link).toBe("https://arbeitnow.com/jobs/1");
    expect(items[0].sourceId).toBe("arbeitnow-remote");
    expect(items[0].content).toContain("Build amazing");
    expect(items[0].content).not.toContain("<");
  });

  it("filters out non-remote jobs", async () => {
    fetchMock
      .get("https://www.arbeitnow.com")
      .intercept({ method: "GET", path: "/api/job-board-api" })
      .reply(
        200,
        arbeitnowResponse([
          {
            title: "Vue Developer",
            company_name: "RemoteCo",
            remote: true,
            url: "https://arbeitnow.com/jobs/1",
            tags: ["IT"],
          },
          {
            title: "Vue Developer",
            company_name: "OfficeCo",
            remote: false,
            url: "https://arbeitnow.com/jobs/2",
            tags: ["IT"],
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchArbeitnow(ARBEITNOW_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toContain("RemoteCo");
  });

  it("filters out non-frontend jobs", async () => {
    fetchMock
      .get("https://www.arbeitnow.com")
      .intercept({ method: "GET", path: "/api/job-board-api" })
      .reply(
        200,
        arbeitnowResponse([
          {
            title: "Vue Developer",
            company_name: "FrontCo",
            remote: true,
            url: "https://arbeitnow.com/jobs/1",
          },
          {
            title: "Data Engineer",
            company_name: "DataCo",
            remote: true,
            url: "https://arbeitnow.com/jobs/2",
            tags: ["python"],
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchArbeitnow(ARBEITNOW_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toContain("Vue Developer");
  });

  it("matches by tags when title has no keywords", async () => {
    fetchMock
      .get("https://www.arbeitnow.com")
      .intercept({ method: "GET", path: "/api/job-board-api" })
      .reply(
        200,
        arbeitnowResponse([
          {
            title: "Software Engineer",
            company_name: "Co",
            remote: true,
            url: "https://arbeitnow.com/jobs/1",
            tags: ["Vue", "React"],
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchArbeitnow(ARBEITNOW_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toContain("Software Engineer");
  });

  it("converts unix timestamp to milliseconds", async () => {
    fetchMock
      .get("https://www.arbeitnow.com")
      .intercept({ method: "GET", path: "/api/job-board-api" })
      .reply(
        200,
        arbeitnowResponse([
          {
            title: "Vue Dev",
            company_name: "Co",
            remote: true,
            url: "https://arbeitnow.com/jobs/1",
            created_at: 1738300800,
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchArbeitnow(ARBEITNOW_SOURCE);

    expect(items[0].publishedAt).toBe(1738300800000);
  });

  it("returns empty array on HTTP error", async () => {
    fetchMock
      .get("https://www.arbeitnow.com")
      .intercept({ method: "GET", path: "/api/job-board-api" })
      .reply(500, "Server error");

    const items = await fetchArbeitnow(ARBEITNOW_SOURCE);

    expect(items).toEqual([]);
  });

  it("returns empty array when no data in response", async () => {
    fetchMock
      .get("https://www.arbeitnow.com")
      .intercept({ method: "GET", path: "/api/job-board-api" })
      .reply(200, JSON.stringify({}), {
        headers: { "content-type": "application/json" },
      });

    const items = await fetchArbeitnow(ARBEITNOW_SOURCE);

    expect(items).toEqual([]);
  });

  it("limits results to 20 items", async () => {
    const manyJobs = Array.from({ length: 25 }, (_, i) => ({
      title: `Vue Dev ${i}`,
      company_name: `Company ${i}`,
      remote: true,
      url: `https://arbeitnow.com/jobs/${i}`,
      created_at: 1738300800 + i,
    }));

    fetchMock
      .get("https://www.arbeitnow.com")
      .intercept({ method: "GET", path: "/api/job-board-api" })
      .reply(200, arbeitnowResponse(manyJobs), {
        headers: { "content-type": "application/json" },
      });

    const items = await fetchArbeitnow(ARBEITNOW_SOURCE);

    expect(items).toHaveLength(20);
  });
});
