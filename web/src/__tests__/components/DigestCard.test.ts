import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import DigestCard from "../../components/DigestCard.vue";
import { digestItemFactory } from "../factories";
import type { RenderOptions } from "../utils";

const TEST_ITEM = digestItemFactory.build({
  category: "ai",
  title: "GPT-5 Released",
  summary: "OpenAI releases GPT-5 with major improvements.",
  whyItMatters: "This changes the competitive landscape.",
  sourceName: "TechCrunch",
  sourceUrl: "https://techcrunch.com/gpt5",
  publishedAt: "2025-01-28T10:00:00Z",
});

const TEST_PROPS = { item: TEST_ITEM };

const render = (options: RenderOptions<typeof DigestCard> = {}) => {
  const wrapper = mount(DigestCard, {
    ...options,
    props: { ...TEST_PROPS, ...options.props },
  });

  return {
    wrapper,
    getTitle: () => wrapper.find("h2"),
    getSummary: () => wrapper.find("p.text-sm"),
    getCategoryBadge: () => wrapper.find("span.rounded-full"),
    getLink: () => wrapper.find("a"),
  };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-28T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DigestCard", () => {
  describe("rendering", () => {
    it("renders the title", () => {
      const { getTitle } = render();
      expect(getTitle().text()).toBe("GPT-5 Released");
    });

    it("renders the summary", () => {
      const { getSummary } = render();
      expect(getSummary().text()).toContain("OpenAI releases GPT-5");
    });

    it("renders the source name", () => {
      const { wrapper } = render();
      expect(wrapper.text()).toContain("TechCrunch");
    });

    it("links to the source URL", () => {
      const { getLink } = render();
      expect(getLink().attributes("href")).toBe("https://techcrunch.com/gpt5");
      expect(getLink().attributes("target")).toBe("_blank");
    });
  });

  describe("category badge", () => {
    it("renders AI badge for ai category", () => {
      const { getCategoryBadge } = render();
      expect(getCategoryBadge().text()).toBe("AI");
      expect(getCategoryBadge().classes()).toContain("text-purple-400");
    });

    it("renders Dev badge for dev category", () => {
      const item = digestItemFactory.build({ category: "dev" });
      const { getCategoryBadge } = render({ props: { item } });
      expect(getCategoryBadge().text()).toBe("Dev");
      expect(getCategoryBadge().classes()).toContain("text-blue-400");
    });

    it("renders Jobs badge for jobs category", () => {
      const item = digestItemFactory.build({ category: "jobs" });
      const { getCategoryBadge } = render({ props: { item } });
      expect(getCategoryBadge().text()).toBe("Jobs");
      expect(getCategoryBadge().classes()).toContain("text-emerald-400");
    });

    it("renders Other badge for unknown category", () => {
      const item = digestItemFactory.build({ category: "misc" });
      const { getCategoryBadge } = render({ props: { item } });
      expect(getCategoryBadge().text()).toBe("Other");
      expect(getCategoryBadge().classes()).toContain("text-gray-400");
    });
  });

  describe("published date formatting", () => {
    it("shows relative time for recent items", () => {
      const item = digestItemFactory.build({
        publishedAt: "2025-01-28T10:00:00Z",
      });
      const { wrapper } = render({ props: { item } });
      expect(wrapper.text()).toContain("2h ago");
    });

    it('shows "Just now" for very recent items', () => {
      const item = digestItemFactory.build({
        publishedAt: "2025-01-28T11:45:00Z",
      });
      const { wrapper } = render({ props: { item } });
      expect(wrapper.text()).toContain("Just now");
    });

    it('shows "Yesterday" for items from yesterday', () => {
      const item = digestItemFactory.build({
        publishedAt: "2025-01-27T10:00:00Z",
      });
      const { wrapper } = render({ props: { item } });
      expect(wrapper.text()).toContain("Yesterday");
    });

    it("hides date when publishedAt is not set", () => {
      const item = digestItemFactory.build({ publishedAt: undefined });
      const { wrapper } = render({ props: { item } });
      // Should not render any time element
      expect(wrapper.findAll(".text-xs.text-gray-500").length).toBeLessThan(2);
    });
  });

  describe("why it matters", () => {
    it("renders why it matters section when present", () => {
      const { wrapper } = render();
      expect(wrapper.text()).toContain("Why it matters");
      expect(wrapper.text()).toContain(
        "This changes the competitive landscape."
      );
    });

    it("hides why it matters section when not present", () => {
      const item = digestItemFactory.build({ whyItMatters: undefined });
      const { wrapper } = render({ props: { item } });
      expect(wrapper.text()).not.toContain("Why it matters");
    });
  });

  describe("favicon", () => {
    it("renders favicon image from source URL", () => {
      const { wrapper } = render();
      const img = wrapper.find("img");
      expect(img.exists()).toBe(true);
      expect(img.attributes("src")).toContain("techcrunch.com");
    });
  });
});
