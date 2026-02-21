import { env, fetchMock, SELF } from "cloudflare:test";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  cleanAllTables,
  buildSanityHtml,
  mockSanityHarness,
  mockSanityHarnessError,
} from "./helpers";

const AUTH_HEADERS = {
  Authorization: "Bearer test-admin-key",
};

describe("Admin API routes", () => {
  beforeEach(() => cleanAllTables());
  afterEach(() => fetchMock.deactivate());

  // --- Auth coverage ---

  describe("auth middleware", () => {
    const protectedEndpoints = [
      { method: "GET", url: "/api/admin/dashboard" },
      { method: "GET", url: "/api/admin/external-history" },
      { method: "GET", url: "/api/admin/logs" },
      { method: "POST", url: "/api/fetch-sanity" },
      { method: "POST", url: "/api/fetch-swebench" },
      { method: "POST", url: "/api/fetch-fred" },
    ];

    for (const { method, url } of protectedEndpoints) {
      it(`${method} ${url} returns 401 without auth`, async () => {
        const res = await SELF.fetch(`http://localhost${url}`, { method });
        expect(res.status).toBe(401);
      });
    }

    it("returns 401 with wrong token", async () => {
      const res = await SELF.fetch("http://localhost/api/admin/dashboard", {
        headers: { Authorization: "Bearer wrong-key" },
      });
      expect(res.status).toBe(401);
    });

    it("returns 200 with correct token", async () => {
      const res = await SELF.fetch("http://localhost/api/admin/dashboard", {
        headers: AUTH_HEADERS,
      });
      expect(res.status).toBe(200);
    });
  });

  // --- Dashboard ---

  describe("GET /api/admin/dashboard", () => {
    it("returns empty dashboard data", async () => {
      const res = await SELF.fetch("http://localhost/api/admin/dashboard", {
        headers: AUTH_HEADERS,
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ai.recentCalls).toEqual([]);
      expect(data.ai.totalTokens).toBe(0);
      expect(data.sources).toEqual([]);
      expect(data.totalScores).toBe(0);
      expect(data.totalArticles).toBe(0);
      expect(data.totalSubscribers).toBe(0);
    });

    it("returns populated dashboard data", async () => {
      // Seed some data
      await env.DB.prepare(
        "INSERT INTO oq_ai_usage (id, model, provider, input_tokens, output_tokens, total_tokens, latency_ms, was_fallback, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          "u1",
          "claude-sonnet",
          "anthropic",
          100,
          50,
          150,
          500,
          0,
          "success"
        )
        .run();

      await env.DB.prepare(
        "INSERT INTO oq_articles (id, title, url, source, pillar, summary, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          "a1",
          "Test Article",
          "https://example.com/1",
          "TestSource",
          "capability",
          "Summary",
          "2025-06-01"
        )
        .run();

      await env.DB.prepare(
        "INSERT INTO oq_subscribers (id, email) VALUES (?, ?)"
      )
        .bind("s1", "test@test.com")
        .run();

      const res = await SELF.fetch("http://localhost/api/admin/dashboard", {
        headers: AUTH_HEADERS,
      });
      const data = await res.json();
      expect(data.ai.recentCalls).toHaveLength(1);
      expect(data.ai.recentCalls[0].model).toBe("claude-sonnet");
      expect(data.ai.totalTokens).toBe(150);
      expect(data.sources).toHaveLength(1);
      expect(data.totalArticles).toBe(1);
      expect(data.totalSubscribers).toBe(1);
    });
  });

  // --- External history ---

  describe("GET /api/admin/external-history", () => {
    it("returns empty array when no data exists", async () => {
      const res = await SELF.fetch(
        "http://localhost/api/admin/external-history",
        { headers: AUTH_HEADERS }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual([]);
    });

    it("returns external data history", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_external_data_history (id, key, value) VALUES (?, ?, ?)"
      )
        .bind("e1", "sanity_harness", '{"topPassRate":42}')
        .run();

      const res = await SELF.fetch(
        "http://localhost/api/admin/external-history",
        { headers: AUTH_HEADERS }
      );
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].key).toBe("sanity_harness");
      expect(data[0].value.topPassRate).toBe(42);
    });

    it("filters by key", async () => {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO oq_external_data_history (id, key, value) VALUES (?, ?, ?)"
        ).bind("e1", "sanity_harness", '{"a":1}'),
        env.DB.prepare(
          "INSERT INTO oq_external_data_history (id, key, value) VALUES (?, ?, ?)"
        ).bind("e2", "swe_bench", '{"b":2}'),
      ]);

      const res = await SELF.fetch(
        "http://localhost/api/admin/external-history?key=swe_bench",
        { headers: AUTH_HEADERS }
      );
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].key).toBe("swe_bench");
    });

    it("respects limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        await env.DB.prepare(
          "INSERT INTO oq_external_data_history (id, key, value) VALUES (?, ?, ?)"
        )
          .bind(`e${i}`, "sanity_harness", `{"i":${i}}`)
          .run();
      }

      const res = await SELF.fetch(
        "http://localhost/api/admin/external-history?limit=2",
        { headers: AUTH_HEADERS }
      );
      const data = await res.json();
      expect(data).toHaveLength(2);
    });

    it("handles NaN limit gracefully", async () => {
      const res = await SELF.fetch(
        "http://localhost/api/admin/external-history?limit=abc",
        { headers: AUTH_HEADERS }
      );
      expect(res.status).toBe(200);
    });
  });

  // --- Logs ---

  describe("GET /api/admin/logs", () => {
    it("returns empty array when no logs exist", async () => {
      const res = await SELF.fetch("http://localhost/api/admin/logs", {
        headers: AUTH_HEADERS,
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual([]);
    });

    it("returns log entries", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_logs (id, level, category, message, details) VALUES (?, ?, ?, ?, ?)"
      )
        .bind("l1", "info", "test", "Test message", '{"key":"value"}')
        .run();

      const res = await SELF.fetch("http://localhost/api/admin/logs", {
        headers: AUTH_HEADERS,
      });
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].level).toBe("info");
      expect(data[0].category).toBe("test");
      expect(data[0].message).toBe("Test message");
      expect(data[0].details).toEqual({ key: "value" });
    });

    it("filters by level", async () => {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO oq_logs (id, level, category, message) VALUES (?, ?, ?, ?)"
        ).bind("l1", "info", "test", "Info msg"),
        env.DB.prepare(
          "INSERT INTO oq_logs (id, level, category, message) VALUES (?, ?, ?, ?)"
        ).bind("l2", "error", "test", "Error msg"),
        env.DB.prepare(
          "INSERT INTO oq_logs (id, level, category, message) VALUES (?, ?, ?, ?)"
        ).bind("l3", "warn", "test", "Warn msg"),
      ]);

      const res = await SELF.fetch(
        "http://localhost/api/admin/logs?level=error",
        { headers: AUTH_HEADERS }
      );
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].level).toBe("error");
    });

    it("filters by category", async () => {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO oq_logs (id, level, category, message) VALUES (?, ?, ?, ?)"
        ).bind("l1", "info", "cron", "Cron msg"),
        env.DB.prepare(
          "INSERT INTO oq_logs (id, level, category, message) VALUES (?, ?, ?, ?)"
        ).bind("l2", "info", "fetch", "Fetch msg"),
      ]);

      const res = await SELF.fetch(
        "http://localhost/api/admin/logs?category=cron",
        { headers: AUTH_HEADERS }
      );
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].category).toBe("cron");
    });

    it("filters by level and category combined", async () => {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO oq_logs (id, level, category, message) VALUES (?, ?, ?, ?)"
        ).bind("l1", "error", "cron", "Cron error"),
        env.DB.prepare(
          "INSERT INTO oq_logs (id, level, category, message) VALUES (?, ?, ?, ?)"
        ).bind("l2", "info", "cron", "Cron info"),
        env.DB.prepare(
          "INSERT INTO oq_logs (id, level, category, message) VALUES (?, ?, ?, ?)"
        ).bind("l3", "error", "fetch", "Fetch error"),
      ]);

      const res = await SELF.fetch(
        "http://localhost/api/admin/logs?level=error&category=cron",
        { headers: AUTH_HEADERS }
      );
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].message).toBe("Cron error");
    });

    it("respects limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        await env.DB.prepare(
          "INSERT INTO oq_logs (id, level, category, message) VALUES (?, ?, ?, ?)"
        )
          .bind(`l${i}`, "info", "test", `Msg ${i}`)
          .run();
      }

      const res = await SELF.fetch("http://localhost/api/admin/logs?limit=2", {
        headers: AUTH_HEADERS,
      });
      const data = await res.json();
      expect(data).toHaveLength(2);
    });

    it("handles NaN limit gracefully", async () => {
      const res = await SELF.fetch(
        "http://localhost/api/admin/logs?limit=abc",
        { headers: AUTH_HEADERS }
      );
      expect(res.status).toBe(200);
    });

    it("returns null details when details column is null", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_logs (id, level, category, message) VALUES (?, ?, ?, ?)"
      )
        .bind("l1", "info", "test", "No details")
        .run();

      const res = await SELF.fetch("http://localhost/api/admin/logs", {
        headers: AUTH_HEADERS,
      });
      const data = await res.json();
      expect(data[0].details).toBeNull();
    });
  });

  // --- adminHandler error branch ---

  describe("adminHandler error handling", () => {
    it("returns 500 and logs error when fetch-sanity fails", async () => {
      mockSanityHarnessError(500);

      const res = await SELF.fetch("http://localhost/api/fetch-sanity", {
        method: "POST",
        headers: AUTH_HEADERS,
      });
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain("HTTP 500");

      const logs = await env.DB.prepare(
        "SELECT * FROM oq_logs WHERE category = 'admin' AND level = 'error'"
      ).all();
      expect(logs.results).toHaveLength(1);
      expect(logs.results[0].message).toContain("fetch-sanity failed");
    });

    it("returns 503 when FRED_API_KEY not configured", async () => {
      const res = await SELF.fetch("http://localhost/api/fetch-fred", {
        method: "POST",
        headers: AUTH_HEADERS,
      });
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toBe("FRED_API_KEY not configured");
    });
  });

  // --- External data dedup ---

  describe("storeExternalData same-day dedup", () => {
    it("does not create duplicate rows when called twice on the same day", async () => {
      const html = buildSanityHtml([
        { rank: 1, agent: "Agent1", model: "GPT-4", score: 45, passRate: 42 },
        { rank: 2, agent: "Agent2", model: "Claude", score: 30, passRate: 28 },
      ]);

      // First call — stores data
      mockSanityHarness(html);
      const res1 = await SELF.fetch("http://localhost/api/fetch-sanity", {
        method: "POST",
        headers: AUTH_HEADERS,
      });
      expect(res1.status).toBe(200);
      fetchMock.deactivate();

      // Second call — storeExternalData should short-circuit
      mockSanityHarness(html);
      const res2 = await SELF.fetch("http://localhost/api/fetch-sanity", {
        method: "POST",
        headers: AUTH_HEADERS,
      });
      expect(res2.status).toBe(200);

      const rows = await env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM oq_external_data_history WHERE key = 'sanity_harness'"
      ).first();
      expect(rows!.cnt).toBe(1);
    });
  });

  // --- loadExternalData corrupt JSON resilience ---

  describe("loadExternalData corrupt JSON", () => {
    it("methodology endpoint still works with corrupt external data", async () => {
      // Insert corrupt JSON for each external data key
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO oq_external_data_history (id, key, value) VALUES (?, ?, ?)"
        ).bind("e1", "sanity_harness", "{broken"),
        env.DB.prepare(
          "INSERT INTO oq_external_data_history (id, key, value) VALUES (?, ?, ?)"
        ).bind("e2", "swe_bench", "not-json"),
        env.DB.prepare(
          "INSERT INTO oq_external_data_history (id, key, value) VALUES (?, ?, ?)"
        ).bind("e3", "fred_labour", "[invalid"),
      ]);

      // Methodology endpoint calls loadExternalData — should not crash
      const res = await SELF.fetch("http://localhost/api/methodology");
      expect(res.status).toBe(200);
      const data = await res.json();
      // Should still have capabilityGap with fallback values
      expect(data.capabilityGap).toBeTruthy();
      expect(data.capabilityGap.verified).toBe("~79%");
      expect(data.capabilityGap.bashOnly).toBe("~77%");
    });
  });
});
