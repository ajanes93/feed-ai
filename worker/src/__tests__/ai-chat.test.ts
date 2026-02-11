import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { env, fetchMock } from "cloudflare:test";
import { app } from "../index";
import {
  seedDigest,
  mockGeminiSuccess,
  mockGeminiError,
  mockAnthropicSuccess,
} from "./helpers";

const FINGERPRINT = "a1b2c3d4e5f67890";

function chatRequest(prompt: string, fingerprint = FINGERPRINT) {
  return app.request(
    "/api/ai/chat",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Fingerprint": fingerprint,
      },
      body: JSON.stringify({ prompt }),
    },
    env
  );
}

function remainingRequest(fingerprint = FINGERPRINT) {
  return app.request(
    "/api/ai/remaining",
    {
      headers: { "X-Device-Fingerprint": fingerprint },
    },
    env
  );
}

async function seedTestDigest() {
  await seedDigest(
    env.DB,
    { id: "digest-2025-01-28", date: "2025-01-28", itemCount: 2 },
    [
      {
        id: "item-1",
        category: "ai",
        title: "GLM-5 Released",
        summary: "New model from Zhipu",
        sourceName: "TechCrunch",
        sourceUrl: "https://example.com/1",
        position: 0,
      },
      {
        id: "item-2",
        category: "dev",
        title: "Vue 3.5 Released",
        summary: "New Vue version",
        sourceName: "Vue Blog",
        sourceUrl: "https://example.com/2",
        position: 1,
      },
    ]
  );
}

beforeEach(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.deactivate();
});

describe("POST /api/ai/chat", () => {
  it("rejects invalid prompt keys", async () => {
    const res = await chatRequest("invalid_key");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Invalid prompt");
  });

  it("rejects missing fingerprint", async () => {
    const res = await chatRequest("daily", "");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Device fingerprint required");
  });

  it("rejects short fingerprint", async () => {
    const res = await chatRequest("daily", "abc");
    expect(res.status).toBe(400);
  });

  it("returns AI response with remaining count", async () => {
    await seedTestDigest();
    mockGeminiSuccess("## Daily Briefing\n\nHere are the highlights.");

    const res = await chatRequest("daily");
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      text: string;
      remaining: number;
    };
    expect(body.text).toContain("Daily Briefing");
    expect(body.remaining).toBe(4);
  });

  it("falls back to Claude when Gemini fails", async () => {
    await seedTestDigest();
    mockGeminiError(500, "Internal error");
    mockAnthropicSuccess("## Weekly Summary\n\nKey themes this week.");

    const res = await chatRequest("weekly");
    expect(res.status).toBe(200);

    const body = (await res.json()) as { text: string };
    expect(body.text).toContain("Weekly Summary");
  });

  it("enforces daily rate limit of 5", async () => {
    await seedTestDigest();

    for (let i = 0; i < 5; i++) {
      mockGeminiSuccess(`Response ${i}`);
      const res = await chatRequest("daily");
      expect(res.status).toBe(200);
    }

    const res = await chatRequest("daily");
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string; remaining: number };
    expect(body.remaining).toBe(0);
    expect(body.error).toContain("Daily limit");
  });

  it("rate limits are per-fingerprint", async () => {
    await seedTestDigest();

    // Fill up fingerprint A
    for (let i = 0; i < 5; i++) {
      mockGeminiSuccess(`Response ${i}`);
      const res = await chatRequest("daily", "fingerprint_aaa1");
      expect(res.status).toBe(200);
    }

    // Fingerprint B should still work
    mockGeminiSuccess("Response for B");
    const res = await chatRequest("daily", "fingerprint_bbb2");
    expect(res.status).toBe(200);
  });

  it.each(["daily", "weekly", "monthly", "top_ai", "dev_updates", "lincoln"])(
    "accepts prompt key %s",
    async (key) => {
      await seedTestDigest();
      mockGeminiSuccess(`Response for ${key}`);

      const res = await chatRequest(key, `fp_${key}_12345678`);
      expect(res.status).toBe(200);
    }
  );

  it("records AI usage in ai_usage table", async () => {
    await seedTestDigest();
    mockGeminiSuccess("Test response");

    await chatRequest("daily");

    const usage = await env.DB.prepare(
      "SELECT * FROM ai_usage ORDER BY created_at DESC LIMIT 1"
    ).first();
    expect(usage).not.toBeNull();
    expect(usage!.model).toBe("gemini-2.0-flash");
    expect(usage!.status).toBe("success");
  });

  it("logs events for AI chat requests", async () => {
    await seedTestDigest();
    mockGeminiSuccess("Test response");

    await chatRequest("daily");

    const log = await env.DB.prepare(
      "SELECT * FROM error_logs WHERE category = 'ai' AND message LIKE '%AI chat%' ORDER BY created_at DESC LIMIT 1"
    ).first();
    expect(log).not.toBeNull();
    expect(log!.level).toBe("info");
    expect(log!.message as string).toContain("daily");
  });
});

describe("GET /api/ai/remaining", () => {
  it("returns 5 for new fingerprint", async () => {
    const res = await remainingRequest("new_fingerprint1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { remaining: number };
    expect(body.remaining).toBe(5);
  });

  it("returns 0 for missing fingerprint", async () => {
    const res = await remainingRequest("");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { remaining: number };
    expect(body.remaining).toBe(0);
  });

  it("decrements after usage", async () => {
    await seedTestDigest();
    mockGeminiSuccess("Response");

    await chatRequest("daily", "tracking_fp123");

    const res = await remainingRequest("tracking_fp123");
    const body = (await res.json()) as { remaining: number };
    expect(body.remaining).toBe(4);
  });
});
