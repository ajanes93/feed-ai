import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import OQCapabilityGap from "../../components/OQCapabilityGap.vue";

describe("OQCapabilityGap", () => {
  const defaultProps = {
    verified: "~79%",
    pro: "~46%",
  };

  const global = { stubs: { OQExplainer: true } };

  it("renders section header", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps, global });
    expect(wrapper.text()).toContain("The Capability Gap");
  });

  it("displays verified score with description", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps, global });
    expect(wrapper.text()).toContain("~79%");
    expect(wrapper.text()).toContain("SWE-bench Verified");
    expect(wrapper.text()).toContain("Curated open-source bugs");
  });

  it("displays pro score with description", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps, global });
    expect(wrapper.text()).toContain("~46%");
    expect(wrapper.text()).toContain("SWE-bench Pro");
    expect(wrapper.text()).toContain("Unfamiliar real-world repos");
  });

  it("renders gap indicator", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps, global });
    expect(wrapper.text()).toContain("gap");
  });

  it("renders narrative summary text", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps, global });
    expect(wrapper.text()).toContain("AI solves 3 in 4 practiced problems");
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
        note: "SWE-bench Verified rose 2 points to 81%.",
      },
      global,
    });
    expect(wrapper.text()).toContain(
      "SWE-bench Verified rose 2 points to 81%."
    );
  });

  it("renders with dynamic score values", () => {
    const wrapper = mount(OQCapabilityGap, {
      props: { verified: "81%", pro: "48%" },
      global,
    });
    expect(wrapper.text()).toContain("81%");
    expect(wrapper.text()).toContain("48%");
  });

  it("renders source link for verified when provided", () => {
    const wrapper = mount(OQCapabilityGap, {
      props: {
        ...defaultProps,
        verifiedSource: "https://www.swebench.com",
      },
      global,
    });
    const link = wrapper.find('a[href="https://www.swebench.com"]');
    expect(link.exists()).toBe(true);
    expect(link.text()).toContain("swebench.com");
    expect(link.attributes("target")).toBe("_blank");
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

  it("does not render source links when not provided", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps, global });
    const links = wrapper.findAll("a");
    expect(links.length).toBe(0);
  });

  it("renders drill-down trigger", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps, global });
    expect(wrapper.text()).toContain("Drill down");
  });

  it("shows pro private score in drill-down when provided", async () => {
    const wrapper = mount(OQCapabilityGap, {
      props: {
        ...defaultProps,
        proPrivate: "~23%",
        proPrivateSource: "https://scale.com/leaderboard/swe_bench_pro_private",
      },
      global,
    });

    // Open the collapsible
    const trigger = wrapper.find("[data-slot='collapsible-trigger']");
    await trigger.trigger("click");

    expect(wrapper.text()).toContain("~23%");
    expect(wrapper.text()).toContain("truly private code");
  });
});
