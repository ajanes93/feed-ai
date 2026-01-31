import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { fetchMock } from "cloudflare:test";
import { generateDigest } from "../services/summarizer";
import { rawItemFactory } from "./factories";
import { mockGeminiSuccess, aiResponse } from "./helpers";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

function mockAnthropicSuccess(text: string) {
  const mock = fetchMock.get("https://api.anthropic.com");
  mock.intercept({ method: "POST", path: /.*/ }).reply(
    200,
    JSON.stringify({
      content: [{ type: "text", text }],
      usage: { input_tokens: 80, output_tokens: 40 },
    }),
    { headers: { "content-type": "application/json" } },
  );
}

function mockGeminiError(status: number, body: string) {
  const mock = fetchMock.get("https://generativelanguage.googleapis.com");
  mock.intercept({ method: "POST", path: /.*/ }).reply(status, body);
}

describe("generateDigest", () => {
  it("returns digest items from AI response", async () => {
    const items = rawItemFactory.buildList(5);
    const response = aiResponse(items, [0, 2, 4]);

    mockGeminiSuccess(response);

    const result = await generateDigest(items, { gemini: "test-key" }, "news");

    expect(result.items).toHaveLength(3);
    expect(result.items[0].title).toBe(items[0].title);
    expect(result.items[0].sourceUrl).toBe(items[0].link);
    expect(result.items[0].summary).toBe(`Summary of ${items[0].title}`);
    expect(result.aiUsages).toHaveLength(1);
    expect(result.aiUsages[0].status).toBe("success");
  });

  it("falls back to Claude when Gemini fails", async () => {
    const items = rawItemFactory.buildList(3);
    const response = aiResponse(items, [0, 1]);

    mockGeminiError(429, "rate limited");
    mockAnthropicSuccess(response);

    const result = await generateDigest(items, { gemini: "gem-key", anthropic: "ant-key" }, "news");

    expect(result.items).toHaveLength(2);
    expect(result.aiUsages.length).toBeGreaterThanOrEqual(2);
    expect(result.aiUsages[0].provider).toBe("gemini");
    expect(result.aiUsages[0].status).not.toBe("success");
    expect(result.aiUsages[1].provider).toBe("anthropic");
    expect(result.aiUsages[1].wasFallback).toBe(true);
  });

  it("strips markdown fences from AI response", async () => {
    const items = rawItemFactory.buildList(3);
    const json = aiResponse(items, [1]);
    const wrappedResponse = "```json\n" + json + "\n```";

    mockGeminiSuccess(wrappedResponse, { prompt: 50, candidates: 25 });

    const result = await generateDigest(items, { gemini: "test-key" }, "news");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe(items[1].title);
  });

  it("drops items with out-of-bounds item_index", async () => {
    const items = rawItemFactory.buildList(3);
    const response = JSON.stringify([
      { item_index: 0, title: "Valid", summary: "ok", category: "dev", source_name: "Src" },
      { item_index: 99, title: "Invalid", summary: "bad", category: "dev", source_name: "Src" },
      { item_index: -1, title: "Negative", summary: "bad", category: "dev", source_name: "Src" },
    ]);

    mockGeminiSuccess(response, { prompt: 50, candidates: 25 });

    const result = await generateDigest(items, { gemini: "test-key" }, "news");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Valid");
  });

  it("drops items missing required fields", async () => {
    const items = rawItemFactory.buildList(3);
    const response = JSON.stringify([
      { item_index: 0, title: "Good", summary: "ok", category: "dev", source_name: "Src" },
      { item_index: 1, summary: "missing title", category: "dev", source_name: "Src" },
      { item_index: 2, title: "No summary", category: "dev", source_name: "Src" },
    ]);

    mockGeminiSuccess(response, { prompt: 50, candidates: 25 });

    const result = await generateDigest(items, { gemini: "test-key" }, "news");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Good");
  });

  it("applies category limits", async () => {
    const items = rawItemFactory.buildList(20);
    const response = JSON.stringify(
      Array.from({ length: 12 }, (_, i) => ({
        item_index: i,
        title: `AI Item ${i}`,
        summary: `Summary ${i}`,
        category: "ai",
        source_name: "Src",
      })),
    );

    mockGeminiSuccess(response, { prompt: 50, candidates: 25 });

    const result = await generateDigest(items, { gemini: "test-key" }, "news");

    expect(result.items).toHaveLength(10); // CATEGORY_LIMITS.ai = 10
  });

  it("preserves source URL and published date from raw items", async () => {
    const items = rawItemFactory.buildList(2);
    const response = aiResponse(items, [0, 1]);

    mockGeminiSuccess(response, { prompt: 50, candidates: 25 });

    const result = await generateDigest(items, { gemini: "test-key" }, "news");

    expect(result.items[0].sourceUrl).toBe(items[0].link);
    expect(result.items[0].publishedAt).toBeDefined();
  });

  it("throws when no API key is configured", async () => {
    const items = rawItemFactory.buildList(3);

    await expect(generateDigest(items, {}, "news")).rejects.toThrow("No AI API key configured");
  });

  it("generates jobs-specific digest", async () => {
    const items = rawItemFactory.buildList(3);
    const response = aiResponse(items, [0], "jobs");

    mockGeminiSuccess(response, { prompt: 50, candidates: 25 });

    const result = await generateDigest(items, { gemini: "test-key" }, "jobs");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].category).toBe("jobs");
  });
});
