import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import DashboardView from "../../views/DashboardView.vue";
import type { DashboardData } from "../../composables/useDashboard";
import { stubFetchJson, stubFetchResponses } from "../helpers";
import {
  dashboardDataFactory,
  sourceHealthFactory,
  errorLogFactory,
} from "../factories";

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

const LOG_ENTRIES = {
  count: 1,
  logs: [errorLogFactory.build({ message: "Connection timeout" })],
};

const render = async (data = DASHBOARD_DATA, logs = LOG_ENTRIES) => {
  stubFetchResponses({
    "/api/admin/dashboard": { status: 200, body: data },
    "/api/admin/logs": { status: 200, body: logs },
  });
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
      expect(wrapper.text()).toContain("Feed");
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

  describe("logs", () => {
    it("renders logs section", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("Logs");
    });

    it("shows log entries from /api/admin/logs", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("Connection timeout");
    });

    it("shows filter chips", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("error");
      expect(wrapper.text()).toContain("warn");
      expect(wrapper.text()).toContain("info");
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

  describe("actions menu", () => {
    async function openMenu(
      wrapper: ReturnType<typeof mount<typeof DashboardView>>
    ) {
      const actionsBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("Actions"));
      expect(actionsBtn).toBeDefined();
      await actionsBtn!.trigger("click");
      await nextTick();
    }

    it("renders Actions menu when dashboard is loaded", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("Actions");
    });

    it("does not render Actions menu before auth", async () => {
      sessionStorage.clear();
      stubFetchJson(DASHBOARD_DATA);
      const wrapper = mount(DashboardView);
      await flushPromises();

      expect(wrapper.text()).not.toContain("Actions");
    });

    it("shows menu items when Actions is clicked", async () => {
      const { wrapper } = await render();
      await openMenu(wrapper);

      expect(wrapper.text()).toContain("Fetch Sources");
      expect(wrapper.text()).toContain("Rebuild Digest");
      expect(wrapper.text()).toContain("Append New Items");
      expect(wrapper.text()).toContain("Enrich Comments");
    });

    it("shows success message after successful rebuild", async () => {
      const { wrapper } = await render();
      await openMenu(wrapper);

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
        .find((b) => b.text().includes("Rebuild Digest"));
      await rebuildBtn!.trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("Generated digest with 10 items");
    });

    it("shows error message after failed rebuild", async () => {
      const { wrapper } = await render();
      await openMenu(wrapper);

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
        .find((b) => b.text().includes("Rebuild Digest"));
      await rebuildBtn!.trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("No items fetched");
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
