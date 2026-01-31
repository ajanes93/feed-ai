import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import DateHeader from "../../components/DateHeader.vue";
import type { RenderOptions } from "../utils";

const TEST_PROPS = {
  date: "January 28, 2025",
  itemCount: 8,
  hasPrevious: true,
  hasNext: true,
};

const render = (options: RenderOptions<typeof DateHeader> = {}) => {
  const wrapper = mount(DateHeader, {
    ...options,
    props: { ...TEST_PROPS, ...options.props },
  });

  return {
    wrapper,
    getPreviousButton: () => wrapper.findByAria("Previous digest"),
    getNextButton: () => wrapper.findByAria("Next digest"),
  };
};

describe("DateHeader", () => {
  describe("rendering", () => {
    it("renders the date", () => {
      const { wrapper } = render();
      expect(wrapper.text()).toContain("January 28, 2025");
    });

    it("renders the item count", () => {
      const { wrapper } = render();
      expect(wrapper.text()).toContain("8 stories");
    });
  });

  describe("navigation buttons", () => {
    it("enables previous button when hasPrevious is true", () => {
      const { getPreviousButton } = render();
      expect(getPreviousButton().attributes("disabled")).toBeUndefined();
    });

    it("disables previous button when hasPrevious is false", () => {
      const { getPreviousButton } = render({
        props: { hasPrevious: false },
      });
      expect(getPreviousButton().attributes("disabled")).toBeDefined();
    });

    it("enables next button when hasNext is true", () => {
      const { getNextButton } = render();
      expect(getNextButton().attributes("disabled")).toBeUndefined();
    });

    it("disables next button when hasNext is false", () => {
      const { getNextButton } = render({ props: { hasNext: false } });
      expect(getNextButton().attributes("disabled")).toBeDefined();
    });
  });

  describe("events", () => {
    it("emits previous when previous button is clicked", async () => {
      const { wrapper, getPreviousButton } = render();
      await getPreviousButton().trigger("click");
      expect(wrapper.emitted("previous")).toHaveLength(1);
    });

    it("emits next when next button is clicked", async () => {
      const { wrapper, getNextButton } = render();
      await getNextButton().trigger("click");
      expect(wrapper.emitted("next")).toHaveLength(1);
    });
  });

  describe("with different props", () => {
    it("renders different date and count", () => {
      const { wrapper } = render({
        props: { date: "February 1, 2025", itemCount: 3 },
      });
      expect(wrapper.text()).toContain("February 1, 2025");
      expect(wrapper.text()).toContain("3 stories");
    });
  });
});
