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
    expect(wrapper.text()).toContain("As of Feb 2026");
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

  it("renders FRED source link", () => {
    const wrapper = mount(OQEconomicReality, { props: {} });
    const fredLink = wrapper.find(
      'a[href="https://fred.stlouisfed.org/series/IHLIDXUSTPSOFTDEVE"]'
    );
    expect(fredLink.exists()).toBe(true);
    expect(fredLink.text()).toContain("FRED");
    expect(fredLink.attributes("target")).toBe("_blank");
  });

  it("renders VC date range", () => {
    const wrapper = mount(OQEconomicReality, { props: {} });
    expect(wrapper.text()).toContain("2024-2026");
  });

  it("renders drill-down trigger", () => {
    const wrapper = mount(OQEconomicReality, { props: {} });
    expect(wrapper.text()).toContain("Drill down");
  });

  it("shows VC breakdown in drill-down when expanded", async () => {
    const wrapper = mount(OQEconomicReality, { props: {} });
    const trigger = wrapper.find("[data-slot='collapsible-trigger']");
    await trigger.trigger("click");

    expect(wrapper.text()).toContain("Cursor");
    expect(wrapper.text()).toContain("$400M Series C");
    expect(wrapper.text()).toContain("Cognition");
  });

  it("shows CEPR study in drill-down when expanded", async () => {
    const wrapper = mount(OQEconomicReality, { props: {} });
    const trigger = wrapper.find("[data-slot='collapsible-trigger']");
    await trigger.trigger("click");

    expect(wrapper.text()).toContain("CEPR");
    expect(wrapper.text()).toContain("12,000+ European firms");
    expect(wrapper.text()).toContain("0 job losses");
  });
});
