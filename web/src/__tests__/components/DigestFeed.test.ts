import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import DigestFeed from "../../components/DigestFeed.vue";
import DigestCard from "../../components/DigestCard.vue";
import { digestItemFactory } from "../factories";
import type { RenderOptions } from "../utils";

const TEST_ITEMS = digestItemFactory.buildList(3);

const TEST_PROPS = { items: TEST_ITEMS };

const render = (options: RenderOptions<typeof DigestFeed> = {}) => {
  const wrapper = mount(DigestFeed, {
    ...options,
    props: { ...TEST_PROPS, ...options.props },
  });

  return {
    wrapper,
    getCards: () => wrapper.findAllComponents(DigestCard),
  };
};

describe("DigestFeed", () => {
  describe("rendering", () => {
    it("renders a DigestCard for each item", () => {
      const { getCards } = render();
      expect(getCards()).toHaveLength(3);
    });

    it("passes the correct item to each card", () => {
      const { getCards } = render();
      getCards().forEach((card, i) => {
        expect(card.props("item")).toEqual(TEST_ITEMS[i]);
      });
    });
  });

  describe("with empty items", () => {
    it("renders no cards", () => {
      const { getCards } = render({ props: { items: [] } });
      expect(getCards()).toHaveLength(0);
    });
  });

  describe("with single item", () => {
    it("renders one card", () => {
      const items = [digestItemFactory.build()];
      const { getCards } = render({ props: { items } });
      expect(getCards()).toHaveLength(1);
    });
  });
});
