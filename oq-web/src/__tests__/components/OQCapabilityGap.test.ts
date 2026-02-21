import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import OQCapabilityGap from "../../components/OQCapabilityGap.vue";

describe("OQCapabilityGap", () => {
  const defaultProps = {
    verified: "~79%",
    pro: "~46%",
  };

  it("renders section header", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps });
    expect(wrapper.text()).toContain("The Capability Gap");
  });

  it("displays verified score", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps });
    expect(wrapper.text()).toContain("~79%");
    expect(wrapper.text()).toContain("SWE-bench Verified");
    expect(wrapper.text()).toContain("Curated bugs");
  });

  it("displays pro score", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps });
    expect(wrapper.text()).toContain("~46%");
    expect(wrapper.text()).toContain("SWE-bench Pro");
    expect(wrapper.text()).toContain("Private codebases");
  });

  it("renders gap indicator", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps });
    expect(wrapper.text()).toContain("gap");
  });

  it("renders description text", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps });
    expect(wrapper.text()).toContain("The gap is the story");
  });

  it("does not render note when not provided", () => {
    const wrapper = mount(OQCapabilityGap, { props: defaultProps });
    const noteEl = wrapper.find(".bg-orange-500\\/5");
    expect(noteEl.exists()).toBe(false);
  });

  it("renders note when provided", () => {
    const wrapper = mount(OQCapabilityGap, {
      props: {
        ...defaultProps,
        note: "SWE-bench Verified rose 2 points to 81%.",
      },
    });
    expect(wrapper.text()).toContain(
      "SWE-bench Verified rose 2 points to 81%."
    );
  });

  it("renders with dynamic score values", () => {
    const wrapper = mount(OQCapabilityGap, {
      props: { verified: "81%", pro: "48%" },
    });
    expect(wrapper.text()).toContain("81%");
    expect(wrapper.text()).toContain("48%");
  });
});
