import { describe, it, expect, vi, beforeEach } from "vitest";
import { useOneQuestion } from "../composables/useOneQuestion";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("useOneQuestion", () => {
  it("fetchToday sets today data on success", async () => {
    const mockData = {
      date: "2025-01-15",
      score: 33,
      scoreTechnical: 26,
      scoreEconomic: 39,
      delta: 0.3,
      analysis: "Test analysis",
      signals: [],
      pillarScores: {},
      modelScores: [],
      modelAgreement: "partial",
      modelSpread: 0,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const { today, fetchToday, loading } = useOneQuestion();
    expect(today.value).toBeNull();

    await fetchToday();

    expect(today.value).toEqual(mockData);
    expect(loading.value).toBe(false);
  });

  it("fetchToday sets error on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { error, fetchToday } = useOneQuestion();
    await fetchToday();

    expect(error.value).toBeTruthy();
  });

  it("fetchHistory populates history array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          { date: "2025-01-14", score: 32, delta: 0 },
          { date: "2025-01-15", score: 33, delta: 0.3 },
        ]),
    });

    const { history, fetchHistory } = useOneQuestion();
    await fetchHistory(7);

    expect(history.value).toHaveLength(2);
  });

  it("deltaFormatted shows +/- prefix", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          date: "2025-01-15",
          score: 33,
          delta: 0.3,
          analysis: "",
          signals: [],
          pillarScores: {},
          modelScores: [],
          modelAgreement: "partial",
          modelSpread: 0,
        }),
    });

    const { fetchToday, deltaFormatted, deltaDirection } = useOneQuestion();
    await fetchToday();

    expect(deltaFormatted.value).toContain("+0.3");
    expect(deltaDirection.value).toBe("up");
  });

  it("deltaFormatted shows no change for zero delta", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          date: "2025-01-15",
          score: 32,
          delta: 0,
          analysis: "",
          signals: [],
          pillarScores: {},
          modelScores: [],
          modelAgreement: "partial",
          modelSpread: 0,
        }),
    });

    const { fetchToday, deltaFormatted, deltaDirection } = useOneQuestion();
    await fetchToday();

    expect(deltaFormatted.value).toBe("No change");
    expect(deltaDirection.value).toBe("neutral");
  });

  it("subscribe calls API and updates status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });

    const { subscribe, subscribeStatus } = useOneQuestion();
    const result = await subscribe("test@example.com");

    expect(result).toBe(true);
    expect(subscribeStatus.value).toBe("success");
    expect(mockFetch).toHaveBeenCalledWith("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });
  });

  it("subscribe sets error status on API failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

    const { subscribe, subscribeStatus } = useOneQuestion();
    const result = await subscribe("bad@email");

    expect(result).toBe(false);
    expect(subscribeStatus.value).toBe("error");
  });

  it("subscribe sets error status on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { subscribe, subscribeStatus } = useOneQuestion();
    const result = await subscribe("test@example.com");

    expect(result).toBe(false);
    expect(subscribeStatus.value).toBe("error");
  });

  it("deltaFormatted shows negative delta", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          date: "2025-01-15",
          score: 31,
          delta: -0.5,
          analysis: "",
          signals: [],
          pillarScores: {},
          modelScores: [],
          modelAgreement: "partial",
          modelSpread: 0,
        }),
    });

    const { fetchToday, deltaFormatted, deltaDirection } = useOneQuestion();
    await fetchToday();

    expect(deltaFormatted.value).toBe("-0.5 from yesterday");
    expect(deltaDirection.value).toBe("down");
  });

  it("formattedDate formats date correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          date: "2025-01-15",
          score: 32,
          delta: 0,
          analysis: "",
          signals: [],
          pillarScores: {},
          modelScores: [],
          modelAgreement: "partial",
          modelSpread: 0,
        }),
    });

    const { fetchToday, formattedDate } = useOneQuestion();
    await fetchToday();

    expect(formattedDate.value).toBe("15 January 2025");
  });

  it("fetchHistory silently handles errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { history, fetchHistory } = useOneQuestion();
    await fetchHistory();

    expect(history.value).toEqual([]);
  });

  it("fetchHistory does not populate on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { history, fetchHistory } = useOneQuestion();
    await fetchHistory();

    expect(history.value).toEqual([]);
  });

  it("fetchToday preserves deltaExplanation from response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          date: "2025-01-15",
          score: 33,
          delta: 0.3,
          deltaExplanation: "SWE-bench Verified rose 2 points.",
          analysis: "Analysis",
          signals: [],
          pillarScores: {},
          modelScores: [],
          modelAgreement: "agree",
          modelSpread: 0.2,
        }),
    });

    const { today, fetchToday } = useOneQuestion();
    await fetchToday();

    expect(today.value?.deltaExplanation).toBe(
      "SWE-bench Verified rose 2 points."
    );
  });

  it("fetchToday preserves externalData from response", async () => {
    const externalData = {
      sweBench: {
        topVerified: 81,
        topVerifiedModel: "Agent-X",
        topBashOnly: 78,
        topBashOnlyModel: "Model-Y",
        topPro: 48,
        topProModel: "Pro-Agent",
      },
      sanityHarness: {
        topPassRate: 72,
        topAgent: "TestAgent",
        topModel: "TestModel",
        medianPassRate: 45,
        languageBreakdown: "go: 95%",
      },
      softwareIndex: 47.3,
      softwareDate: "2026-02-14",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          date: "2025-01-15",
          score: 33,
          delta: 0,
          analysis: "",
          signals: [],
          pillarScores: {},
          modelScores: [],
          modelAgreement: "partial",
          modelSpread: 0,
          externalData,
        }),
    });

    const { today, fetchToday } = useOneQuestion();
    await fetchToday();

    expect(today.value?.externalData).toEqual(externalData);
  });

  it("fetchMethodology populates methodology with new fields", async () => {
    const methodologyData = {
      pillars: [{ name: "AI Capability", weight: 0.25, key: "capability" }],
      formula: {
        models: ["Claude"],
        weights: { claude: 0.4 },
        dampening: 0.3,
        dailyCap: 1.2,
        scoreRange: [5, 95],
        decayTarget: 40,
      },
      startingScore: 32,
      currentPromptHash: "abc123",
      capabilityGap: {
        verified: "~79%",
        bashOnly: "~77%",
        pro: "~46%",
        description: "SWE-bench scores",
      },
      sanityHarness: {
        topPassRate: 72.5,
        topAgent: "Agentless",
        topModel: "Claude 3.5",
        medianPassRate: 45,
        languageBreakdown: "go: 95%",
      },
      fredData: {
        softwareIndex: 47.3,
        softwareDate: "2026-02-14",
        softwareTrend: {
          current: 47.3,
          currentDate: "2026-02-14",
          change4w: -12.1,
        },
        generalIndex: 215000,
        generalDate: "2026-02-14",
      },
      whatWouldChange: {
        to50: ["Milestone A"],
        to70: ["Milestone B"],
        below20: ["Milestone C"],
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(methodologyData),
    });

    const { methodology, fetchMethodology } = useOneQuestion();
    await fetchMethodology();

    expect(methodology.value).toEqual(methodologyData);
    expect(methodology.value?.capabilityGap.pro).toBe("~46%");
    expect(methodology.value?.sanityHarness?.topPassRate).toBe(72.5);
    expect(methodology.value?.fredData.softwareIndex).toBe(47.3);
    expect(methodology.value?.fredData.generalIndex).toBe(215000);
    expect(methodology.value?.fredData.generalDate).toBe("2026-02-14");
  });

  it("fetchMethodology silently handles errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { methodology, fetchMethodology } = useOneQuestion();
    await fetchMethodology();

    expect(methodology.value).toBeNull();
  });

  it("fetchMethodology does not populate on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { methodology, fetchMethodology } = useOneQuestion();
    await fetchMethodology();

    expect(methodology.value).toBeNull();
  });
});
