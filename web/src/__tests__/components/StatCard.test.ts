import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import StatCard from "../../components/StatCard.vue";
import type { RenderOptions } from "../utils";

const TEST_PROPS = {
  value: "42",
  label: "Total Digests",
};

const render = (options: RenderOptions<typeof StatCard> = {}) => {
  const wrapper = mount(StatCard, {
    ...options,
    props: { ...TEST_PROPS, ...options.props },
  });

  return {
    wrapper,
    getValue: () => wrapper.find(".text-2xl"),
    getLabel: () => wrapper.find(".text-xs"),
  };
};

describe("StatCard", () => {
  describe("rendering", () => {
    it("renders the value", () => {
      const { getValue } = render();
      expect(getValue().text()).toBe("42");
    });

    it("renders the label", () => {
      const { getLabel } = render();
      expect(getLabel().text()).toBe("Total Digests");
    });
  });

  describe("highlight", () => {
    it("uses amber text when highlight is true", () => {
      const { getValue } = render({ props: { highlight: true } });
      expect(getValue().classes()).toContain("text-amber-400");
    });

    it("uses white text when highlight is false", () => {
      const { getValue } = render({ props: { highlight: false } });
      expect(getValue().classes()).toContain("text-white");
    });

    it("defaults to white text without highlight prop", () => {
      const { getValue } = render();
      expect(getValue().classes()).toContain("text-white");
    });
  });

  describe("with numeric value", () => {
    it("renders numeric value", () => {
      const { getValue } = render({ props: { value: 100 } });
      expect(getValue().text()).toBe("100");
    });
  });
});
