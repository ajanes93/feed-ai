import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { app } from "../index";
import { seedDigest } from "./helpers";

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
    expect(body.items[0].title).toBe("AI News");
    expect(body.items[1].title).toBe("Vue 4");
    expect(body.items[1].whyItMatters).toBe("Vue dev");
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

  it("GET /api/health returns source health", async () => {
    const res = await app.request("/api/health", {}, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });

  it("GET /api/admin/dashboard returns dashboard data", async () => {
    const res = await app.request("/api/admin/dashboard", {}, env);

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("ai");
    expect(body).toHaveProperty("sources");
    expect(body).toHaveProperty("errors");
    expect(body.totalDigests).toBe(0);
  });
});
