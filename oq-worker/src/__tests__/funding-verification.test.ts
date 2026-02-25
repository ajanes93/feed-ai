import { describe, it, expect } from "vitest";
import {
  stripJsonFences,
  buildFundingVerificationPrompt,
  buildTextProviders,
} from "../index";
import type { FundingCandidate } from "../index";

describe("stripJsonFences", () => {
  it("strips ```json fences", () => {
    expect(stripJsonFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("strips ``` fences without language tag", () => {
    expect(stripJsonFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("returns plain JSON unchanged", () => {
    expect(stripJsonFences('{"a":1}')).toBe('{"a":1}');
  });

  it("trims whitespace", () => {
    expect(stripJsonFences('  {"a":1}  ')).toBe('{"a":1}');
  });

  it("handles empty string", () => {
    expect(stripJsonFences("")).toBe("");
  });

  it("handles nested code fences in content", () => {
    const input = '```json\n{"code":"```example```"}\n```';
    const result = stripJsonFences(input);
    expect(result).toContain('"code"');
  });
});

describe("buildFundingVerificationPrompt", () => {
  it("includes numbered event list", () => {
    const events: FundingCandidate[] = [
      { company: "OpenAI", amount: "$6.6B", round: "Series C" },
      { company: "Anthropic", amount: "$2B", relevance: "AI lab funding" },
    ];
    const prompt = buildFundingVerificationPrompt(events);
    expect(prompt).toContain("1. OpenAI — $6.6B (round: Series C");
    expect(prompt).toContain(
      "2. Anthropic — $2B (round: ?, relevance: AI lab funding)"
    );
  });

  it("uses ? for missing fields", () => {
    const events: FundingCandidate[] = [{ company: "Acme" }];
    const prompt = buildFundingVerificationPrompt(events);
    expect(prompt).toContain("1. Acme — ? (round: ?, relevance: ?)");
  });

  it("requests JSON response format", () => {
    const events: FundingCandidate[] = [
      { company: "TestCo", amount: "$100M" },
    ];
    const prompt = buildFundingVerificationPrompt(events);
    expect(prompt).toContain('{ "verified": [');
    expect(prompt).toContain("Return ONLY the JSON object");
  });

  it("includes rejection criteria", () => {
    const events: FundingCandidate[] = [
      { company: "TestCo", amount: "$100M" },
    ];
    const prompt = buildFundingVerificationPrompt(events);
    expect(prompt).toContain("Corporate capital expenditure");
    expect(prompt).toContain("VC firms raising their own funds");
    expect(prompt).toContain("Acquisitions or M&A");
  });

  it("handles empty events array", () => {
    const prompt = buildFundingVerificationPrompt([]);
    expect(prompt).toContain("Events to verify:");
  });
});

describe("buildTextProviders", () => {
  it("returns empty array when no keys configured", () => {
    const env = { DB: {} } as never;
    const providers = buildTextProviders(env);
    expect(providers).toHaveLength(0);
  });

  it("includes Gemini when GEMINI_API_KEY is set", () => {
    const env = { GEMINI_API_KEY: "test-key" } as never;
    const providers = buildTextProviders(env);
    expect(providers).toHaveLength(1);
    expect(providers[0].name).toBe("gemini");
    expect(providers[0].model).toBe("gemini-2.0-flash");
  });

  it("includes OpenAI when OPENAI_API_KEY is set", () => {
    const env = { OPENAI_API_KEY: "test-key" } as never;
    const providers = buildTextProviders(env);
    expect(providers).toHaveLength(1);
    expect(providers[0].name).toBe("openai");
    expect(providers[0].model).toBe("gpt-4o-mini");
  });

  it("includes Anthropic when ANTHROPIC_API_KEY is set", () => {
    const env = { ANTHROPIC_API_KEY: "test-key" } as never;
    const providers = buildTextProviders(env);
    expect(providers).toHaveLength(1);
    expect(providers[0].name).toBe("anthropic");
    expect(providers[0].model).toBe("claude-haiku-4-5-20251001");
  });

  it("returns all providers when all keys set, in correct order", () => {
    const env = {
      GEMINI_API_KEY: "g",
      OPENAI_API_KEY: "o",
      ANTHROPIC_API_KEY: "a",
    } as never;
    const providers = buildTextProviders(env);
    expect(providers).toHaveLength(3);
    expect(providers.map((p) => p.name)).toEqual([
      "gemini",
      "openai",
      "anthropic",
    ]);
  });

  it("each provider has a callable function", () => {
    const env = { GEMINI_API_KEY: "test" } as never;
    const providers = buildTextProviders(env);
    expect(typeof providers[0].call).toBe("function");
  });
});
