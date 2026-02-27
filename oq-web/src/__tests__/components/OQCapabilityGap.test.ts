import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import OQCapabilityGap from "../../components/OQCapabilityGap.vue";

describe("OQCapabilityGap", () => {
  const defaultProps = {
    verified: "~79%",
    pro: "~46%",
    proPrivate: "~23%",
  };

  const global = { stubs: { OQExplainer: true } };

  it("renders pro benchmark label", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps, global });
    expect(wrapper.text()).toContain("SWE-bench Pro");
  });

  it("displays pro score as primary (left position)", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps, global });
    expect(wrapper.text()).toContain("~46%");
    expect(wrapper.text()).toContain("SWE-bench Pro");
    expect(wrapper.text()).toContain("Public GPL repos");
  });

  it("displays pro private score as secondary (right position)", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps, global });
    expect(wrapper.text()).toContain("~23%");
    expect(wrapper.text()).toContain("Pro Private");
    expect(wrapper.text()).toContain("Proprietary startup code");
  });

  it("renders gap indicator", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps, global });
    expect(wrapper.text()).toContain("gap");
  });

  it("renders narrative summary text about unfamiliar code", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps, global });
    expect(wrapper.text()).toContain("Less than 1 in 2 on unfamiliar code");
  });

  it("shows deprecated Verified score as footnote", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps, global });
    expect(wrapper.text()).toContain("Previously: ~79%");
    expect(wrapper.text()).toContain("deprecated Feb 23");
    expect(wrapper.text()).toContain("contamination confirmed");
  });

  it("links to OpenAI deprecation post", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps, global });
    const link = wrapper.find(
      'a[href="https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/"]'
    );
    expect(link.exists()).toBe(true);
  });

  it("does not render note when not provided", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps, global });
    const noteEl = wrapper.find("[data-testid='capability-gap-note']");
    expect(noteEl.exists()).toBe(false);
  });

  it("renders note when provided", () => {
    const wrapper = mount(OQCapabilityGap, {
      props: {
        ...defaultProps,
        note: "SWE-bench Pro rose 2 points.",
      },
      global,
    });
    expect(wrapper.text()).toContain("SWE-bench Pro rose 2 points.");
  });

  it("renders with dynamic score values", () => {
    const wrapper = mount(OQCapabilityGap, {
      props: { verified: "81%", pro: "48%", proPrivate: "25%" },
      global,
    });
    expect(wrapper.text()).toContain("48%");
    expect(wrapper.text()).toContain("25%");
    expect(wrapper.text()).toContain("Previously: 81%");
  });

  it("renders source link for pro when provided", () => {
    const wrapper = mount(OQCapabilityGap, {
      props: {
        ...defaultProps,
        proSource: "https://scale.com/leaderboard/swe_bench_pro_public",
      },
      global,
    });
    const link = wrapper.find(
      'a[href="https://scale.com/leaderboard/swe_bench_pro_public"]'
    );
    expect(link.exists()).toBe(true);
    expect(link.text()).toContain("Scale AI SEAL");
  });

  it("renders source link for pro private when provided", () => {
    const wrapper = mount(OQCapabilityGap, {
      props: {
        ...defaultProps,
        proPrivateSource: "https://scale.com/leaderboard/swe_bench_pro_private",
      },
      global,
    });
    const link = wrapper.find(
      'a[href="https://scale.com/leaderboard/swe_bench_pro_private"]'
    );
    expect(link.exists()).toBe(true);
    expect(link.text()).toContain("Scale AI SEAL");
  });

  it("renders drill-down trigger", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps, global });
    expect(wrapper.text()).toContain("Drill down");
  });

  it("shows deprecation context in drill-down", async () => {
    const wrapper = mount(OQCapabilityGap, {
      props: defaultProps,
      global,
    });

    // Open the collapsible
    const trigger = wrapper.find("[data-slot='collapsible-trigger']");
    await trigger.trigger("click");

    expect(wrapper.text()).toContain("Why was SWE-bench Verified deprecated");
    expect(wrapper.text()).toContain("memorised SWE-bench Verified solutions");
    expect(wrapper.text()).toContain("59.4%");
  });

  it("shows LessWrong counterpoint in drill-down", async () => {
    const wrapper = mount(OQCapabilityGap, {
      props: defaultProps,
      global,
    });

    const trigger = wrapper.find("[data-slot='collapsible-trigger']");
    await trigger.trigger("click");

    expect(wrapper.text()).toContain("LessWrong audit");
    expect(wrapper.text()).toContain("test leniency");
  });

  it("toFraction returns less than 1 in 4 for values under 25", () => {
    const wrapper = mount(OQCapabilityGap, {
      props: { verified: "~79%", pro: "~46%", proPrivate: "~23%" },
      global,
    });
    expect(wrapper.text()).toContain("Less than 1 in 4");
  });

  it("shows default ~23% when proPrivate is not provided", () => {
    const wrapper = mount(OQCapabilityGap, {
      props: { verified: "~79%", pro: "~46%" },
      global,
    });
    expect(wrapper.text()).toContain("~23%");
  });

  it("shows fallback gapText when pro and proPrivate produce same fraction", () => {
    const wrapper = mount(OQCapabilityGap, {
      props: { verified: "~79%", pro: "~30%", proPrivate: "~35%" },
      global,
    });
    // Both are "less than 1 in 2" so fallback branch renders
    expect(wrapper.text()).toContain("AI solves less than 1 in 2 problems");
  });
});
