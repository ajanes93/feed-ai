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
  sessionStorage.setItem("admin_key", "test-key");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  sessionStorage.clear();
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

    it("shows Check status for source with 0 items", async () => {
      const data = dashboardDataFactory.build({
        sources: [sourceHealthFactory.build({ itemCount: 0, stale: false })],
      } as Partial<DashboardData>);
      const { wrapper } = await render(data);
      expect(wrapper.text()).toContain("Check");
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
      // Click the dashboard refresh button (last button), not the rebuild digest button
      const buttons = wrapper.findAll("button");
      await buttons[buttons.length - 1].trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("99");
    });
  });

  describe("refresh digest button", () => {
    it("renders Refresh Digest button when dashboard is loaded", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("Refresh Digest");
    });

    it("does not render Refresh Digest button before auth", async () => {
      sessionStorage.clear();
      stubFetchJson(DASHBOARD_DATA);
      const wrapper = mount(DashboardView);
      await flushPromises();

      expect(wrapper.text()).not.toContain("Refresh Digest");
    });

    it("shows Rebuilding... text while rebuild is in progress", async () => {
      const { wrapper } = await render();

      // Mock fetch to hang (simulate slow rebuild)
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

      const rebuildBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("Refresh Digest"));
      expect(rebuildBtn).toBeDefined();
      await rebuildBtn!.trigger("click");
      await nextTick();

      expect(wrapper.text()).toContain("Rebuilding...");
    });

    it("shows success message after successful rebuild", async () => {
      const { wrapper } = await render();

      // First call = rebuild (text response), second call = dashboard refresh (json response)
      let callCount = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              status: 200,
              text: () => Promise.resolve("Generated digest with 10 items"),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(DASHBOARD_DATA),
          });
        })
      );

      const rebuildBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("Refresh Digest"));
      await rebuildBtn!.trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("Generated digest with 10 items");
    });

    it("shows error message after failed rebuild", async () => {
      const { wrapper } = await render();

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve("No items fetched"),
        })
      );

      const rebuildBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("Refresh Digest"));
      await rebuildBtn!.trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("No items fetched");
    });

    it("disables button while rebuilding", async () => {
      const { wrapper } = await render();

      vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

      const rebuildBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("Refresh Digest"));
      await rebuildBtn!.trigger("click");
      await nextTick();

      // Re-find the button after state change
      const disabledBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("Rebuilding..."));
      expect(disabledBtn?.attributes("disabled")).toBeDefined();
    });
  });

  describe("auth flow", () => {
    it("shows auth prompt when no admin key is set", async () => {
      sessionStorage.clear();
      stubFetchJson(DASHBOARD_DATA);
      const wrapper = mount(DashboardView);
      await flushPromises();

      expect(wrapper.text()).toContain("Enter admin key");
      expect(wrapper.find('input[type="password"]').exists()).toBe(true);
      expect(wrapper.text()).not.toContain("AI Usage");
    });

    it("fetches dashboard after submitting admin key", async () => {
      sessionStorage.clear();
      stubFetchJson(DASHBOARD_DATA);
      const wrapper = mount(DashboardView);
      await flushPromises();

      await wrapper.find('input[type="password"]').setValue("my-key");
      await wrapper.find("form").trigger("submit");
      await flushPromises();

      expect(wrapper.text()).toContain("AI Usage");
      expect(wrapper.text()).toContain("Total Digests");
    });

    it("shows error and re-prompts on 401", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: "Unauthorized" }),
        })
      );
      const wrapper = mount(DashboardView);
      await flushPromises();

      expect(wrapper.text()).toContain("Invalid admin key");
      expect(wrapper.find('input[type="password"]').exists()).toBe(true);
    });
  });
});
