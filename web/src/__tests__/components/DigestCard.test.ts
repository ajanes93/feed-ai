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
    it.each([
      { category: "ai", label: "AI", colorClass: "text-purple-400" },
      { category: "dev", label: "Dev", colorClass: "text-blue-400" },
      { category: "jobs", label: "Jobs", colorClass: "text-emerald-400" },
      { category: "misc", label: "Other", colorClass: "text-gray-400" },
    ])(
      "renders $label badge for $category category",
      ({ category, label, colorClass }) => {
        const item = digestItemFactory.build({ category });
        const { getCategoryBadge } = render({ props: { item } });
        expect(getCategoryBadge().text()).toBe(label);
        expect(getCategoryBadge().classes()).toContain(colorClass);
      }
    );
  });

  describe("published date formatting", () => {
    it.each([
      { publishedAt: "2025-01-28T11:45:00Z", expected: "Just now" },
      { publishedAt: "2025-01-28T10:00:00Z", expected: "2h ago" },
      { publishedAt: "2025-01-27T10:00:00Z", expected: "Yesterday" },
      { publishedAt: "2025-01-20T10:00:00Z", expected: "Jan 20" },
    ])(
      'shows "$expected" for publishedAt=$publishedAt',
      ({ publishedAt, expected }) => {
        const item = digestItemFactory.build({ publishedAt });
        const { wrapper } = render({ props: { item } });
        expect(wrapper.text()).toContain(expected);
      }
    );

    it("hides date when publishedAt is not set", () => {
      const item = digestItemFactory.build({ publishedAt: undefined });
      const { wrapper } = render({ props: { item } });
      expect(wrapper.text()).not.toMatch(/\d+h ago|Just now|Yesterday/);
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

  describe("comment summary", () => {
    it("renders comment summary toggle when commentSummary is present", () => {
      const item = digestItemFactory.build({
        commentSummary: "The community was divided on this topic.",
        commentCount: 42,
        commentScore: 150,
        commentSummarySource: "generated",
      });
      const { wrapper } = render({ props: { item } });
      expect(wrapper.text()).toContain("42 comments");
      expect(wrapper.text()).toContain("150 points");
    });

    it("hides comment summary when not present", () => {
      const item = digestItemFactory.build({ commentSummary: undefined });
      const { wrapper } = render({ props: { item } });
      expect(wrapper.text()).not.toContain("comments");
      expect(wrapper.text()).not.toContain("Discussion");
    });

    it("expands comment summary on click", async () => {
      const item = digestItemFactory.build({
        commentSummary: "Key takeaway from the discussion.",
        commentCount: 30,
        commentScore: 200,
        commentSummarySource: "generated",
      });
      const { wrapper } = render({ props: { item } });

      // Summary text should not be visible initially
      expect(wrapper.text()).not.toContain("Key takeaway from the discussion.");

      // Click the toggle button
      const toggleButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("comments"));
      await toggleButton!.trigger("click");

      // Now summary text should be visible
      expect(wrapper.text()).toContain("Discussion");
      expect(wrapper.text()).toContain("Key takeaway from the discussion.");
      expect(wrapper.text()).toContain("AI-generated summary");
    });

    it("collapses comment summary on second click", async () => {
      const item = digestItemFactory.build({
        commentSummary: "Discussion text here.",
        commentCount: 20,
        commentScore: 100,
        commentSummarySource: "generated",
      });
      const { wrapper } = render({ props: { item } });

      const toggleButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("comments"));

      // Expand
      await toggleButton!.trigger("click");
      expect(wrapper.text()).toContain("Discussion text here.");

      // Collapse
      await toggleButton!.trigger("click");
      expect(wrapper.text()).not.toContain("Discussion text here.");
    });

    it("shows comment count without score when score is absent", () => {
      const item = digestItemFactory.build({
        commentSummary: "Summary text.",
        commentCount: 15,
        commentSummarySource: "generated",
      });
      const { wrapper } = render({ props: { item } });
      expect(wrapper.text()).toContain("15 comments");
      expect(wrapper.text()).not.toContain("points");
    });
  });

  describe("discussion link", () => {
    it("renders 'View discussion' link with icon when commentsUrl is set", () => {
      const item = digestItemFactory.build({
        commentsUrl: "https://news.ycombinator.com/item?id=12345",
      });
      const { wrapper } = render({ props: { item } });
      const link = wrapper
        .findAll("a")
        .find((a) => a.text().includes("View discussion"));
      expect(link).toBeDefined();
      expect(link!.attributes("href")).toBe(
        "https://news.ycombinator.com/item?id=12345"
      );
      expect(link!.attributes("target")).toBe("_blank");
      expect(link!.find("svg").exists()).toBe(true);
    });

    it("renders discussion link alongside comment summary", () => {
      const item = digestItemFactory.build({
        commentsUrl: "https://news.ycombinator.com/item?id=99999",
        commentSummary: "Great discussion about the topic.",
        commentCount: 85,
        commentScore: 169,
        commentSummarySource: "generated",
      });
      const { wrapper } = render({ props: { item } });

      // Both comment stats and discussion link should be visible
      expect(wrapper.text()).toContain("85 comments");
      expect(wrapper.text()).toContain("169 points");
      const link = wrapper
        .findAll("a")
        .find((a) => a.text().includes("View discussion"));
      expect(link).toBeDefined();
      expect(link!.attributes("href")).toBe(
        "https://news.ycombinator.com/item?id=99999"
      );
    });

    it("does not render discussion link when commentsUrl is absent", () => {
      const item = digestItemFactory.build({
        commentsUrl: undefined,
        commentSummary: undefined,
      });
      const { wrapper } = render({ props: { item } });
      const link = wrapper
        .findAll("a")
        .find((a) => a.text().includes("View discussion"));
      expect(link).toBeUndefined();
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

  describe("actions", () => {
    it("opens source URL in new tab", async () => {
      const openSpy = vi.fn();
      vi.stubGlobal("open", openSpy);

      const { wrapper } = render();
      // Simulate showing actions then clicking open
      await wrapper.find("article").trigger("contextmenu");
      // Actions are hidden by default; show them via long-press state
      // We test the openLink behavior by finding the button after showActions is true
      const vm = wrapper.vm as unknown as { showActions: boolean };
      vm.showActions = true;
      await wrapper.vm.$nextTick();

      const openButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("Open original"));
      await openButton!.trigger("click");

      expect(openSpy).toHaveBeenCalledWith(
        "https://techcrunch.com/gpt5",
        "_blank",
        "noopener,noreferrer"
      );
      vi.unstubAllGlobals();
    });

    it("shares item via navigator.share when available", async () => {
      const shareSpy = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { share: shareSpy, clipboard: {} });

      const { wrapper } = render();
      const vm = wrapper.vm as unknown as { showActions: boolean };
      vm.showActions = true;
      await wrapper.vm.$nextTick();

      const shareButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("Share"));
      await shareButton!.trigger("click");

      expect(shareSpy).toHaveBeenCalledWith({
        title: "GPT-5 Released",
        url: "https://techcrunch.com/gpt5",
      });
      vi.unstubAllGlobals();
    });

    it("copies to clipboard when navigator.share is unavailable", async () => {
      const writeTextSpy = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", {
        share: undefined,
        clipboard: { writeText: writeTextSpy },
      });

      const { wrapper } = render();
      const vm = wrapper.vm as unknown as { showActions: boolean };
      vm.showActions = true;
      await wrapper.vm.$nextTick();

      const shareButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("Share"));
      await shareButton!.trigger("click");

      expect(writeTextSpy).toHaveBeenCalledWith("https://techcrunch.com/gpt5");
      vi.unstubAllGlobals();
    });

    it("closes actions overlay when backdrop is clicked", async () => {
      const { wrapper } = render();
      const vm = wrapper.vm as unknown as { showActions: boolean };
      vm.showActions = true;
      await wrapper.vm.$nextTick();

      // Click the backdrop (the outer fixed overlay)
      const backdrop = wrapper.find(".fixed.inset-0");
      await backdrop.trigger("click");

      expect(vm.showActions).toBe(false);
    });
  });
});
