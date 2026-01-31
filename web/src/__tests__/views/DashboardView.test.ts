import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import DashboardView from "../../views/DashboardView.vue";
import { stubFetchJson } from "../helpers";

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
        latencyMs: 2500,
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
  sources: [
    {
      sourceId: "s1",
      sourceName: "Hacker News",
      category: "dev",
      lastSuccessAt: 1706443200,
      lastErrorAt: null,
      lastError: null,
      itemCount: 10,
      consecutiveFailures: 0,
      stale: false,
    },
  ],
  errors: [
    {
      id: "e1",
      level: "error",
      category: "fetch",
      message: "Connection timeout",
      details: null,
      sourceId: null,
      createdAt: 1706443200,
    },
  ],
  totalDigests: 25,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-28T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const render = async (data = DASHBOARD_DATA) => {
  stubFetchJson(data);
  const wrapper = mount(DashboardView);
  await flushPromises();

  return {
    wrapper,
    getStatCards: () => wrapper.findAll(".rounded-xl.border.border-gray-800"),
  };
};

describe("DashboardView", () => {
  describe("rendering", () => {
    it("renders the dashboard header", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("Dashboard");
    });

    it("renders back to feed link", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("Back to Feed");
    });
  });

  describe("stats", () => {
    it("renders total digests", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("25");
      expect(wrapper.text()).toContain("Total Digests");
    });

    it("renders token count", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("Tokens (last 30)");
    });

    it("renders rate limit count", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("Rate Limits (last 30)");
    });
  });

  describe("AI usage table", () => {
    it("renders AI usage section", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("AI Usage");
    });

    it("shows provider name", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("gemini");
    });

    it("shows status", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("success");
    });

    it("formats latency", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("2.5s");
    });
  });

  describe("source health table", () => {
    it("renders source health section", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("Source Health");
    });

    it("shows source name", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("Hacker News");
    });

    it("shows OK status for healthy source", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("OK");
    });
  });

  describe("error logs", () => {
    it("renders error logs section", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("Recent Errors");
    });

    it("shows error message", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("Connection timeout");
    });
  });

  describe("loading state", () => {
    it("shows spinner while loading", async () => {
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
      const wrapper = mount(DashboardView);
      await nextTick();
      expect(wrapper.find(".animate-spin").exists()).toBe(true);
    });
  });

  describe("error state", () => {
    it("shows error message on API failure", async () => {
      stubFetchJson(null, false);
      const wrapper = mount(DashboardView);
      await flushPromises();
      expect(wrapper.text()).toContain("Failed to load dashboard");
    });
  });

  describe("refresh", () => {
    it("renders refresh button", async () => {
      const { wrapper } = await render();
      expect(wrapper.find("button").text()).toContain("Refresh");
    });
  });
});
