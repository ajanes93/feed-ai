import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import OQSanityHarness from "../../components/OQSanityHarness.vue";

describe("OQSanityHarness", () => {
  const defaultProps = {
    topPassRate: 72.5,
    topAgent: "Agentless",
    topModel: "Claude 3.5",
    medianPassRate: 45,
    languageBreakdown: "go: 95%, rust: 80%, python: 72%, dart: 30%",
  };

  it("renders top agent label", () => {
    const wrapper = mount(OQSanityHarness, { props: defaultProps });
    expect(wrapper.text()).toContain("Top Agent");
  });

  it("displays top agent pass rate", () => {
    const wrapper = mount(OQSanityHarness, { props: defaultProps });
    expect(wrapper.text()).toContain("72.5");
    expect(wrapper.text()).toContain("Top Agent");
  });

  it("displays top agent and model names", () => {
    const wrapper = mount(OQSanityHarness, { props: defaultProps });
    expect(wrapper.text()).toContain("Agentless");
    expect(wrapper.text()).toContain("Claude 3.5");
  });

  it("displays median pass rate", () => {
    const wrapper = mount(OQSanityHarness, { props: defaultProps });
    expect(wrapper.text()).toContain("45");
    expect(wrapper.text()).toContain("Median Agent");
  });

  it("renders language breakdown chips", () => {
    const wrapper = mount(OQSanityHarness, { props: defaultProps });
    expect(wrapper.text()).toContain("go");
    expect(wrapper.text()).toContain("95%");
    expect(wrapper.text()).toContain("rust");
    expect(wrapper.text()).toContain("80%");
    expect(wrapper.text()).toContain("python");
    expect(wrapper.text()).toContain("72%");
    expect(wrapper.text()).toContain("dart");
    expect(wrapper.text()).toContain("30%");
  });

  it("sorts languages by pass rate descending", () => {
    const wrapper = mount(OQSanityHarness, { props: defaultProps });
    const chips = wrapper.findAll("[data-testid='lang-chip']");
    // go (95%) should come first, dart (30%) last
    expect(chips[0].text()).toContain("go");
    expect(chips[chips.length - 1].text()).toContain("dart");
  });

  it("applies emerald color for high pass rates (>=80)", () => {
    const wrapper = mount(OQSanityHarness, { props: defaultProps });
    const goChip = wrapper.findAll("[data-testid='lang-pct']").find((el) => {
      return el.text().includes("95%");
    });
    expect(goChip?.classes()).toContain("text-emerald-400");
  });

  it("applies yellow color for medium pass rates (50-79)", () => {
    const wrapper = mount(OQSanityHarness, { props: defaultProps });
    const pythonChip = wrapper
      .findAll("[data-testid='lang-pct']")
      .find((el) => {
        return el.text().includes("72%");
      });
    expect(pythonChip?.classes()).toContain("text-yellow-400");
  });

  it("applies red color for low pass rates (<50)", () => {
    const wrapper = mount(OQSanityHarness, { props: defaultProps });
    const dartChip = wrapper.findAll("[data-testid='lang-pct']").find((el) => {
      return el.text().includes("30%");
    });
    expect(dartChip?.classes()).toContain("text-red-400");
  });

  it("hides language breakdown when empty string", () => {
    const wrapper = mount(OQSanityHarness, {
      props: { ...defaultProps, languageBreakdown: "" },
    });
    expect(wrapper.text()).not.toContain("Language spread");
  });

  it("renders source link to SanityHarness", () => {
    const wrapper = mount(OQSanityHarness, { props: defaultProps });
    const link = wrapper.find('a[href="https://sanityboard.lr7.dev"]');
    expect(link.exists()).toBe(true);
    expect(link.text()).toContain("SanityHarness");
    expect(link.attributes("target")).toBe("_blank");
  });

  it("renders dynamic note when provided", () => {
    const wrapper = mount(OQSanityHarness, {
      props: {
        ...defaultProps,
        note: "Top agent improved 3% this week in Go.",
      },
    });
    const noteEl = wrapper.find("[data-testid='sanity-harness-note']");
    expect(noteEl.exists()).toBe(true);
    expect(noteEl.text()).toContain("Top agent improved 3%");
  });

  it("hides note when not provided", () => {
    const wrapper = mount(OQSanityHarness, { props: defaultProps });
    const noteEl = wrapper.find("[data-testid='sanity-harness-note']");
    expect(noteEl.exists()).toBe(false);
  });
});
