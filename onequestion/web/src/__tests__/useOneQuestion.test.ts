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
});
