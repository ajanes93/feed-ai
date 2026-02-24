import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { env, fetchMock } from "cloudflare:test";
import { app } from "../index";
import { seedDigest, seedLog, seedLogs } from "./helpers";

beforeEach(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.deactivate();
});

describe("API routes", () => {
  it("GET /api/today redirects to today's digest", async () => {
    const res = await app.request("/api/today", {}, env);

    expect(res.status).toBe(302);
    const today = new Date().toISOString().split("T")[0];
    expect(res.headers.get("location")).toBe(`/api/digest/${today}`);
  });

  it("GET /api/digest/:date returns 404 when no digest exists", async () => {
    const res = await app.request("/api/digest/2025-01-28", {}, env);

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("No digest");
  });

  it("GET /api/digest/:date returns digest with items", async () => {
    await seedDigest(
      env.DB,
      { id: "digest-2025-01-28", date: "2025-01-28", itemCount: 2 },
      [
        {
          id: "i1",
          category: "ai",
          title: "AI News",
          summary: "Big AI",
          sourceName: "HN",
          sourceUrl: "https://hn.com/1",
          position: 0,
        },
        {
          id: "i2",
          category: "dev",
          title: "Vue 4",
          summary: "New Vue",
          sourceName: "Vue",
          sourceUrl: "https://vue.com/1",
          position: 1,
          whyItMatters: "Vue dev",
        },
      ]
    );

    const res = await app.request("/api/digest/2025-01-28", {}, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      items: { title: string; whyItMatters?: string }[];
    };
    expect(body.id).toBe("digest-2025-01-28");
    expect(body.items).toHaveLength(2);
    expect(body.items[0].title).toBe("Vue 4");
    expect(body.items[0].whyItMatters).toBe("Vue dev");
    expect(body.items[1].title).toBe("AI News");
  });

  it("GET /api/digests returns list of dates", async () => {
    await seedDigest(env.DB, { id: "d1", date: "2025-01-28", itemCount: 1 }, [
      {
        id: "i1",
        category: "ai",
        title: "T",
        summary: "S",
        sourceName: "N",
        sourceUrl: "https://x.com",
        position: 0,
      },
    ]);
    await seedDigest(env.DB, { id: "d2", date: "2025-01-27", itemCount: 1 }, [
      {
        id: "i2",
        category: "ai",
        title: "T",
        summary: "S",
        sourceName: "N",
        sourceUrl: "https://x.com",
        position: 0,
      },
    ]);

    const res = await app.request("/api/digests", {}, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { date: string }[];
    expect(body).toHaveLength(2);
    expect(body[0].date).toBe("2025-01-28");
    expect(body[1].date).toBe("2025-01-27");
  });

  it("POST /api/generate requires auth", async () => {
    const res = await app.request("/api/generate", { method: "POST" }, env);

    expect(res.status).toBe(401);
  });

  it("POST /api/generate rejects wrong token", async () => {
    const res = await app.request(
      "/api/generate",
      { method: "POST", headers: { Authorization: "Bearer wrong-key" } },
      env
    );

    expect(res.status).toBe(401);
  });

  it("POST /api/rebuild requires auth", async () => {
    const res = await app.request("/api/rebuild", { method: "POST" }, env);

    expect(res.status).toBe(401);
  });

  it("POST /api/fetch requires auth", async () => {
    const res = await app.request("/api/fetch", { method: "POST" }, env);

    expect(res.status).toBe(401);
  });

  it("POST /api/fetch rejects wrong token", async () => {
    const res = await app.request(
      "/api/fetch",
      { method: "POST", headers: { Authorization: "Bearer wrong-key" } },
      env
    );

    expect(res.status).toBe(401);
  });

  it("GET /api/health returns source health", async () => {
    const res = await app.request("/api/health", {}, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });

  it("GET /api/admin/dashboard returns dashboard data", async () => {
    const res = await app.request(
      "/api/admin/dashboard",
      { headers: { Authorization: "Bearer test-admin-key" } },
      env
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("ai");
    expect(body).toHaveProperty("sources");
    expect(body).toHaveProperty("errors");
    expect(body.totalDigests).toBe(0);
  });

  it("GET /api/admin/dashboard includes seeded digest count", async () => {
    await seedDigest(
      env.DB,
      { id: "d-dash", date: "2025-01-20", itemCount: 1 },
      [
        {
          id: "i-dash",
          category: "ai",
          title: "T",
          summary: "S",
          sourceName: "N",
          sourceUrl: "https://x.com",
          position: 0,
        },
      ]
    );

    const res = await app.request(
      "/api/admin/dashboard",
      { headers: { Authorization: "Bearer test-admin-key" } },
      env
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { totalDigests: number };
    expect(body.totalDigests).toBeGreaterThan(0);
  });

  it("GET /api/admin/logs returns empty logs", async () => {
    const res = await app.request(
      "/api/admin/logs",
      { headers: { Authorization: "Bearer test-admin-key" } },
      env
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { count: number; logs: unknown[] };
    expect(body.count).toBe(0);
    expect(body.logs).toEqual([]);
  });

  it("GET /api/admin/logs returns seeded logs", async () => {
    await seedLog(env.DB, {
      id: "log-1",
      level: "error",
      category: "fetch",
      message: "Test error",
    });

    const res = await app.request(
      "/api/admin/logs",
      { headers: { Authorization: "Bearer test-admin-key" } },
      env
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      count: number;
      logs: { message: string }[];
    };
    expect(body.count).toBe(1);
    expect(body.logs[0].message).toBe("Test error");
  });

  it("GET /api/admin/logs filters by level", async () => {
    await seedLogs(env.DB, [
      { id: "log-info", level: "info", category: "fetch", message: "Info msg" },
      {
        id: "log-err",
        level: "error",
        category: "fetch",
        message: "Error msg",
      },
    ]);

    const res = await app.request(
      "/api/admin/logs?level=error",
      { headers: { Authorization: "Bearer test-admin-key" } },
      env
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      count: number;
      logs: { level: string }[];
    };
    expect(body.logs.every((l) => l.level === "error")).toBe(true);
  });

  it("POST /api/generate accepts valid auth", async () => {
    // Seed existing digest so generate returns early without needing fetch mocks
    const today = new Date().toISOString().split("T")[0];
    await seedDigest(
      env.DB,
      { id: `digest-${today}`, date: today, itemCount: 1 },
      [
        {
          id: "i-existing",
          category: "ai",
          title: "T",
          summary: "S",
          sourceName: "N",
          sourceUrl: "https://x.com",
          position: 0,
        },
      ]
    );

    const res = await app.request(
      "/api/generate",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-admin-key" },
      },
      env
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("already exists");
  });

  it("POST /api/rebuild accepts valid auth", async () => {
    // Seed existing digest so rebuild deletes it; will fail at fetch but auth passes
    const today = new Date().toISOString().split("T")[0];
    await seedDigest(
      env.DB,
      { id: `digest-${today}`, date: today, itemCount: 1 },
      [
        {
          id: "i-rebuild",
          category: "ai",
          title: "T",
          summary: "S",
          sourceName: "N",
          sourceUrl: "https://x.com",
          position: 0,
        },
      ]
    );

    const res = await app.request(
      "/api/rebuild",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-admin-key" },
      },
      env
    );

    // Auth passed — gets past 401. May be 500 (no fetch mocks) but not 401.
    expect(res.status).not.toBe(401);
  });
});

describe("CORS", () => {
  it("preflight allows Authorization header for POST endpoints", async () => {
    const res = await app.request(
      "/api/rebuild",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://feed-ai.andresjanes.com",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Authorization",
        },
      },
      env
    );

    expect(res.status).toBe(204);
    const allowHeaders = res.headers.get("Access-Control-Allow-Headers");
    expect(allowHeaders).toContain("Authorization");
  });

  it.each([
    "https://feed-ai.andresjanes.com",
    "https://other.andresjanes.com",
    "https://abc123.andresjanes.pages.dev",
    "http://localhost:5173",
  ])("allows origin %s", async (origin) => {
    const res = await app.request(
      "/api/health",
      {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "GET",
        },
      },
      env
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  });

  it.each([
    "https://evil.com",
    "https://notandresjanes.com",
    "https://evil.pages.dev",
  ])("rejects origin %s", async (origin) => {
    const res = await app.request(
      "/api/health",
      {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "GET",
        },
      },
      env
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeFalsy();
  });
});
