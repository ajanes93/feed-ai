import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/fetcher", () => ({
  fetchAllSources: vi.fn(),
}));
vi.mock("../services/summarizer", () => ({
  generateDigest: vi.fn(),
}));
vi.mock("../services/logger", () => ({
  logEvent: vi.fn().mockResolvedValue(undefined),
  recordAIUsage: vi.fn().mockResolvedValue(undefined),
}));

import app from "../index";
import { mockDB, makeEnv, makeRequest } from "./helpers";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("API routes", () => {
  it("GET /api/today redirects to today's digest", async () => {
    const res = await app.fetch(makeRequest("/api/today"), makeEnv());

    expect(res.status).toBe(302);
    const today = new Date().toISOString().split("T")[0];
    expect(res.headers.get("location")).toBe(`/api/digest/${today}`);
  });

  it("GET /api/digest/:date returns 404 when no digest exists", async () => {
    const res = await app.fetch(makeRequest("/api/digest/2025-01-28"), makeEnv());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("No digest");
  });

  it("GET /api/digest/:date returns digest with items", async () => {
    const digestRow = { id: "digest-2025-01-28", date: "2025-01-28", item_count: 2 };
    const itemRows = [
      { id: "i1", category: "ai", title: "AI News", summary: "Big AI", why_it_matters: null, source_name: "HN", source_url: "https://hn.com/1", published_at: null, position: 0 },
      { id: "i2", category: "dev", title: "Vue 4", summary: "New Vue", why_it_matters: "Vue dev", source_name: "Vue", source_url: "https://vue.com/1", published_at: null, position: 1 },
    ];

    const mockFirst = vi.fn().mockResolvedValue(digestRow);
    const mockAll = vi.fn().mockResolvedValue({ results: itemRows });
    const db = mockDB({
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ first: mockFirst, all: mockAll }),
      }),
    });

    const res = await app.fetch(makeRequest("/api/digest/2025-01-28"), makeEnv(db));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("digest-2025-01-28");
    expect(body.items).toHaveLength(2);
    expect(body.items[0].title).toBe("AI News");
    expect(body.items[1].title).toBe("Vue 4");
  });

  it("GET /api/digests returns list of dates", async () => {
    const mockAll = vi.fn().mockResolvedValue({
      results: [
        { date: "2025-01-28", item_count: 10 },
        { date: "2025-01-27", item_count: 8 },
      ],
    });
    const db = mockDB({
      prepare: vi.fn().mockReturnValue({ all: mockAll }),
    });

    const res = await app.fetch(makeRequest("/api/digests"), makeEnv(db));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].date).toBe("2025-01-28");
  });

  it("POST /api/generate without auth does not return 200", async () => {
    const res = await app.fetch(
      makeRequest("/api/generate", { method: "POST" }),
      makeEnv(),
    );

    expect(res.status).not.toBe(200);
  });

  it("POST /api/rebuild without auth does not return 200", async () => {
    const res = await app.fetch(
      makeRequest("/api/rebuild", { method: "POST" }),
      makeEnv(),
    );

    expect(res.status).not.toBe(200);
  });

  it("GET /api/health returns source health", async () => {
    const mockAll = vi.fn().mockResolvedValue({ results: [] });
    const db = mockDB({
      prepare: vi.fn().mockReturnValue({ all: mockAll }),
    });

    const res = await app.fetch(makeRequest("/api/health"), makeEnv(db));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("GET /api/admin/dashboard returns dashboard data", async () => {
    const mockAll = vi.fn().mockResolvedValue({ results: [] });
    const mockFirst = vi.fn().mockResolvedValue({ count: 5 });
    const db = mockDB({
      prepare: vi.fn().mockReturnValue({
        all: mockAll,
        first: mockFirst,
        bind: vi.fn().mockReturnValue({ all: mockAll, first: mockFirst }),
      }),
    });

    const res = await app.fetch(makeRequest("/api/admin/dashboard"), makeEnv(db));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("ai");
    expect(body).toHaveProperty("sources");
    expect(body).toHaveProperty("errors");
    expect(body).toHaveProperty("totalDigests");
  });
});
