import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import OQSignalList from "../../components/OQSignalList.vue";
import type { OQSignal } from "@feed-ai/shared/oq-types";

describe("OQSignalList", () => {
  const signals: OQSignal[] = [
    {
      text: "Test signal up",
      direction: "up",
      source: "Ars Technica",
      impact: 3,
      url: "https://example.com/article1",
    },
    {
      text: "Test signal down",
      direction: "down",
      source: "HN",
      impact: -2,
    },
    {
      text: "Test signal neutral",
      direction: "neutral",
      source: "Blog",
      impact: 0,
    },
  ];

  it("renders all signals", () => {
    const wrapper = mount(OQSignalList, { props: { signals } });
    expect(wrapper.text()).toContain("Test signal up");
    expect(wrapper.text()).toContain("Test signal down");
    expect(wrapper.text()).toContain("Test signal neutral");
  });

  it("renders source names", () => {
    const wrapper = mount(OQSignalList, { props: { signals } });
    expect(wrapper.text()).toContain("Ars Technica");
    expect(wrapper.text()).toContain("HN");
    expect(wrapper.text()).toContain("Blog");
  });

  it("renders signal with URL as an anchor tag", () => {
    const wrapper = mount(OQSignalList, { props: { signals } });
    const link = wrapper.find('a[href="https://example.com/article1"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes("target")).toBe("_blank");
    expect(link.attributes("rel")).toBe("noopener noreferrer");
  });

  it("renders signal without URL as a div", () => {
    const wrapper = mount(OQSignalList, {
      props: { signals: [signals[1]] },
    });
    const links = wrapper.findAll("a");
    expect(links.length).toBe(0);
    const divs = wrapper.findAll("div.flex.items-center");
    expect(divs.length).toBeGreaterThan(0);
  });

  it("shows external link icon only for signals with URL", () => {
    const wrapper = mount(OQSignalList, { props: { signals } });
    const icons = wrapper.findAll("[data-testid='signal-external-link']");
    expect(icons.length).toBe(1);
  });

  it("renders direction badges correctly", () => {
    const wrapper = mount(OQSignalList, { props: { signals } });
    expect(wrapper.text()).toContain("▲");
    expect(wrapper.text()).toContain("▼");
    expect(wrapper.text()).toContain("●");
  });
});
