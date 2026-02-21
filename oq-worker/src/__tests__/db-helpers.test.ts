import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";

describe("D1 helper functions", () => {
  beforeEach(async () => {
    await env.DB.exec("DELETE FROM oq_scores");
    await env.DB.exec("DELETE FROM oq_articles");
    await env.DB.exec("DELETE FROM oq_ai_usage");
    await env.DB.exec("DELETE FROM oq_external_data_history");
    await env.DB.exec("DELETE FROM oq_model_responses");
    await env.DB.exec("DELETE FROM oq_score_articles");
    await env.DB.exec("DELETE FROM oq_cron_runs");
    await env.DB.exec("DELETE FROM oq_fetch_errors");
    await env.DB.exec("DELETE FROM oq_admin_actions");
    await env.DB.exec("DELETE FROM oq_logs");
  });

  // --- storeExternalData (tested via direct DB operations matching the function's logic) ---

  describe("external data deduplication", () => {
    it("stores external data with auto-generated id", async () => {
      const id = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO oq_external_data_history (id, key, value) VALUES (?, ?, ?)"
      )
        .bind(id, "sanity_harness", '{"topPassRate":42}')
        .run();

      const row = await env.DB.prepare(
        "SELECT * FROM oq_external_data_history WHERE key = ?"
      )
        .bind("sanity_harness")
        .first();
      expect(row).not.toBeNull();
      expect(row!.key).toBe("sanity_harness");
      expect(JSON.parse(row!.value as string)).toEqual({ topPassRate: 42 });
    });

    it("allows same key on different days", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_external_data_history (id, key, value, fetched_at) VALUES (?, ?, ?, ?)"
      )
        .bind("e1", "sanity_harness", '{"v":1}', "2025-01-01 00:00:00")
        .run();
      await env.DB.prepare(
        "INSERT INTO oq_external_data_history (id, key, value, fetched_at) VALUES (?, ?, ?, ?)"
      )
        .bind("e2", "sanity_harness", '{"v":2}', "2025-01-02 00:00:00")
        .run();

      const rows = await env.DB.prepare(
        "SELECT * FROM oq_external_data_history WHERE key = ? ORDER BY fetched_at DESC"
      )
        .bind("sanity_harness")
        .all();
      expect(rows.results).toHaveLength(2);
    });
  });

  // --- loadExternalData behavior (tested via direct SQL) ---

  describe("external data loading", () => {
    it("loads latest external data by key", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_external_data_history (id, key, value, fetched_at) VALUES (?, ?, ?, ?)"
      )
        .bind("e1", "sanity_harness", '{"topPassRate":40}', "2025-01-01 00:00:00")
        .run();
      await env.DB.prepare(
        "INSERT INTO oq_external_data_history (id, key, value, fetched_at) VALUES (?, ?, ?, ?)"
      )
        .bind("e2", "sanity_harness", '{"topPassRate":42}', "2025-01-02 00:00:00")
        .run();

      const latest = await env.DB.prepare(
        "SELECT value FROM oq_external_data_history WHERE key = ? ORDER BY fetched_at DESC LIMIT 1"
      )
        .bind("sanity_harness")
        .first();
      expect(JSON.parse(latest!.value as string).topPassRate).toBe(42);
    });

    it("returns null when no data for key", async () => {
      const row = await env.DB.prepare(
        "SELECT value FROM oq_external_data_history WHERE key = ? ORDER BY fetched_at DESC LIMIT 1"
      )
        .bind("nonexistent")
        .first();
      expect(row).toBeNull();
    });
  });

  // --- saveScore ---

  describe("saveScore", () => {
    it("inserts a score row with all columns", async () => {
      const id = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO oq_scores (id, date, score, score_technical, score_economic, delta, analysis, signals, pillar_scores, model_scores, model_agreement, model_spread, capability_gap, prompt_hash, external_data, is_decay, data_quality_flags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          id,
          "2025-06-01",
          35,
          28,
          40,
          0.5,
          "Test analysis",
          '[{"text":"signal","impact":0.3}]',
          '{"capability":30}',
          '[{"model":"claude","delta":0.5}]',
          "agree",
          0.3,
          "SWE-bench: 79%",
          "abc123",
          '{"sanityHarness":{"topPassRate":42}}',
          0,
          '["sparse_pillars"]'
        )
        .run();

      const row = await env.DB.prepare(
        "SELECT * FROM oq_scores WHERE id = ?"
      )
        .bind(id)
        .first();
      expect(row).not.toBeNull();
      expect(row!.score).toBe(35);
      expect(row!.score_technical).toBe(28);
      expect(row!.score_economic).toBe(40);
      expect(row!.delta).toBe(0.5);
      expect(row!.model_agreement).toBe("agree");
      expect(row!.is_decay).toBe(0);
      expect(row!.data_quality_flags).toBe('["sparse_pillars"]');
    });

    it("enforces unique date constraint", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_scores (id, date, score, score_technical, score_economic, delta, analysis, signals, pillar_scores, model_scores, model_agreement, model_spread, prompt_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind("s1", "2025-06-01", 35, 28, 40, 0, "A", "[]", "{}", "[]", "agree", 0, "h1")
        .run();

      await expect(
        env.DB.prepare(
          "INSERT INTO oq_scores (id, date, score, score_technical, score_economic, delta, analysis, signals, pillar_scores, model_scores, model_agreement, model_spread, prompt_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
          .bind("s2", "2025-06-01", 36, 29, 41, 1, "B", "[]", "{}", "[]", "agree", 0, "h2")
          .run()
      ).rejects.toThrow();
    });
  });

  // --- logCronRun ---

  describe("logCronRun", () => {
    it("inserts a cron run record", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_cron_runs (id, started_at, completed_at, fetch_status, fetch_articles, fetch_errors, score_status, score_result, external_fetch_status, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          "cr1",
          "2025-06-01T00:00:00Z",
          "2025-06-01T00:01:00Z",
          "success",
          15,
          null,
          "success",
          '{"score":35}',
          '{"sanity":"success"}',
          null
        )
        .run();

      const row = await env.DB.prepare(
        "SELECT * FROM oq_cron_runs WHERE id = ?"
      )
        .bind("cr1")
        .first();
      expect(row).not.toBeNull();
      expect(row!.fetch_status).toBe("success");
      expect(row!.score_status).toBe("success");
      expect(row!.fetch_articles).toBe(15);
    });

    it("supports INSERT OR REPLACE for same id", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_cron_runs (id, started_at, fetch_status, score_status) VALUES (?, ?, ?, ?)"
      )
        .bind("cr1", "2025-06-01T00:00:00Z", "pending", "pending")
        .run();

      await env.DB.prepare(
        "INSERT OR REPLACE INTO oq_cron_runs (id, started_at, completed_at, fetch_status, fetch_articles, fetch_errors, score_status, score_result, external_fetch_status, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind("cr1", "2025-06-01T00:00:00Z", "2025-06-01T00:01:00Z", "success", 10, null, "success", null, null, null)
        .run();

      const rows = await env.DB.prepare(
        "SELECT * FROM oq_cron_runs WHERE id = ?"
      )
        .bind("cr1")
        .all();
      expect(rows.results).toHaveLength(1);
      expect(rows.results[0].fetch_status).toBe("success");
    });
  });

  // --- logAdminAction ---

  describe("logAdminAction", () => {
    it("inserts an admin action record", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_admin_actions (id, action, endpoint, result_status, result_summary) VALUES (?, ?, ?, ?, ?)"
      )
        .bind("aa1", "fetch", "/api/fetch", 200, '{"fetched":10}')
        .run();

      const row = await env.DB.prepare(
        "SELECT * FROM oq_admin_actions WHERE id = ?"
      )
        .bind("aa1")
        .first();
      expect(row).not.toBeNull();
      expect(row!.action).toBe("fetch");
      expect(row!.result_status).toBe(200);
    });
  });

  // --- persistFetchErrors ---

  describe("persistFetchErrors", () => {
    it("inserts fetch error records", async () => {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO oq_fetch_errors (id, source_id, error_type, error_message, http_status) VALUES (?, ?, ?, ?, ?)"
        ).bind("fe1", "oq-anthropic", "http_error", "HTTP 404", 404),
        env.DB.prepare(
          "INSERT INTO oq_fetch_errors (id, source_id, error_type, error_message, http_status) VALUES (?, ?, ?, ?, ?)"
        ).bind("fe2", "oq-arxiv", "parse_error", "Invalid XML", null),
      ]);

      const rows = await env.DB.prepare(
        "SELECT * FROM oq_fetch_errors ORDER BY source_id"
      ).all();
      expect(rows.results).toHaveLength(2);
      expect(rows.results[0].error_type).toBe("http_error");
      expect(rows.results[0].http_status).toBe(404);
      expect(rows.results[1].error_type).toBe("parse_error");
      expect(rows.results[1].http_status).toBeNull();
    });
  });

  // --- Score-article linkage ---

  describe("score-article linkage", () => {
    it("links articles to a score", async () => {
      // Create a score
      await env.DB.prepare(
        "INSERT INTO oq_scores (id, date, score, score_technical, score_economic, delta, analysis, signals, pillar_scores, model_scores, model_agreement, model_spread, prompt_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind("s1", "2025-06-01", 35, 28, 40, 0, "A", "[]", "{}", "[]", "agree", 0, "h1")
        .run();

      // Create articles
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO oq_articles (id, title, url, source, pillar, published_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind("a1", "Article 1", "https://example.com/1", "Test", "capability", "2025-06-01"),
        env.DB.prepare(
          "INSERT INTO oq_articles (id, title, url, source, pillar, published_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind("a2", "Article 2", "https://example.com/2", "Test", "sentiment", "2025-06-01"),
      ]);

      // Link them
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO oq_score_articles (score_id, article_id) VALUES (?, ?)"
        ).bind("s1", "a1"),
        env.DB.prepare(
          "INSERT INTO oq_score_articles (score_id, article_id) VALUES (?, ?)"
        ).bind("s1", "a2"),
      ]);

      const links = await env.DB.prepare(
        "SELECT * FROM oq_score_articles WHERE score_id = ?"
      )
        .bind("s1")
        .all();
      expect(links.results).toHaveLength(2);
    });

    it("enforces composite primary key", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_score_articles (score_id, article_id) VALUES (?, ?)"
      )
        .bind("s1", "a1")
        .run();

      await expect(
        env.DB.prepare(
          "INSERT INTO oq_score_articles (score_id, article_id) VALUES (?, ?)"
        )
          .bind("s1", "a1")
          .run()
      ).rejects.toThrow();
    });
  });

  // --- Model responses ---

  describe("model responses", () => {
    it("stores model response with all fields", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_model_responses (id, score_id, model, provider, raw_response, pillar_scores, technical_delta, economic_delta, suggested_delta, analysis, top_signals) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          "mr1",
          "s1",
          "claude-sonnet",
          "anthropic",
          '{"raw":"data"}',
          '{"capability":30}',
          0.5,
          0.3,
          0.8,
          "Test analysis",
          '[{"text":"signal"}]'
        )
        .run();

      const row = await env.DB.prepare(
        "SELECT * FROM oq_model_responses WHERE id = ?"
      )
        .bind("mr1")
        .first();
      expect(row).not.toBeNull();
      expect(row!.model).toBe("claude-sonnet");
      expect(row!.suggested_delta).toBe(0.8);
    });
  });

  // --- Cron idempotency guard ---

  describe("cron idempotency", () => {
    it("finds completed cron run for today", async () => {
      const today = new Date().toISOString().split("T")[0];
      await env.DB.prepare(
        "INSERT INTO oq_cron_runs (id, started_at, completed_at, fetch_status, score_status) VALUES (?, ?, ?, ?, ?)"
      )
        .bind("cr1", `${today}T00:00:00Z`, `${today}T00:01:00Z`, "success", "success")
        .run();

      const existing = await env.DB.prepare(
        "SELECT id FROM oq_cron_runs WHERE date(started_at) = ? AND fetch_status = 'success' AND score_status = 'success' LIMIT 1"
      )
        .bind(today)
        .first();
      expect(existing).not.toBeNull();
    });

    it("does NOT find run when only fetch succeeded (score failed)", async () => {
      const today = new Date().toISOString().split("T")[0];
      await env.DB.prepare(
        "INSERT INTO oq_cron_runs (id, started_at, completed_at, fetch_status, score_status, error) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind("cr1", `${today}T00:00:00Z`, `${today}T00:01:00Z`, "success", "failed", "Score generation failed")
        .run();

      const existing = await env.DB.prepare(
        "SELECT id FROM oq_cron_runs WHERE date(started_at) = ? AND fetch_status = 'success' AND score_status = 'success' LIMIT 1"
      )
        .bind(today)
        .first();
      expect(existing).toBeNull();
    });

    it("does NOT find run from a different day", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_cron_runs (id, started_at, completed_at, fetch_status, score_status) VALUES (?, ?, ?, ?, ?)"
      )
        .bind("cr1", "2020-01-01T00:00:00Z", "2020-01-01T00:01:00Z", "success", "success")
        .run();

      const today = new Date().toISOString().split("T")[0];
      const existing = await env.DB.prepare(
        "SELECT id FROM oq_cron_runs WHERE date(started_at) = ? AND fetch_status = 'success' AND score_status = 'success' LIMIT 1"
      )
        .bind(today)
        .first();
      expect(existing).toBeNull();
    });
  });

  // --- Logs table ---

  describe("oq_logs table", () => {
    it("auto-generates created_at timestamp", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_logs (id, level, category, message) VALUES (?, ?, ?, ?)"
      )
        .bind("l1", "info", "test", "Hello")
        .run();

      const row = await env.DB.prepare(
        "SELECT * FROM oq_logs WHERE id = ?"
      )
        .bind("l1")
        .first();
      expect(row!.created_at).toBeTruthy();
    });

    it("supports level+created_at index for filtering", async () => {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO oq_logs (id, level, category, message) VALUES (?, ?, ?, ?)"
        ).bind("l1", "info", "a", "msg1"),
        env.DB.prepare(
          "INSERT INTO oq_logs (id, level, category, message) VALUES (?, ?, ?, ?)"
        ).bind("l2", "error", "b", "msg2"),
        env.DB.prepare(
          "INSERT INTO oq_logs (id, level, category, message) VALUES (?, ?, ?, ?)"
        ).bind("l3", "info", "c", "msg3"),
      ]);

      const errorLogs = await env.DB.prepare(
        "SELECT * FROM oq_logs WHERE level = ? ORDER BY created_at DESC"
      )
        .bind("error")
        .all();
      expect(errorLogs.results).toHaveLength(1);
      expect(errorLogs.results[0].category).toBe("b");
    });
  });

  // --- Data retention queries ---

  describe("data retention", () => {
    it("deletes old articles", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_articles (id, title, url, source, pillar, published_at, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
        .bind("a1", "Old", "https://old.com", "Test", "capability", "2020-01-01", "2020-01-01 00:00:00")
        .run();
      await env.DB.prepare(
        "INSERT INTO oq_articles (id, title, url, source, pillar, published_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind("a2", "Recent", "https://recent.com", "Test", "capability", "2025-06-01")
        .run();

      await env.DB.prepare(
        "DELETE FROM oq_articles WHERE fetched_at < datetime('now', '-90 days')"
      ).run();

      const rows = await env.DB.prepare("SELECT * FROM oq_articles").all();
      expect(rows.results).toHaveLength(1);
      expect(rows.results[0].title).toBe("Recent");
    });

    it("deletes old fetch errors", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_fetch_errors (id, source_id, error_type, error_message, attempted_at) VALUES (?, ?, ?, ?, ?)"
      )
        .bind("fe1", "src", "http_error", "old error", "2020-01-01 00:00:00")
        .run();

      await env.DB.prepare(
        "DELETE FROM oq_fetch_errors WHERE attempted_at < datetime('now', '-30 days')"
      ).run();

      const rows = await env.DB.prepare("SELECT * FROM oq_fetch_errors").all();
      expect(rows.results).toHaveLength(0);
    });

    it("deletes old logs", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_logs (id, level, category, message, created_at) VALUES (?, ?, ?, ?, ?)"
      )
        .bind("l1", "info", "test", "old log", "2020-01-01 00:00:00")
        .run();

      await env.DB.prepare(
        "DELETE FROM oq_logs WHERE created_at < datetime('now', '-30 days')"
      ).run();

      const rows = await env.DB.prepare("SELECT * FROM oq_logs").all();
      expect(rows.results).toHaveLength(0);
    });
  });
});
