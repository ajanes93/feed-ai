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
    it.each([
      {
        prop: "hasPrevious",
        value: true,
        button: "previous",
        disabled: false,
      },
      {
        prop: "hasPrevious",
        value: false,
        button: "previous",
        disabled: true,
      },
      { prop: "hasNext", value: true, button: "next", disabled: false },
      { prop: "hasNext", value: false, button: "next", disabled: true },
    ])(
      "$button button is ${ disabled ? 'disabled' : 'enabled' } when $prop=$value",
      ({ prop, value, button, disabled }) => {
        const getButton =
          button === "previous" ? "getPreviousButton" : "getNextButton";
        const { [getButton]: get } = render({ props: { [prop]: value } });
        if (disabled) {
          expect(get().attributes("disabled")).toBeDefined();
        } else {
          expect(get().attributes("disabled")).toBeUndefined();
        }
      }
    );
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
