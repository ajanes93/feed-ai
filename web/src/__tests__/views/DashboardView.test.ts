import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import DashboardView from "../../views/DashboardView.vue";
import type { DashboardData } from "../../composables/useDashboard";
import { stubFetchJson } from "../helpers";
import { dashboardDataFactory, sourceHealthFactory } from "../factories";

const DASHBOARD_DATA = dashboardDataFactory.build();

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
  return { wrapper };
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
      expect(wrapper.text()).toContain("Source 1");
    });

    it("shows OK status for healthy source", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("OK");
    });

    it("shows Stale status for stale source", async () => {
      const data = dashboardDataFactory.build({
        sources: [sourceHealthFactory.build({ stale: true })],
      } as Partial<DashboardData>);
      const { wrapper } = await render(data);
      expect(wrapper.text()).toContain("Stale");
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
    it("re-fetches data when refresh button is clicked", async () => {
      const { wrapper } = await render();

      // Replace fetch with updated data
      stubFetchJson(
        dashboardDataFactory.build({
          totalDigests: 99,
        } as Partial<DashboardData>)
      );
      await wrapper.find("button").trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("99");
    });
  });
});
