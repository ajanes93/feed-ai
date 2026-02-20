import { describe, it, expect } from "vitest";
import {
  parseModelResponse,
  calculateConsensusDelta,
  calculateModelAgreement,
  mergeSignals,
  mergePillarScores,
  synthesizeAnalysis,
} from "../services/scorer";
import {
  oqModelScoreFactory,
  oqSignalFactory,
  oqPillarScoresFactory,
} from "@feed-ai/shared/factories";

describe("parseModelResponse", () => {
  const validJson = JSON.stringify({
    pillar_scores: {
      capability: 1,
      labour_market: 0,
      sentiment: -1,
      industry: 0,
      barriers: 0,
    },
    technical_delta: 0.5,
    economic_delta: -0.3,
    suggested_delta: 0.2,
    analysis: "Test analysis text",
    top_signals: [
      { text: "Signal 1", direction: "up", source: "Test", impact: 2 },
    ],
    capability_gap_note: "No change",
  });

  it("parses valid JSON response", () => {
    const result = parseModelResponse(validJson, "test-model");
    expect(result.model).toBe("test-model");
    expect(result.suggested_delta).toBe(0.2);
    expect(result.analysis).toBe("Test analysis text");
    expect(result.pillar_scores.capability).toBe(1);
    expect(result.top_signals).toHaveLength(1);
    expect(result.capability_gap_note).toBe("No change");
  });

  it("strips markdown code fences from response", () => {
    const wrapped = "```json\n" + validJson + "\n```";
    const result = parseModelResponse(wrapped, "test-model");
    expect(result.suggested_delta).toBe(0.2);
  });

  it("strips code fences without language tag", () => {
    const wrapped = "```\n" + validJson + "\n```";
    const result = parseModelResponse(wrapped, "test-model");
    expect(result.suggested_delta).toBe(0.2);
  });

  it("defaults technical_delta to 0 when missing", () => {
    const json = JSON.stringify({
      pillar_scores: { capability: 0, labour_market: 0, sentiment: 0, industry: 0, barriers: 0 },
      suggested_delta: 0.1,
      analysis: "Test",
    });
    const result = parseModelResponse(json, "test-model");
    expect(result.technical_delta).toBe(0);
    expect(result.economic_delta).toBe(0);
  });

  it("defaults top_signals to empty array when missing", () => {
    const json = JSON.stringify({
      pillar_scores: { capability: 0, labour_market: 0, sentiment: 0, industry: 0, barriers: 0 },
      suggested_delta: 0.1,
      analysis: "Test",
    });
    const result = parseModelResponse(json, "test-model");
    expect(result.top_signals).toEqual([]);
  });

  it("throws on missing pillar_scores", () => {
    const json = JSON.stringify({ suggested_delta: 1, analysis: "Test" });
    expect(() => parseModelResponse(json, "bad-model")).toThrow(
      "Invalid response structure from bad-model",
    );
  });

  it("throws on missing suggested_delta", () => {
    const json = JSON.stringify({
      pillar_scores: { capability: 0 },
      analysis: "Test",
    });
    expect(() => parseModelResponse(json, "bad-model")).toThrow(
      "Invalid response structure",
    );
  });

  it("throws on missing analysis", () => {
    const json = JSON.stringify({
      pillar_scores: { capability: 0 },
      suggested_delta: 1,
    });
    expect(() => parseModelResponse(json, "bad-model")).toThrow(
      "Invalid response structure",
    );
  });

  it("throws on invalid JSON", () => {
    expect(() => parseModelResponse("not json", "bad-model")).toThrow();
  });
});

describe("mergeSignals", () => {
  it("deduplicates signals by first 50 chars lowercased", () => {
    const s1 = oqSignalFactory.build({ text: "AI benchmark improved significantly", impact: 3 });
    const s2 = oqSignalFactory.build({ text: "AI benchmark improved significantly", impact: 1 });
    const scores = [
      oqModelScoreFactory.build({ top_signals: [s1] }),
      oqModelScoreFactory.build({ top_signals: [s2] }),
    ];
    const result = mergeSignals(scores);
    expect(result).toHaveLength(1);
    expect(result[0].impact).toBe(3); // keeps the first occurrence
  });

  it("sorts by absolute impact descending", () => {
    const low = oqSignalFactory.build({ text: "Low impact", impact: 1 });
    const high = oqSignalFactory.build({ text: "High impact", impact: 5 });
    const negative = oqSignalFactory.build({ text: "Negative high", impact: -4 });
    const scores = [
      oqModelScoreFactory.build({ top_signals: [low, high, negative] }),
    ];
    const result = mergeSignals(scores);
    expect(result[0].text).toBe("High impact");
    expect(result[1].text).toBe("Negative high");
    expect(result[2].text).toBe("Low impact");
  });

  it("merges signals from multiple models", () => {
    const s1 = oqSignalFactory.build({ text: "Signal A", impact: 2 });
    const s2 = oqSignalFactory.build({ text: "Signal B", impact: 3 });
    const scores = [
      oqModelScoreFactory.build({ top_signals: [s1] }),
      oqModelScoreFactory.build({ top_signals: [s2] }),
    ];
    const result = mergeSignals(scores);
    expect(result).toHaveLength(2);
  });

  it("returns empty array when no signals", () => {
    const scores = [oqModelScoreFactory.build({ top_signals: [] })];
    expect(mergeSignals(scores)).toEqual([]);
  });
});

describe("mergePillarScores", () => {
  it("averages pillar scores across models", () => {
    const scores = [
      oqModelScoreFactory.build({
        pillar_scores: oqPillarScoresFactory.build({ capability: 2, labour_market: 4 }),
      }),
      oqModelScoreFactory.build({
        pillar_scores: oqPillarScoresFactory.build({ capability: 4, labour_market: 2 }),
      }),
    ];
    const result = mergePillarScores(scores);
    expect(result.capability).toBe(3);
    expect(result.labour_market).toBe(3);
  });

  it("rounds to 1 decimal place", () => {
    const scores = [
      oqModelScoreFactory.build({
        pillar_scores: oqPillarScoresFactory.build({ capability: 1 }),
      }),
      oqModelScoreFactory.build({
        pillar_scores: oqPillarScoresFactory.build({ capability: 2 }),
      }),
      oqModelScoreFactory.build({
        pillar_scores: oqPillarScoresFactory.build({ capability: 3 }),
      }),
    ];
    const result = mergePillarScores(scores);
    expect(result.capability).toBe(2);
  });

  it("handles single model", () => {
    const scores = [
      oqModelScoreFactory.build({
        pillar_scores: oqPillarScoresFactory.build({ capability: 3.7 }),
      }),
    ];
    const result = mergePillarScores(scores);
    expect(result.capability).toBe(3.7);
  });
});

describe("synthesizeAnalysis", () => {
  it("returns single model analysis directly", () => {
    const scores = [oqModelScoreFactory.build({ analysis: "Solo analysis" })];
    expect(synthesizeAnalysis(scores, "agree")).toBe("Solo analysis");
  });

  it("joins analyses with model labels when models disagree", () => {
    const scores = [
      oqModelScoreFactory.build({ model: "claude-sonnet", analysis: "Claude thinks X" }),
      oqModelScoreFactory.build({ model: "gpt-4o", analysis: "GPT thinks Y" }),
    ];
    const result = synthesizeAnalysis(scores, "disagree");
    expect(result).toContain("CLAUDE");
    expect(result).toContain("GPT");
    expect(result).toContain("Meanwhile");
  });

  it("uses Claude analysis when models agree", () => {
    const scores = [
      oqModelScoreFactory.build({ model: "gpt-4o", analysis: "GPT analysis" }),
      oqModelScoreFactory.build({ model: "claude-sonnet", analysis: "Claude analysis" }),
    ];
    expect(synthesizeAnalysis(scores, "agree")).toBe("Claude analysis");
  });

  it("falls back to first model when no Claude and models agree", () => {
    const scores = [
      oqModelScoreFactory.build({ model: "gpt-4o", analysis: "GPT analysis" }),
      oqModelScoreFactory.build({ model: "gemini-flash", analysis: "Gemini analysis" }),
    ];
    expect(synthesizeAnalysis(scores, "mostly_agree")).toBe("GPT analysis");
  });
});

describe("calculateConsensusDelta", () => {
  it("returns 0 for empty scores", () => {
    expect(calculateConsensusDelta([])).toBe(0);
  });

  it("returns single model delta directly", () => {
    const scores = [oqModelScoreFactory.build({ suggested_delta: 2.5 })];
    expect(calculateConsensusDelta(scores)).toBe(2.5);
  });

  it("applies correct model weights", () => {
    const scores = [
      oqModelScoreFactory.build({ model: "claude-sonnet", suggested_delta: 2 }),
      oqModelScoreFactory.build({ model: "gpt-4o", suggested_delta: 0 }),
      oqModelScoreFactory.build({ model: "gemini-flash", suggested_delta: 0 }),
    ];
    // Claude 40%: 2*0.4=0.8, GPT 30%: 0, Gemini 30%: 0 → 0.8/1.0 = 0.8
    expect(calculateConsensusDelta(scores)).toBeCloseTo(0.8);
  });
});

describe("calculateModelAgreement", () => {
  it("returns partial for single model", () => {
    const scores = [oqModelScoreFactory.build({ suggested_delta: 1 })];
    const result = calculateModelAgreement(scores);
    expect(result.agreement).toBe("partial");
    expect(result.spread).toBe(0);
  });

  it("returns agree when spread < 1.0", () => {
    const scores = [
      oqModelScoreFactory.build({ suggested_delta: 1.0 }),
      oqModelScoreFactory.build({ suggested_delta: 1.5 }),
    ];
    expect(calculateModelAgreement(scores).agreement).toBe("agree");
  });

  it("returns mostly_agree when spread <= 2.5", () => {
    const scores = [
      oqModelScoreFactory.build({ suggested_delta: 0 }),
      oqModelScoreFactory.build({ suggested_delta: 2 }),
    ];
    expect(calculateModelAgreement(scores).agreement).toBe("mostly_agree");
  });

  it("returns disagree when spread > 2.5", () => {
    const scores = [
      oqModelScoreFactory.build({ suggested_delta: -2 }),
      oqModelScoreFactory.build({ suggested_delta: 2 }),
    ];
    expect(calculateModelAgreement(scores).agreement).toBe("disagree");
  });

  it("calculates spread correctly", () => {
    const scores = [
      oqModelScoreFactory.build({ suggested_delta: 1 }),
      oqModelScoreFactory.build({ suggested_delta: 3 }),
      oqModelScoreFactory.build({ suggested_delta: 2 }),
    ];
    expect(calculateModelAgreement(scores).spread).toBe(2);
  });
});
