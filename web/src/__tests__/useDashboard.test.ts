import { describe, it, expect, vi, beforeEach } from "vitest";
import { useDashboard } from "../composables/useDashboard";
import { stubFetchJson } from "./helpers";

const DASHBOARD_DATA = {
  ai: {
    recentCalls: [
      { id: "1", model: "gemini-2.0-flash", provider: "gemini", inputTokens: 100, outputTokens: 50, totalTokens: 150, latencyMs: 200, wasFallback: false, error: null, status: "success", createdAt: 1706443200 },
    ],
    totalTokens: 150,
    rateLimitCount: 0,
    fallbackCount: 0,
  },
  sources: [],
  errors: [],
  totalDigests: 10,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useDashboard", () => {
  it("fetches dashboard data successfully", async () => {
    stubFetchJson(DASHBOARD_DATA);

    const { data, loading, error, fetchDashboard } = useDashboard();

    expect(loading.value).toBe(false);
    await fetchDashboard();

    expect(data.value).not.toBeNull();
    expect(data.value!.totalDigests).toBe(10);
    expect(data.value!.ai.recentCalls).toHaveLength(1);
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it("handles API errors", async () => {
    stubFetchJson(null, false);

    const { data, error, fetchDashboard } = useDashboard();
    await fetchDashboard();

    expect(data.value).toBeNull();
    expect(error.value).toBe("Failed to load dashboard");
  });

  it("handles network errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const { data, error, fetchDashboard } = useDashboard();
    await fetchDashboard();

    expect(data.value).toBeNull();
    expect(error.value).toBe("Network error");
  });

  it("sets loading during fetch", async () => {
    let resolvePromise: (v: unknown) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(
      new Promise((r) => { resolvePromise = r; }),
    ));

    const { loading, fetchDashboard } = useDashboard();

    const promise = fetchDashboard();
    expect(loading.value).toBe(true);

    resolvePromise!({ ok: true, json: () => Promise.resolve(DASHBOARD_DATA) });
    await promise;

    expect(loading.value).toBe(false);
  });
});
