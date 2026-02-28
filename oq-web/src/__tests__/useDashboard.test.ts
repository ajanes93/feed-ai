import { describe, it, expect, vi, beforeEach } from "vitest";
import { useDashboard } from "../composables/useDashboard";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Stub sessionStorage
vi.stubGlobal("sessionStorage", {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

beforeEach(() => {
  mockFetch.mockReset();
});

function authedDashboard() {
  const dash = useDashboard();
  dash.setAdminKey("test-key");
  return dash;
}

function mockOk(body: unknown) {
  return mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

function mock401() {
  return mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 401,
    json: () => Promise.resolve({ error: "Unauthorized" }),
  });
}

function mockError(body: { error: string }) {
  return mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 500,
    json: () => Promise.resolve(body),
  });
}

describe("useDashboard", () => {
  describe("dedupFunding", () => {
    it("calls backfill endpoint and sets success result", async () => {
      mockOk({ deleted: 3, remaining: 12 });
      const { dedupFunding, dedupFundingResult, dedupFundingSuccess } =
        authedDashboard();

      await dedupFunding();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/backfill?type=dedup-funding",
        expect.objectContaining({ method: "POST" })
      );
      expect(dedupFundingResult.value).toBe(
        "Removed 3 duplicates, 12 remaining"
      );
      expect(dedupFundingSuccess.value).toBe(true);
    });

    it("sets error on failure", async () => {
      mockError({ error: "DB locked" });
      const { dedupFunding, dedupFundingResult, dedupFundingSuccess } =
        authedDashboard();

      await dedupFunding();

      expect(dedupFundingResult.value).toBe("DB locked");
      expect(dedupFundingSuccess.value).toBe(false);
    });

    it("clears auth on 401", async () => {
      mock401();
      const { dedupFunding, needsAuth } = authedDashboard();

      await dedupFunding();

      expect(needsAuth.value).toBe(true);
    });
  });

  describe("extractFunding", () => {
    it("calls extract-funding endpoint and sets success result", async () => {
      mockOk({ extracted: 5, scanned: 20 });
      const { extractFunding, extractFundingResult, extractFundingSuccess } =
        authedDashboard();

      await extractFunding();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/extract-funding",
        expect.objectContaining({ method: "POST" })
      );
      expect(extractFundingResult.value).toBe(
        "Extracted 5 funding events (20 articles scanned)"
      );
      expect(extractFundingSuccess.value).toBe(true);
    });

    it("sets error on failure", async () => {
      mockError({ error: "AI provider down" });
      const { extractFunding, extractFundingResult, extractFundingSuccess } =
        authedDashboard();

      await extractFunding();

      expect(extractFundingResult.value).toBe("AI provider down");
      expect(extractFundingSuccess.value).toBe(false);
    });
  });

  describe("fetchSanity", () => {
    it("calls fetch-sanity endpoint and sets success result", async () => {
      mockOk({ stored: 8 });
      const { fetchSanity, fetchSanityResult, fetchSanitySuccess } =
        authedDashboard();

      await fetchSanity();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/fetch-sanity",
        expect.objectContaining({ method: "POST" })
      );
      expect(fetchSanityResult.value).toBe("Fetched Sanity Harness data (8)");
      expect(fetchSanitySuccess.value).toBe(true);
    });

    it("sets error on failure", async () => {
      mockError({ error: "Source unavailable" });
      const { fetchSanity, fetchSanityResult, fetchSanitySuccess } =
        authedDashboard();

      await fetchSanity();

      expect(fetchSanityResult.value).toBe("Source unavailable");
      expect(fetchSanitySuccess.value).toBe(false);
    });
  });

  describe("fetchSwebench", () => {
    it("calls fetch-swebench endpoint and sets success result", async () => {
      mockOk({ stored: 15 });
      const { fetchSwebench, fetchSwebenchResult, fetchSwebenchSuccess } =
        authedDashboard();

      await fetchSwebench();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/fetch-swebench",
        expect.objectContaining({ method: "POST" })
      );
      expect(fetchSwebenchResult.value).toBe("Fetched SWE-bench data (15)");
      expect(fetchSwebenchSuccess.value).toBe(true);
    });

    it("sets error on failure", async () => {
      mockError({ error: "Rate limited" });
      const { fetchSwebench, fetchSwebenchResult, fetchSwebenchSuccess } =
        authedDashboard();

      await fetchSwebench();

      expect(fetchSwebenchResult.value).toBe("Rate limited");
      expect(fetchSwebenchSuccess.value).toBe(false);
    });
  });

  describe("fetchArticles", () => {
    it("shows error details when sources fail", async () => {
      mockOk({
        fetched: 5,
        errors: [
          { sourceId: "oq-openai", errorType: "http_error", message: "HTTP 403" },
          { sourceId: "oq-arxiv", errorType: "timeout", message: "Timeout" },
        ],
      });
      // Mock the subsequent fetchDashboard call
      mockOk({ ai: { recentCalls: [], totalTokens: 0 }, sources: [], totalScores: 0, totalArticles: 0, totalSubscribers: 0, todayScoreExists: false });
      const { fetchArticles, fetchResult, fetchSuccess } = authedDashboard();

      await fetchArticles();

      expect(fetchResult.value).toContain("2 error(s)");
      expect(fetchResult.value).toContain("oq-openai: HTTP 403");
      expect(fetchResult.value).toContain("oq-arxiv: Timeout");
      expect(fetchResult.value).toContain("Fetched 5 articles");
      expect(fetchSuccess.value).toBe(false);
    });

    it("shows clean message when no errors", async () => {
      mockOk({ fetched: 12, errors: [] });
      mockOk({ ai: { recentCalls: [], totalTokens: 0 }, sources: [], totalScores: 0, totalArticles: 0, totalSubscribers: 0, todayScoreExists: false });
      const { fetchArticles, fetchResult, fetchSuccess } = authedDashboard();

      await fetchArticles();

      expect(fetchResult.value).toBe("Fetched 12 new articles");
      expect(fetchSuccess.value).toBe(true);
    });

    it("sets error on API failure", async () => {
      mockError({ error: "Worker down" });
      const { fetchArticles, fetchResult, fetchSuccess } = authedDashboard();

      await fetchArticles();

      expect(fetchResult.value).toBe("Worker down");
      expect(fetchSuccess.value).toBe(false);
    });

    it("clears auth on 401", async () => {
      mock401();
      const { fetchArticles, needsAuth } = authedDashboard();

      await fetchArticles();

      expect(needsAuth.value).toBe(true);
    });
  });

  describe("purgeScores", () => {
    it("calls purge-scores endpoint and sets success result", async () => {
      mockOk({ scores: 5, modelResponses: 15, fundingEvents: 3, aiUsage: 20, scoreArticles: 10 });
      mockOk({ ai: { recentCalls: [], totalTokens: 0 }, sources: [], totalScores: 0, totalArticles: 0, totalSubscribers: 0, todayScoreExists: false });
      const { purgeScores, purgeScoresResult, purgeScoresSuccess } = authedDashboard();

      await purgeScores();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/purge-scores",
        expect.objectContaining({ method: "POST" })
      );
      expect(purgeScoresResult.value).toContain("Purged 5 scores");
      expect(purgeScoresResult.value).toContain("15 model responses");
      expect(purgeScoresResult.value).toContain("3 funding events");
      expect(purgeScoresResult.value).toContain("20 AI usage records");
      expect(purgeScoresSuccess.value).toBe(true);
    });

    it("sets error on failure", async () => {
      mockError({ error: "DB locked" });
      const { purgeScores, purgeScoresResult, purgeScoresSuccess } = authedDashboard();

      await purgeScores();

      expect(purgeScoresResult.value).toBe("DB locked");
      expect(purgeScoresSuccess.value).toBe(false);
    });

    it("clears auth on 401", async () => {
      mock401();
      const { purgeScores, needsAuth } = authedDashboard();

      await purgeScores();

      expect(needsAuth.value).toBe(true);
    });
  });

  describe("purgeFunding", () => {
    it("calls purge-funding endpoint and sets success result", async () => {
      mockOk({ fundingEvents: 42 });
      mockOk({ ai: { recentCalls: [], totalTokens: 0 }, sources: [], totalScores: 0, totalArticles: 0, totalSubscribers: 0, todayScoreExists: false });
      const { purgeFunding, purgeFundingResult, purgeFundingSuccess } = authedDashboard();

      await purgeFunding();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/purge-funding",
        expect.objectContaining({ method: "POST" })
      );
      expect(purgeFundingResult.value).toBe("Purged 42 funding events");
      expect(purgeFundingSuccess.value).toBe(true);
    });

    it("sets error on failure", async () => {
      mockError({ error: "Timeout" });
      const { purgeFunding, purgeFundingResult, purgeFundingSuccess } = authedDashboard();

      await purgeFunding();

      expect(purgeFundingResult.value).toBe("Timeout");
      expect(purgeFundingSuccess.value).toBe(false);
    });

    it("clears auth on 401", async () => {
      mock401();
      const { purgeFunding, needsAuth } = authedDashboard();

      await purgeFunding();

      expect(needsAuth.value).toBe(true);
    });
  });

  describe("requires auth", () => {
    it("sets needsAuth when no key provided", async () => {
      const {
        dedupFunding,
        extractFunding,
        fetchSanity,
        fetchSwebench,
        fetchArticles,
        purgeScores,
        purgeFunding,
        needsAuth,
      } = useDashboard();

      await dedupFunding();
      expect(needsAuth.value).toBe(true);

      needsAuth.value = false;
      await extractFunding();
      expect(needsAuth.value).toBe(true);

      needsAuth.value = false;
      await fetchSanity();
      expect(needsAuth.value).toBe(true);

      needsAuth.value = false;
      await fetchSwebench();
      expect(needsAuth.value).toBe(true);

      needsAuth.value = false;
      await fetchArticles();
      expect(needsAuth.value).toBe(true);

      needsAuth.value = false;
      await purgeScores();
      expect(needsAuth.value).toBe(true);

      needsAuth.value = false;
      await purgeFunding();
      expect(needsAuth.value).toBe(true);

      // No fetch calls should have been made
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
