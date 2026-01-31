import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { logEvent, recordAIUsage } from "../services/logger";

async function getLogByMessage(message: string) {
  return env.DB.prepare("SELECT * FROM error_logs WHERE message = ?")
    .bind(message)
    .first();
}

describe("logEvent", () => {
  it("inserts a log entry into the database", async () => {
    await logEvent(env.DB, {
      level: "error",
      category: "fetch",
      message: "Source failed",
    });

    const row = await getLogByMessage("Source failed");

    expect(row).not.toBeNull();
    expect(row!.level).toBe("error");
    expect(row!.category).toBe("fetch");
    expect(row!.source_id).toBeNull();
    expect(row!.digest_id).toBeNull();
    expect(row!.details).toBeNull();
  });

  it("stores optional sourceId and digestId", async () => {
    await logEvent(env.DB, {
      level: "warn",
      category: "ai",
      message: "Rate limited",
      sourceId: "src-1",
      digestId: "digest-2025-01-28",
    });

    const row = await getLogByMessage("Rate limited");

    expect(row!.source_id).toBe("src-1");
    expect(row!.digest_id).toBe("digest-2025-01-28");
  });

  it("stores details as JSON", async () => {
    await logEvent(env.DB, {
      level: "info",
      category: "general",
      message: "With details",
      details: { count: 42, nested: { key: "value" } },
    });

    const row = await getLogByMessage("With details");

    const details = JSON.parse(row!.details as string);
    expect(details.count).toBe(42);
    expect(details.nested.key).toBe("value");
  });

  it("truncates details to 5000 characters", async () => {
    const largeDetails = { data: "x".repeat(6000) };

    await logEvent(env.DB, {
      level: "error",
      category: "general",
      message: "Large details",
      details: largeDetails,
    });

    const row = await getLogByMessage("Large details");

    expect((row!.details as string).length).toBe(5000);
  });

  it("does not throw on database errors", async () => {
    // Calling with a broken DB proxy that always fails
    const brokenDb = {
      prepare: () => ({
        bind: () => ({
          run: () => Promise.reject(new Error("DB down")),
        }),
      }),
    } as unknown as D1Database;

    // Should not throw
    await logEvent(brokenDb, {
      level: "error",
      category: "general",
      message: "Should not throw",
    });
  });
});

describe("recordAIUsage", () => {
  it("inserts a successful AI usage record", async () => {
    await recordAIUsage(env.DB, {
      model: "gemini-2.0-flash",
      provider: "gemini",
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      latencyMs: 500,
      wasFallback: false,
      status: "success",
    });

    const row = await env.DB.prepare("SELECT * FROM ai_usage WHERE model = ?")
      .bind("gemini-2.0-flash")
      .first();

    expect(row).not.toBeNull();
    expect(row!.provider).toBe("gemini");
    expect(row!.input_tokens).toBe(100);
    expect(row!.output_tokens).toBe(50);
    expect(row!.total_tokens).toBe(150);
    expect(row!.latency_ms).toBe(500);
    expect(row!.was_fallback).toBe(0);
    expect(row!.error).toBeNull();
    expect(row!.status).toBe("success");
  });

  it("stores fallback flag as integer", async () => {
    await recordAIUsage(env.DB, {
      model: "claude-haiku-4-5-20251001",
      provider: "anthropic",
      wasFallback: true,
      status: "success",
    });

    const row = await env.DB.prepare(
      "SELECT * FROM ai_usage WHERE provider = 'anthropic'"
    ).first();

    expect(row!.was_fallback).toBe(1);
  });

  it("stores error details for failed calls", async () => {
    await recordAIUsage(env.DB, {
      model: "gemini-2.0-flash",
      provider: "gemini",
      wasFallback: false,
      error: "rate limited",
      status: "rate_limited",
    });

    const row = await env.DB.prepare(
      "SELECT * FROM ai_usage WHERE status = 'rate_limited'"
    ).first();

    expect(row!.error).toBe("rate limited");
    expect(row!.input_tokens).toBeNull();
    expect(row!.output_tokens).toBeNull();
  });
});
