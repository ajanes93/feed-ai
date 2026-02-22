import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import OQEconomicReality from "../../components/OQEconomicReality.vue";

describe("OQEconomicReality", () => {
  const global = { stubs: { OQExplainer: true } };

  it("renders section header", () => {
    const wrapper = mount(OQEconomicReality, { props: {}, global });
    expect(wrapper.text()).toContain("The Economic Reality");
  });

  it("shows default software index (~70) when not provided", () => {
    const wrapper = mount(OQEconomicReality, { props: {}, global });
    expect(wrapper.text()).toContain("~70");
  });

  it("shows provided software index", () => {
    const wrapper = mount(OQEconomicReality, {
      props: { softwareIndex: 47.3 },
      global,
    });
    expect(wrapper.text()).toContain("~47.3");
  });

  it("shows Indeed Software Index label", () => {
    const wrapper = mount(OQEconomicReality, { props: {}, global });
    expect(wrapper.text()).toContain("Indeed Software Index");
  });

  it("shows baseline reference", () => {
    const wrapper = mount(OQEconomicReality, { props: {}, global });
    expect(wrapper.text()).toContain("vs 100 baseline");
  });

  it("shows 4-week trend when provided", () => {
    const wrapper = mount(OQEconomicReality, {
      props: {
        softwareIndex: 47,
        softwareTrend: { change4w: -12.1 },
      },
      global,
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
      global,
    });
    expect(wrapper.text()).toContain("+3.5%");
  });

  it("hides trend when softwareTrend not provided", () => {
    const wrapper = mount(OQEconomicReality, {
      props: { softwareIndex: 47 },
      global,
    });
    expect(wrapper.text()).not.toContain("4wk");
  });

  it("applies red color for negative trend", () => {
    const wrapper = mount(OQEconomicReality, {
      props: {
        softwareIndex: 47,
        softwareTrend: { change4w: -5 },
      },
      global,
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
      global,
    });
    const trendEl = wrapper.find("[data-testid='software-trend']");
    expect(trendEl.exists()).toBe(true);
    expect(trendEl.classes()).toContain("text-emerald-400");
  });

  it("renders FRED source link", () => {
    const wrapper = mount(OQEconomicReality, { props: {}, global });
    const fredLink = wrapper.find(
      'a[href="https://fred.stlouisfed.org/series/IHLIDXUSTPSOFTDEVE"]'
    );
    expect(fredLink.exists()).toBe(true);
    expect(fredLink.text()).toContain("FRED");
    expect(fredLink.attributes("target")).toBe("_blank");
  });

  it("renders drill-down trigger", () => {
    const wrapper = mount(OQEconomicReality, { props: {}, global });
    expect(wrapper.text()).toContain("Drill down");
  });

  it("shows funding context in drill-down when expanded", async () => {
    const wrapper = mount(OQEconomicReality, { props: {}, global });
    const trigger = wrapper.find("[data-slot='collapsible-trigger']");
    await trigger.trigger("click");

    expect(wrapper.text()).toContain("AI Funding Context");
    expect(wrapper.text()).toContain("daily RSS pipeline");
  });

  it("shows CEPR study in drill-down when expanded", async () => {
    const wrapper = mount(OQEconomicReality, { props: {}, global });
    const trigger = wrapper.find("[data-slot='collapsible-trigger']");
    await trigger.trigger("click");

    expect(wrapper.text()).toContain("CEPR");
    expect(wrapper.text()).toContain("12,000+ European firms");
    expect(wrapper.text()).toContain("0 job losses");
  });

  it("renders dynamic note when provided", () => {
    const wrapper = mount(OQEconomicReality, {
      props: { note: "Indeed index dropped 2 points this week." },
      global,
    });
    const noteEl = wrapper.find("[data-testid='economic-note']");
    expect(noteEl.exists()).toBe(true);
    expect(noteEl.text()).toContain("Indeed index dropped 2 points");
  });

  it("hides note when not provided", () => {
    const wrapper = mount(OQEconomicReality, { props: {}, global });
    const noteEl = wrapper.find("[data-testid='economic-note']");
    expect(noteEl.exists()).toBe(false);
  });

  it("shows Updated date in FRED link when softwareDate provided", () => {
    const wrapper = mount(OQEconomicReality, {
      props: { softwareIndex: 70, softwareDate: "2026-02-15" },
      global,
    });
    const fredLink = wrapper.find(
      'a[href="https://fred.stlouisfed.org/series/IHLIDXUSTPSOFTDEVE"]'
    );
    expect(fredLink.text()).toContain("Updated");
    expect(fredLink.text()).toContain("2026-02-15");
  });
});
