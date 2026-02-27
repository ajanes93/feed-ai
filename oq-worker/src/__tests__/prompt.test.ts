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

  it("includes capability gap framing with deprecation notice", () => {
    const prompt = buildScoringPrompt(defaultContext);
    expect(prompt).toContain("SWE-bench Verified");
    expect(prompt).toContain("DEPRECATED");
    expect(prompt).toContain("contamination");
    expect(prompt).toContain("Capability Gap");
  });

  it("includes SWE-bench Pro as primary benchmark", () => {
    const prompt = buildScoringPrompt(defaultContext);
    expect(prompt).toContain("SWE-bench Pro Public");
    expect(prompt).toContain("SWE-bench Pro Private");
  });

  it("includes deprecation context block", () => {
    const prompt = buildScoringPrompt(defaultContext);
    expect(prompt).toContain("BENCHMARK UPDATE (Feb 23, 2026)");
    expect(prompt).toContain("OpenAI deprecated SWE-bench Verified");
    expect(prompt).toContain("59.4%");
    expect(prompt).toContain("LessWrong audit");
  });

  it("includes model_summary field in JSON schema", () => {
    const prompt = buildScoringPrompt(defaultContext);
    expect(prompt).toContain("model_summary");
  });

  it("includes SWE-bench Pro score when provided", () => {
    const prompt = buildScoringPrompt({
      ...defaultContext,
      sweBench: {
        topVerified: 81.5,
        topVerifiedModel: "Agent-X",
        topBashOnly: 78.0,
        topBashOnlyModel: "Model-Y",
        topPro: 48.2,
        topProModel: "Pro-Agent",
      },
    });
    expect(prompt).toContain("48.2% (Pro-Agent)");
    expect(prompt).toContain("81.5% (Agent-X)");
    expect(prompt).toContain("78% (Model-Y)");
  });

  it("uses default Pro score when sweBench has no topPro", () => {
    const prompt = buildScoringPrompt({
      ...defaultContext,
      sweBench: {
        topVerified: 80,
        topVerifiedModel: "A",
        topBashOnly: 77,
        topBashOnlyModel: "B",
      },
    });
    expect(prompt).toContain("~46%");
  });

  it("includes delta_explanation field in JSON schema", () => {
    const prompt = buildScoringPrompt(defaultContext);
    expect(prompt).toContain("delta_explanation");
  });

  it("includes analysis quality rules", () => {
    const prompt = buildScoringPrompt(defaultContext);
    expect(prompt).toContain("ANALYSIS QUALITY RULES");
    expect(prompt).toContain("at least 2 specific articles");
  });

  it("does not include funding_events in JSON schema (extracted separately)", () => {
    const prompt = buildScoringPrompt(defaultContext);
    expect(prompt).not.toContain("funding_events");
  });

  it("includes CEPR study data in industry section", () => {
    const prompt = buildScoringPrompt(defaultContext);
    expect(prompt).toContain("CEPR");
    expect(prompt).toContain("12,000+");
    expect(prompt).toContain("+4% productivity");
    expect(prompt).toContain("augmentation, not displacement");
  });

  it("includes funding summary when provided", () => {
    const prompt = buildScoringPrompt({
      ...defaultContext,
      fundingSummary: {
        totalRaised: "$2.1B",
        count: 4,
        topEvent: { company: "Anthropic", amount: "$1B", round: "Series E" },
      },
    });
    expect(prompt).toContain("$2.1B across 4 event(s)");
    expect(prompt).toContain("Anthropic $1B");
  });

  it("omits funding line when no funding data", () => {
    const prompt = buildScoringPrompt(defaultContext);
    expect(prompt).not.toContain("Recent AI Spending:");
  });

  it("includes SanityHarness data when provided", () => {
    const prompt = buildScoringPrompt({
      ...defaultContext,
      sanityHarness: {
        topPassRate: 72.5,
        topAgent: "TestAgent",
        topModel: "TestModel",
        medianPassRate: 45.0,
        languageBreakdown: "go: 95%, rust: 80%",
      },
    });
    expect(prompt).toContain("72.5%");
    expect(prompt).toContain("TestAgent");
    expect(prompt).toContain("TestModel");
    expect(prompt).toContain("45%");
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
