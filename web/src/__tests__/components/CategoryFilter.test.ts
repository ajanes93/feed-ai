import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import CategoryFilter from "../../components/CategoryFilter.vue";
import type { RenderOptions } from "../utils";
import { digestItemFactory } from "../factories";

const TEST_ITEMS = [
  digestItemFactory.build({ category: "ai" }),
  digestItemFactory.build({ category: "ai" }),
  digestItemFactory.build({ category: "dev" }),
  digestItemFactory.build({ category: "jobs" }),
  digestItemFactory.build({ category: "sport" }),
];

const TEST_PROPS = {
  items: TEST_ITEMS,
  activeCategory: "ai",
};

const render = (options: RenderOptions<typeof CategoryFilter> = {}) => {
  const wrapper = mount(CategoryFilter, {
    ...options,
    props: { ...TEST_PROPS, ...options.props },
  });

  return {
    wrapper,
    getButtons: () => wrapper.findAll("button"),
    getButtonByLabel: (label: string) =>
      wrapper.findAll("button").find((b) => b.text().includes(label)),
  };
};

describe("CategoryFilter", () => {
  describe("rendering", () => {
    it("renders all category buttons", () => {
      const { getButtons } = render();
      const labels = getButtons().map((b) => b.text());
      expect(labels.join(" ")).toContain("AI");
      expect(labels.join(" ")).toContain("Dev");
      expect(labels.join(" ")).toContain("Jobs");
      expect(labels.join(" ")).toContain("Sport");
    });

    it("renders the sliding indicator", () => {
      const { wrapper } = render();
      const indicator = wrapper.find(".absolute");
      expect(indicator.exists()).toBe(true);
    });
  });

  describe("counts", () => {
    it("shows per-category counts", () => {
      const { getButtonByLabel } = render();
      expect(getButtonByLabel("AI")!.text()).toContain("2");
      expect(getButtonByLabel("Dev")!.text()).toContain("1");
      expect(getButtonByLabel("Jobs")!.text()).toContain("1");
      expect(getButtonByLabel("Sport")!.text()).toContain("1");
    });

    it("hides count when category has no items", () => {
      const items = [digestItemFactory.build({ category: "ai" })];
      const { getButtonByLabel } = render({ props: { items } });
      // Dev and Jobs should have no count span
      expect(getButtonByLabel("Dev")!.text().trim()).toBe("Dev");
    });
  });

  describe("active state", () => {
    it("highlights the active category button", () => {
      const { getButtonByLabel } = render({
        props: { activeCategory: "ai" },
      });
      expect(getButtonByLabel("AI")!.classes()).toContain("text-background");
    });

    it("dims inactive category buttons", () => {
      const { getButtonByLabel } = render({
        props: { activeCategory: "ai" },
      });
      expect(getButtonByLabel("Dev")!.classes()).toContain(
        "text-muted-foreground"
      );
    });
  });

  describe("selection", () => {
    it("emits select when a button is clicked", async () => {
      const { wrapper, getButtonByLabel } = render();
      await getButtonByLabel("AI")!.trigger("click");
      expect(wrapper.emitted("select")).toEqual([["ai"]]);
    });

    it("emits select for each category", async () => {
      const { wrapper, getButtonByLabel } = render();
      await getButtonByLabel("Dev")!.trigger("click");
      await getButtonByLabel("Jobs")!.trigger("click");
      expect(wrapper.emitted("select")).toEqual([["dev"], ["jobs"]]);
    });
  });

  describe("with empty items", () => {
    it("shows no counts when items are empty", () => {
      const { getButtonByLabel } = render({ props: { items: [] } });
      // All categories should show no count span
      expect(getButtonByLabel("AI")!.text().trim()).toBe("AI");
      expect(getButtonByLabel("Dev")!.text().trim()).toBe("Dev");
    });
  });

  describe("pointer interactions", () => {
    it("emits select on pointer down then up", async () => {
      const { wrapper } = render();
      const container = wrapper.find("div");

      await container.trigger("pointerdown", {
        pointerId: 1,
        clientX: 50,
        clientY: 10,
      });
      await container.trigger("pointerup", {
        pointerId: 1,
        clientX: 50,
        clientY: 10,
      });

      expect(wrapper.emitted("select")).toBeTruthy();
    });

    it("does not emit on cancelled pointer", async () => {
      const { wrapper } = render();
      const container = wrapper.find("div");

      await container.trigger("pointerdown", {
        pointerId: 1,
        clientX: 50,
        clientY: 10,
      });
      await container.trigger("pointercancel", {
        pointerId: 1,
        clientX: 50,
        clientY: 10,
      });

      // Click events may still fire, but drag should be cancelled
      const vm = wrapper.vm as unknown as { dragging: boolean };
      expect(vm.dragging).toBe(false);
    });
  });

  describe("swipe progress", () => {
    it("accepts swipeProgress prop without errors", () => {
      const { wrapper } = render({
        props: { swipeProgress: 1.5 },
      });
      expect(wrapper.exists()).toBe(true);
    });

    it("ignores negative swipeProgress", async () => {
      const { wrapper } = render({
        props: { swipeProgress: -1 },
      });
      // Should render normally without errors
      expect(wrapper.findAll("button")).toHaveLength(4);
    });
  });
});
