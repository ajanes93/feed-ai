import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

import { generateDigest } from "../services/summarizer";
import type { RawItem } from "../types";

function makeItems(count: number): RawItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    sourceId: `source-${i % 3}`,
    title: `Item ${i}`,
    link: `https://example.com/${i}`,
    content: `Content for item ${i}`,
    publishedAt: Date.now() - i * 3600000,
  }));
}

function aiResponse(items: RawItem[], indices: number[], category = "dev") {
  return JSON.stringify(
    indices.map((i) => ({
      item_index: i,
      title: items[i].title,
      summary: `Summary of ${items[i].title}`,
      why_it_matters: "Relevant",
      category,
      source_name: "Test Source",
    }))
  );
}

function mockGeminiSuccess(text: string, tokens = { prompt: 100, candidates: 50 }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text }] } }],
          usageMetadata: {
            promptTokenCount: tokens.prompt,
            candidatesTokenCount: tokens.candidates,
            totalTokenCount: tokens.prompt + tokens.candidates,
          },
        }),
        { status: 200 }
      )
    )
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("generateDigest", () => {
  it("returns digest items from AI response", async () => {
    const items = makeItems(5);
    const response = aiResponse(items, [0, 2, 4]);

    mockGeminiSuccess(response);

    const result = await generateDigest(items, { gemini: "test-key" }, "news");

    expect(result.items).toHaveLength(3);
    expect(result.items[0].title).toBe("Item 0");
    expect(result.items[0].sourceUrl).toBe("https://example.com/0");
    expect(result.items[0].summary).toBe("Summary of Item 0");
    expect(result.aiUsages).toHaveLength(1);
    expect(result.aiUsages[0].status).toBe("success");
  });

  it("falls back to Claude when Gemini fails", async () => {
    const items = makeItems(3);
    const response = aiResponse(items, [0, 1]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }))
    );

    // Mock the Anthropic SDK — this is an external library
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: response }],
      usage: { input_tokens: 80, output_tokens: 40 },
    });

    const result = await generateDigest(items, { gemini: "gem-key", anthropic: "ant-key" }, "news");

    expect(result.items).toHaveLength(2);
    expect(result.aiUsages.length).toBeGreaterThanOrEqual(2);
    // First usage is the failed Gemini call
    expect(result.aiUsages[0].provider).toBe("gemini");
    expect(result.aiUsages[0].status).not.toBe("success");
    // Second is the successful Claude fallback
    expect(result.aiUsages[1].provider).toBe("anthropic");
    expect(result.aiUsages[1].wasFallback).toBe(true);
  });

  it("strips markdown fences from AI response", async () => {
    const items = makeItems(3);
    const json = aiResponse(items, [1]);
    const wrappedResponse = "```json\n" + json + "\n```";

    mockGeminiSuccess(wrappedResponse, { prompt: 50, candidates: 25 });

    const result = await generateDigest(items, { gemini: "test-key" }, "news");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Item 1");
  });

  it("drops items with out-of-bounds item_index", async () => {
    const items = makeItems(3);
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
    const items = makeItems(3);
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
    const items = makeItems(20);
    // Return 12 AI items — limit is 10
    const response = JSON.stringify(
      Array.from({ length: 12 }, (_, i) => ({
        item_index: i,
        title: `AI Item ${i}`,
        summary: `Summary ${i}`,
        category: "ai",
        source_name: "Src",
      }))
    );

    mockGeminiSuccess(response, { prompt: 50, candidates: 25 });

    const result = await generateDigest(items, { gemini: "test-key" }, "news");

    expect(result.items).toHaveLength(10); // CATEGORY_LIMITS.ai = 10
  });

  it("preserves source URL and published date from raw items", async () => {
    const items = makeItems(2);
    const response = aiResponse(items, [0, 1]);

    mockGeminiSuccess(response, { prompt: 50, candidates: 25 });

    const result = await generateDigest(items, { gemini: "test-key" }, "news");

    expect(result.items[0].sourceUrl).toBe(items[0].link);
    expect(result.items[0].publishedAt).toBeDefined();
  });

  it("throws when no API key is configured", async () => {
    const items = makeItems(3);

    await expect(generateDigest(items, {}, "news")).rejects.toThrow(
      "No AI API key configured"
    );
  });

  it("builds different prompts for news vs jobs", async () => {
    const items = makeItems(3);
    const response = aiResponse(items, [0], "jobs");

    mockGeminiSuccess(response, { prompt: 50, candidates: 25 });
    const fetchMock = vi.mocked(globalThis.fetch);

    await generateDigest(items, { gemini: "test-key" }, "jobs");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toContain("job listings");
    expect(prompt).toContain("remote");
  });
});
