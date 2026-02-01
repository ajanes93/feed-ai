import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import EmptyState from "../../components/EmptyState.vue";
import type { RenderOptions } from "../utils";

const TEST_PROPS = {
  message: "No digest yet today",
};

const render = (options: RenderOptions<typeof EmptyState> = {}) => {
  const wrapper = mount(EmptyState, {
    ...options,
    props: { ...TEST_PROPS, ...options.props },
  });

  return { wrapper };
};

describe("EmptyState", () => {
  describe("rendering", () => {
    it("renders the message", () => {
      const { wrapper } = render();
      expect(wrapper.text()).toContain("No digest yet today");
    });

    it("renders the mailbox emoji", () => {
      const { wrapper } = render();
      expect(wrapper.text()).toContain("📭");
    });
  });

  describe("with different message", () => {
    it("renders custom message", () => {
      const { wrapper } = render({
        props: { message: "Check back later" },
      });
      expect(wrapper.text()).toContain("Check back later");
    });
  });
});
