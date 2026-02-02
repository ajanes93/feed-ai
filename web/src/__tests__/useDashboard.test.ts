import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useDashboard } from "../composables/useDashboard";
import { stubFetchJson } from "./helpers";

const DASHBOARD_DATA = {
  ai: {
    recentCalls: [
      {
        id: "1",
        model: "gemini-2.0-flash",
        provider: "gemini",
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        latencyMs: 200,
        wasFallback: false,
        error: null,
        status: "success",
        createdAt: 1706443200,
      },
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
  sessionStorage.setItem("admin_key", "test-key");
});

afterEach(() => {
  sessionStorage.clear();
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
    expect(error.value).toBe("offline");
  });

  it("sets loading during fetch", async () => {
    let resolvePromise: (v: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise((r) => {
          resolvePromise = r;
        })
      )
    );

    const { loading, fetchDashboard } = useDashboard();

    const promise = fetchDashboard();
    expect(loading.value).toBe(true);

    resolvePromise!({ ok: true, json: () => Promise.resolve(DASHBOARD_DATA) });
    await promise;

    expect(loading.value).toBe(false);
  });

  describe("auth flow", () => {
    it("requires auth when no admin key is set", async () => {
      sessionStorage.clear();
      const { needsAuth, fetchDashboard } = useDashboard();
      await fetchDashboard();
      expect(needsAuth.value).toBe(true);
    });

    it("sends admin key as Bearer token", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(DASHBOARD_DATA),
      });
      vi.stubGlobal("fetch", fetchSpy);

      const { fetchDashboard } = useDashboard();
      await fetchDashboard();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: "Bearer test-key" },
        })
      );
    });

    it("clears key and sets needsAuth on 401", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: "Unauthorized" }),
        })
      );

      const { needsAuth, error, fetchDashboard } = useDashboard();
      await fetchDashboard();

      expect(needsAuth.value).toBe(true);
      expect(error.value).toBe("Invalid admin key");
      expect(sessionStorage.getItem("admin_key")).toBeNull();
    });

    it("stores key in sessionStorage via setAdminKey", () => {
      sessionStorage.clear();
      const { setAdminKey, needsAuth } = useDashboard();
      setAdminKey("new-key");
      expect(sessionStorage.getItem("admin_key")).toBe("new-key");
      expect(needsAuth.value).toBe(false);
    });
  });

  describe("rebuildDigest", () => {
    it("calls POST /api/rebuild with auth header", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve("Generated digest with 10 items"),
      });
      vi.stubGlobal("fetch", fetchSpy);

      const { rebuildDigest } = useDashboard();
      await rebuildDigest();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/rebuild"),
        expect.objectContaining({
          method: "POST",
          headers: { Authorization: "Bearer test-key" },
        })
      );
    });

    it("sets rebuilding state during request", async () => {
      let resolvePromise: (v: unknown) => void;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockReturnValue(
          new Promise((r) => {
            resolvePromise = r;
          })
        )
      );

      const { rebuilding, rebuildDigest } = useDashboard();
      expect(rebuilding.value).toBe(false);

      const promise = rebuildDigest();
      expect(rebuilding.value).toBe(true);

      resolvePromise!({
        ok: true,
        status: 200,
        text: () => Promise.resolve("Generated digest with 5 items"),
      });
      await promise;

      expect(rebuilding.value).toBe(false);
    });

    it("sets rebuildResult on success", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve("Generated digest with 12 items"),
        })
      );

      const { rebuildResult, rebuildDigest } = useDashboard();
      await rebuildDigest();

      expect(rebuildResult.value).toBe("Generated digest with 12 items");
    });

    it("sets rebuildResult to error message on failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve("No items fetched"),
        })
      );

      const { rebuildResult, rebuildDigest } = useDashboard();
      await rebuildDigest();

      expect(rebuildResult.value).toBe("No items fetched");
    });

    it("clears auth on 401 during rebuild", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          text: () => Promise.resolve("Unauthorized"),
        })
      );

      const { needsAuth, rebuildDigest } = useDashboard();
      await rebuildDigest();

      expect(needsAuth.value).toBe(true);
      expect(sessionStorage.getItem("admin_key")).toBeNull();
    });

    it("requires auth when no admin key is set", async () => {
      sessionStorage.clear();
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const { needsAuth, rebuildDigest } = useDashboard();
      await rebuildDigest();

      expect(needsAuth.value).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
