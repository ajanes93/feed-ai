import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { cleanAllTables } from "./helpers";

describe("OQ API routes", () => {
  beforeEach(() => cleanAllTables());

  describe("GET /api/today", () => {
    it("returns seed data when no score exists", async () => {
      const res = await SELF.fetch("http://localhost/api/today");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.score).toBe(32);
      expect(data.isSeed).toBe(true);
    });

    it("returns stored score when one exists", async () => {
      const today = new Date().toISOString().split("T")[0];
      await env.DB.prepare(
        "INSERT INTO oq_scores (id, date, score, score_technical, score_economic, delta, analysis, signals, pillar_scores, model_scores, model_agreement, model_spread, prompt_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          "test-id",
          today,
          35,
          28,
          40,
          0.5,
          "Test analysis",
          "[]",
          "{}",
          "[]",
          "agree",
          0.3,
          "abc123"
        )
        .run();

      const res = await SELF.fetch("http://localhost/api/today");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.score).toBe(35);
      expect(data.delta).toBe(0.5);
    });
  });

  describe("GET /api/history", () => {
    it("returns score history", async () => {
      await env.DB.prepare(
        "INSERT INTO oq_scores (id, date, score, score_technical, score_economic, delta, analysis, signals, pillar_scores, model_scores, model_agreement, model_spread, prompt_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          "h1",
          "2025-01-01",
          32,
          25,
          38,
          0,
          "Day 1",
          "[]",
          "{}",
          "[]",
          "partial",
          0,
          "hash1"
        )
        .run();

      const res = await SELF.fetch("http://localhost/api/history?d=7");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(1);
      expect(data[0].score).toBe(32);
    });
  });

  describe("POST /api/subscribe", () => {
    it("subscribes a valid email", async () => {
      const res = await SELF.fetch("http://localhost/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it("rejects invalid email", async () => {
      const res = await SELF.fetch("http://localhost/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      });
      expect(res.status).toBe(400);
    });

    it("handles duplicate subscriptions", async () => {
      const body = JSON.stringify({ email: "dupe@example.com" });
      const headers = { "Content-Type": "application/json" };
      await SELF.fetch("http://localhost/api/subscribe", {
        method: "POST",
        headers,
        body,
      });
      const res = await SELF.fetch("http://localhost/api/subscribe", {
        method: "POST",
        headers,
        body,
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });

  describe("GET /api/methodology", () => {
    it("returns methodology info", async () => {
      const res = await SELF.fetch("http://localhost/api/methodology");
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pillars).toHaveLength(5);
      expect(data.formula.models).toHaveLength(3);
      expect(data.startingScore).toBe(32);
    });
  });

  describe("admin endpoints require auth", () => {
    it("POST /api/fetch returns 401 without auth", async () => {
      const res = await SELF.fetch("http://localhost/api/fetch", {
        method: "POST",
      });
      expect(res.status).toBe(401);
    });

    it("POST /api/score returns 401 without auth", async () => {
      const res = await SELF.fetch("http://localhost/api/score", {
        method: "POST",
      });
      expect(res.status).toBe(401);
    });
  });
});
