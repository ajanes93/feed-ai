import { describe, it, expect } from "vitest";
import { buildScoringPrompt, hashPrompt } from "../services/prompt";

describe("buildScoringPrompt", () => {
  const defaultContext = {
    currentScore: 32,
    technicalScore: 25,
    economicScore: 38,
    history: "2025-01-14: 32 (+0)",
    articlesByPillar: {
      capability: "- Test article (Source)\n",
      labour_market: "",
      sentiment: "",
      industry: "",
      barriers: "",
    },
  };

  it("includes current scores in prompt", () => {
    const prompt = buildScoringPrompt(defaultContext);
    expect(prompt).toContain("Current score: 32/100");
    expect(prompt).toContain("Technical sub-score: 25/100");
    expect(prompt).toContain("Economic sub-score: 38/100");
  });

  it("includes history", () => {
    const prompt = buildScoringPrompt(defaultContext);
    expect(prompt).toContain("2025-01-14: 32 (+0)");
  });

  it("includes articles in pillar sections", () => {
    const prompt = buildScoringPrompt(defaultContext);
    expect(prompt).toContain("- Test article (Source)");
  });

  it("shows 'No articles today' for empty pillars", () => {
    const prompt = buildScoringPrompt(defaultContext);
    expect(prompt).toContain("No articles today.");
  });

  it("includes JSON schema instructions", () => {
    const prompt = buildScoringPrompt(defaultContext);
    expect(prompt).toContain("pillar_scores");
    expect(prompt).toContain("suggested_delta");
    expect(prompt).toContain("top_signals");
    expect(prompt).toContain("analysis");
  });

  it("includes calibration rules", () => {
    const prompt = buildScoringPrompt(defaultContext);
    expect(prompt).toContain("CALIBRATION RULES");
    expect(prompt).toContain("0-2 points");
  });

  it("includes FRED trend data when provided", () => {
    const prompt = buildScoringPrompt({
      ...defaultContext,
      softwareIndex: 47.3,
      softwareDate: "2026-02-14",
      softwareTrend: {
        current: 47.3,
        currentDate: "2026-02-14",
        change1w: -5.4,
        change4w: -12.1,
        previous: 50.0,
        previousDate: "2026-02-07",
      },
      generalIndex: 215000,
      generalDate: "2026-02-14",
      generalTrend: {
        current: 215000,
        currentDate: "2026-02-14",
        change1w: 2.3,
        change4w: -1.5,
        previous: 210000,
        previousDate: "2026-02-07",
      },
    });
    expect(prompt).toContain("47.3");
    expect(prompt).toContain("-5.4% week-over-week");
    expect(prompt).toContain("-12.1% over 4 weeks");
    expect(prompt).toContain("+2.3% week-over-week");
    expect(prompt).toContain("-1.5% over 4 weeks");
  });

  it("omits trend parentheses when no trend provided", () => {
    const prompt = buildScoringPrompt({
      ...defaultContext,
      softwareIndex: 47.3,
      softwareDate: "2026-02-14",
      generalIndex: 215000,
      generalDate: "2026-02-14",
    });
    expect(prompt).toContain("47.3");
    expect(prompt).not.toContain("week-over-week");
  });

  it("includes capability gap framing", () => {
    const prompt = buildScoringPrompt(defaultContext);
    expect(prompt).toContain("SWE-bench Verified");
    expect(prompt).toContain("SWE-bench Bash Only");
    expect(prompt).toContain("Capability Gap");
  });
});

describe("hashPrompt", () => {
  it("returns a 16-char hex string", async () => {
    const hash = await hashPrompt("test prompt");
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(hash).toHaveLength(16);
  });

  it("returns same hash for same input", async () => {
    const a = await hashPrompt("same input");
    const b = await hashPrompt("same input");
    expect(a).toBe(b);
  });

  it("returns different hash for different input", async () => {
    const a = await hashPrompt("input A");
    const b = await hashPrompt("input B");
    expect(a).not.toBe(b);
  });
});
