import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import OQEconomicReality from "../../components/OQEconomicReality.vue";

describe("OQEconomicReality", () => {
  it("renders section header", () => {
    const wrapper = mount(OQEconomicReality, { props: {} });
    expect(wrapper.text()).toContain("The Economic Reality");
  });

  it("shows default software index (~70) when not provided", () => {
    const wrapper = mount(OQEconomicReality, { props: {} });
    expect(wrapper.text()).toContain("~70");
  });

  it("shows provided software index", () => {
    const wrapper = mount(OQEconomicReality, {
      props: { softwareIndex: 47.3 },
    });
    expect(wrapper.text()).toContain("~47.3");
  });

  it("shows Indeed Software Index label", () => {
    const wrapper = mount(OQEconomicReality, { props: {} });
    expect(wrapper.text()).toContain("Indeed Software Index");
  });

  it("shows baseline reference", () => {
    const wrapper = mount(OQEconomicReality, { props: {} });
    expect(wrapper.text()).toContain("vs 100 baseline");
  });

  it("shows VC funding section", () => {
    const wrapper = mount(OQEconomicReality, { props: {} });
    expect(wrapper.text()).toContain("$4B+");
    expect(wrapper.text()).toContain("VC in AI Code Tools");
  });

  it("shows Fortune 500 teams replaced count", () => {
    const wrapper = mount(OQEconomicReality, { props: {} });
    expect(wrapper.text()).toContain("F500 Teams Replaced");
    expect(wrapper.text()).toContain("At scale");
  });

  it("shows 4-week trend when provided", () => {
    const wrapper = mount(OQEconomicReality, {
      props: {
        softwareIndex: 47,
        softwareTrend: { change4w: -12.1 },
      },
    });
    expect(wrapper.text()).toContain("-12.1%");
    expect(wrapper.text()).toContain("4wk");
  });

  it("shows positive 4-week trend with plus sign", () => {
    const wrapper = mount(OQEconomicReality, {
      props: {
        softwareIndex: 50,
        softwareTrend: { change4w: 3.5 },
      },
    });
    expect(wrapper.text()).toContain("+3.5%");
  });

  it("hides trend when softwareTrend not provided", () => {
    const wrapper = mount(OQEconomicReality, {
      props: { softwareIndex: 47 },
    });
    expect(wrapper.text()).not.toContain("4wk");
  });

  it("applies red color for negative trend", () => {
    const wrapper = mount(OQEconomicReality, {
      props: {
        softwareIndex: 47,
        softwareTrend: { change4w: -5 },
      },
    });
    const trendEl = wrapper.find("[data-testid='software-trend']");
    expect(trendEl.exists()).toBe(true);
    expect(trendEl.classes()).toContain("text-red-400");
  });

  it("applies emerald color for positive trend", () => {
    const wrapper = mount(OQEconomicReality, {
      props: {
        softwareIndex: 50,
        softwareTrend: { change4w: 2 },
      },
    });
    const trendEl = wrapper.find("[data-testid='software-trend']");
    expect(trendEl.exists()).toBe(true);
    expect(trendEl.classes()).toContain("text-emerald-400");
  });

  it("renders footer text about investor betting", () => {
    const wrapper = mount(OQEconomicReality, { props: {} });
    expect(wrapper.text()).toContain("Investors are betting billions");
  });
});
