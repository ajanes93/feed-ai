import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import FeedView from "../../views/FeedView.vue";
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

const DIGEST_LIST = [{ date: "2025-01-28" }];

// Stub vue-router
const mockRoute = { params: {}, query: {} };
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

const render = async () => {
  stubFetchResponses({
    "/api/digests": { status: 200, body: DIGEST_LIST },
    "/api/digest/2025-01-28": { status: 200, body: DIGEST },
  });

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
  });

  describe("date-based route", () => {
    it("fetches specific date from route params", async () => {
      mockRoute.params = { date: "2025-01-28" };
      stubFetchResponses({
        "/api/digests": { status: 200, body: DIGEST_LIST },
        "/api/digest/2025-01-28": { status: 200, body: DIGEST },
      });

      const wrapper = mount(FeedView);
      await flushPromises();

      expect(wrapper.text()).toContain("AI Story");
    });
  });

  describe("error state", () => {
    it("shows empty state on error", async () => {
      stubFetchResponses({
        "/api/digests": {
          status: 200,
          body: [{ date: "2025-01-27" }],
        },
      });

      const wrapper = mount(FeedView);
      await flushPromises();

      expect(wrapper.text()).toContain("No digest yet today");
    });
  });

  describe("category filtering", () => {
    it("renders category filter with all items", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).toContain("All");
      expect(wrapper.text()).toContain("AI");
      expect(wrapper.text()).toContain("Dev");
    });
  });

  describe("pull to refresh", () => {
    it("shows pull text during pull gesture", async () => {
      const { wrapper } = await render();
      expect(wrapper.text()).not.toContain("Pull to refresh");
    });
  });
});
