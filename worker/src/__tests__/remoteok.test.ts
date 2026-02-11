import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { fetchMock } from "cloudflare:test";
import { fetchRemoteOK } from "../services/remoteok";
import { sourceFactory } from "./factories";

const REMOTEOK_SOURCE = sourceFactory.build({
  id: "remoteok-frontend",
  name: "RemoteOK Frontend",
  type: "api",
  url: "https://remoteok.com/api",
  category: "jobs",
});

function remoteokResponse(
  jobs: Array<{
    position?: string;
    company?: string;
    description?: string;
    tags?: string[];
    url?: string;
    epoch?: number;
  }>
) {
  return JSON.stringify([{ legal: "This is a legal notice" }, ...jobs]);
}

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

describe("fetchRemoteOK", () => {
  it("fetches and maps relevant job listings", async () => {
    fetchMock
      .get("https://remoteok.com")
      .intercept({ method: "GET", path: "/api" })
      .reply(
        200,
        remoteokResponse([
          {
            position: "Senior Frontend Engineer",
            company: "Acme Corp",
            description: "<p>Build UIs with <b>Vue.js</b></p>",
            tags: ["vue", "typescript", "frontend"],
            url: "https://remoteok.com/jobs/1",
            epoch: 1738300800,
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchRemoteOK(REMOTEOK_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Senior Frontend Engineer — Acme Corp");
    expect(items[0].link).toBe("https://remoteok.com/jobs/1");
    expect(items[0].sourceId).toBe("remoteok-frontend");
    expect(items[0].content).toContain("Build UIs with");
    expect(items[0].content).not.toContain("<");
  });

  it("skips the legal notice first element", async () => {
    fetchMock
      .get("https://remoteok.com")
      .intercept({ method: "GET", path: "/api" })
      .reply(
        200,
        JSON.stringify([
          { legal: "notice" },
          {
            position: "Vue Dev",
            company: "Co",
            tags: ["vue"],
            url: "https://remoteok.com/jobs/1",
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchRemoteOK(REMOTEOK_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Vue Dev — Co");
  });

  it("filters out non-frontend jobs", async () => {
    fetchMock
      .get("https://remoteok.com")
      .intercept({ method: "GET", path: "/api" })
      .reply(
        200,
        remoteokResponse([
          {
            position: "Vue Developer",
            company: "FrontCo",
            tags: ["vue", "javascript"],
            url: "https://remoteok.com/jobs/1",
          },
          {
            position: "Data Scientist",
            company: "DataCo",
            tags: ["python", "ml"],
            url: "https://remoteok.com/jobs/2",
          },
          {
            position: "Frontend Lead",
            company: "UICo",
            tags: ["frontend", "react"],
            url: "https://remoteok.com/jobs/3",
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchRemoteOK(REMOTEOK_SOURCE);

    expect(items).toHaveLength(1);
    expect(items[0].title).toContain("Vue Developer");
  });

  it("converts unix timestamp to milliseconds", async () => {
    fetchMock
      .get("https://remoteok.com")
      .intercept({ method: "GET", path: "/api" })
      .reply(
        200,
        remoteokResponse([
          {
            position: "Dev",
            company: "Co",
            tags: ["vue"],
            url: "https://remoteok.com/jobs/1",
            epoch: 1738300800,
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchRemoteOK(REMOTEOK_SOURCE);

    expect(items[0].publishedAt).toBe(1738300800000);
  });

  it("returns empty array on HTTP error", async () => {
    fetchMock
      .get("https://remoteok.com")
      .intercept({ method: "GET", path: "/api" })
      .reply(500, "Server error");

    const items = await fetchRemoteOK(REMOTEOK_SOURCE);

    expect(items).toEqual([]);
  });

  it("returns empty when no relevant jobs", async () => {
    fetchMock
      .get("https://remoteok.com")
      .intercept({ method: "GET", path: "/api" })
      .reply(
        200,
        remoteokResponse([
          {
            position: "DevOps Engineer",
            company: "InfraCo",
            tags: ["aws", "docker"],
            url: "https://remoteok.com/jobs/1",
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchRemoteOK(REMOTEOK_SOURCE);

    expect(items).toEqual([]);
  });

  it("returns empty array when API returns non-array", async () => {
    fetchMock
      .get("https://remoteok.com")
      .intercept({ method: "GET", path: "/api" })
      .reply(200, JSON.stringify({ error: "rate limited" }), {
        headers: { "content-type": "application/json" },
      });

    const items = await fetchRemoteOK(REMOTEOK_SOURCE);

    expect(items).toEqual([]);
  });

  it("limits results to 20 items", async () => {
    const manyJobs = Array.from({ length: 25 }, (_, i) => ({
      position: `Job ${i}`,
      company: `Company ${i}`,
      tags: ["vue"],
      url: `https://remoteok.com/jobs/${i}`,
      epoch: 1738300800 + i,
    }));

    fetchMock
      .get("https://remoteok.com")
      .intercept({ method: "GET", path: "/api" })
      .reply(200, remoteokResponse(manyJobs), {
        headers: { "content-type": "application/json" },
      });

    const items = await fetchRemoteOK(REMOTEOK_SOURCE);

    expect(items).toHaveLength(20);
  });
});
