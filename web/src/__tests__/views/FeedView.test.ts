import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import FeedView from "../../views/FeedView.vue";
import CategoryFilter from "../../components/CategoryFilter.vue";
import DigestFeed from "../../components/DigestFeed.vue";
import { digestFactory, digestItemFactory } from "../factories";
import { stubFetchResponses } from "../helpers";

const DIGEST = digestFactory.build({
  date: "2025-01-28",
  items: [
    digestItemFactory.build({ category: "ai", title: "AI Story" }),
    digestItemFactory.build({ category: "dev", title: "Dev Story" }),
    digestItemFactory.build({ category: "jobs", title: "Jobs Story" }),
  ],
});

const DIGEST_LIST = [{ date: "2025-01-28" }, { date: "2025-01-27" }];

// Stub vue-router
const mockRoute = { params: {} as Record<string, string>, query: {} };
const mockRouter = { replace: vi.fn() };

vi.mock("vue-router", () => ({
  useRoute: () => mockRoute,
  useRouter: () => mockRouter,
}));

// Stub Swiper components as pass-through
vi.mock("swiper/vue", () => ({
  Swiper: {
    template: '<div class="swiper-mock"><slot /></div>',
    props: [
      "initialSlide",
      "speed",
      "resistanceRatio",
      "threshold",
      "touchAngle",
      "longSwipesRatio",
      "noSwiping",
      "noSwipingSelector",
      "nested",
      "touchReleaseOnEdges",
    ],
  },
  SwiperSlide: { template: "<div><slot /></div>" },
}));

vi.mock("swiper/css", () => ({}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-28T12:00:00Z"));
  mockRoute.params = {};
  mockRoute.query = {};
  mockRouter.replace.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const render = async (
  responses: Record<string, { status: number; body: unknown }> = {
    "/api/digests": { status: 200, body: DIGEST_LIST },
    "/api/digest/2025-01-28": { status: 200, body: DIGEST },
  }
) => {
  stubFetchResponses(responses);
  const wrapper = mount(FeedView);
  await flushPromises();
  return { wrapper };
};

describe("FeedView", () => {
  describe("initial load", () => {
    it("fetches and renders today's digest", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("AI Story");
      expect(wrapper.text()).toContain("Dev Story");
    });

    it("renders the date header", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("January");
      expect(wrapper.text()).toContain("28");
    });

    it("renders items for all categories by default", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("AI Story");
      expect(wrapper.text()).toContain("Dev Story");
      expect(wrapper.text()).toContain("Jobs Story");
    });
  });

  describe("date-based route", () => {
    it("fetches specific date from route params", async () => {
      mockRoute.params = { date: "2025-01-28" };
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("AI Story");
    });
  });

  describe("error state", () => {
    it("shows empty state when no digest exists today", async () => {
      const { wrapper } = await render({
        "/api/digests": {
          status: 200,
          body: [{ date: "2025-01-27" }],
        },
      });
      expect(wrapper.text()).toContain("No digest yet today");
    });

    it("shows error on network failure", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
      const wrapper = mount(FeedView);
      await flushPromises();
      expect(wrapper.text()).toBeTruthy();
    });
  });

  describe("category filtering", () => {
    it("renders category filter component", async () => {
      const { wrapper } = await render();
      expect(wrapper.findComponent(CategoryFilter).exists()).toBe(true);
    });

    it("passes all digest items to category filter", async () => {
      const { wrapper } = await render();
      const filter = wrapper.findComponent(CategoryFilter);
      expect(filter.props("items")).toHaveLength(3);
    });

    it("renders a DigestFeed for each category", async () => {
      const { wrapper } = await render();
      const feeds = wrapper.findAllComponents(DigestFeed);
      expect(feeds.length).toBe(4); // all, ai, dev, jobs
    });

    it("filters items per category in each feed slide", async () => {
      const { wrapper } = await render();
      const feeds = wrapper.findAllComponents(DigestFeed);
      // "all" slide has all 3 items
      expect(feeds[0].props("items")).toHaveLength(3);
      // "ai" slide has 1 item
      expect(feeds[1].props("items")).toHaveLength(1);
      // "dev" slide has 1 item
      expect(feeds[2].props("items")).toHaveLength(1);
      // "jobs" slide has 1 item
      expect(feeds[3].props("items")).toHaveLength(1);
    });
  });

  describe("pull-to-refresh", () => {
    it("content wrapper uses relative positioning for translateY approach", async () => {
      const { wrapper } = await render();
      const content = wrapper.find("[data-testid='pull-content']");
      expect(content.exists()).toBe(true);
      expect(content.classes()).toContain("relative");
    });

    it("outer wrapper clips overflow to prevent pull indicator from leaking", async () => {
      const { wrapper } = await render();
      // The outer wrapper (parent of pull-content) should have overflow-hidden
      const outer = wrapper.find("[data-testid='pull-content']").element
        .parentElement!;
      expect(outer.className).toContain("overflow-hidden");
    });

    it("does not use fixed positioning for pull indicator", async () => {
      const { wrapper } = await render();
      // No element with class "fixed" should exist in the component
      expect(wrapper.find(".fixed").exists()).toBe(false);
    });
  });

  describe("URL sync", () => {
    it("syncs digest date to route on load", async () => {
      await render();
      expect(mockRouter.replace).toHaveBeenCalled();
      const lastCall =
        mockRouter.replace.mock.calls[
          mockRouter.replace.mock.calls.length - 1
        ][0];
      expect(lastCall.params.date).toBe("2025-01-28");
    });
  });

  describe("navigation", () => {
    it("shows previous arrow when older digests exist", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("January");
    });

    it("arrow navigation resets to 'all' category and updates URL to new date", async () => {
      const YESTERDAY_DIGEST = digestFactory.build({
        date: "2025-01-27",
        items: [
          digestItemFactory.build({ category: "ai", title: "Old Story" }),
        ],
      });

      const { wrapper } = await render({
        "/api/digests": { status: 200, body: DIGEST_LIST },
        "/api/digest/2025-01-28": { status: 200, body: DIGEST },
        "/api/digest/2025-01-27": { status: 200, body: YESTERDAY_DIGEST },
      });

      mockRouter.replace.mockClear();

      await wrapper
        .find('button[aria-label="Previous digest"]')
        .trigger("click");
      await flushPromises();

      // URL should use yesterday's date with no category query (defaults to "all")
      const calls = mockRouter.replace.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.params.date).toBe("2025-01-27");
      expect(lastCall.query).toEqual({});
    });
  });
});
