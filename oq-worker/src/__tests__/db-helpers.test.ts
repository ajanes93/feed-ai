import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { cleanAllTables } from "./helpers";
import { findCompletedCronRun } from "../index";

describe("Schema constraints", () => {
  beforeEach(() => cleanAllTables());

  describe("oq_scores unique date", () => {
    it("rejects duplicate dates", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_scores (id, date, score, score_technical, score_economic, delta, analysis, signals, pillar_scores, model_scores, model_agreement, model_spread, prompt_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          "s1",
          "2025-06-01",
          35,
          28,
          40,
          0,
          "A",
          "[]",
          "{}",
          "[]",
          "agree",
          0,
          "h1"
        )
        .run();

      await expect(
        env.DB.prepare(
          "INSERT INTO oq_scores (id, date, score, score_technical, score_economic, delta, analysis, signals, pillar_scores, model_scores, model_agreement, model_spread, prompt_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
          .bind(
            "s2",
            "2025-06-01",
            36,
            29,
            41,
            1,
            "B",
            "[]",
            "{}",
            "[]",
            "agree",
            0,
            "h2"
          )
          .run()
      ).rejects.toThrow();
    });
  });

  describe("oq_score_articles composite PK", () => {
    it("rejects duplicate score-article pairs", async () => {
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

  describe("cron idempotency guard", () => {
    it("finds completed cron run for today", async () => {
      const today = new Date().toISOString().split("T")[0];
      await env.DB.prepare(
        "INSERT INTO oq_cron_runs (id, started_at, completed_at, fetch_status, score_status) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(
          "cr1",
          `${today}T00:00:00Z`,
          `${today}T00:01:00Z`,
          "success",
          "success"
        )
        .run();

      const existing = await findCompletedCronRun(env.DB, today);
      expect(existing).not.toBeNull();
    });

    it("ignores partial success (score failed)", async () => {
      const today = new Date().toISOString().split("T")[0];
      await env.DB.prepare(
        "INSERT INTO oq_cron_runs (id, started_at, completed_at, fetch_status, score_status, error) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind(
          "cr1",
          `${today}T00:00:00Z`,
          `${today}T00:01:00Z`,
          "success",
          "failed",
          "Score generation failed"
        )
        .run();

      const existing = await findCompletedCronRun(env.DB, today);
      expect(existing).toBeNull();
    });

    it("ignores runs from other days", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_cron_runs (id, started_at, completed_at, fetch_status, score_status) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(
          "cr1",
          "2020-01-01T00:00:00Z",
          "2020-01-01T00:01:00Z",
          "success",
          "success"
        )
        .run();

      const today = new Date().toISOString().split("T")[0];
      const existing = await findCompletedCronRun(env.DB, today);
      expect(existing).toBeNull();
    });
  });
});
