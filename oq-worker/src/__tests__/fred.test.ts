import { describe, it, expect } from "vitest";
import { buildTrend } from "../services/fred";

describe("buildTrend", () => {
  it("returns null for empty observations", () => {
    expect(buildTrend([])).toBeNull();
  });

  it("returns current value with no changes for single observation", () => {
    const trend = buildTrend([{ date: "2026-02-14", value: "47.3" }]);
    expect(trend).toEqual({
      current: 47.3,
      currentDate: "2026-02-14",
    });
  });

  it("computes 1-week change from weekly observations", () => {
    const trend = buildTrend([
      { date: "2026-02-14", value: "47.3" },
      { date: "2026-02-07", value: "50.0" },
    ]);
    expect(trend).toMatchObject({
      current: 47.3,
      currentDate: "2026-02-14",
      previous: 50.0,
      previousDate: "2026-02-07",
      change1w: -5.4,
    });
  });

  it("computes 4-week change from weekly observations", () => {
    const trend = buildTrend([
      { date: "2026-02-14", value: "100" },
      { date: "2026-02-07", value: "98" },
      { date: "2026-01-31", value: "95" },
      { date: "2026-01-24", value: "92" },
      { date: "2026-01-17", value: "80" },
    ]);
    expect(trend).toMatchObject({
      current: 100,
      change1w: 2,
      change4w: 25, // (100-80)/80 * 100 = 25%
    });
  });

  it("computes correct trends from daily observations", () => {
    // Daily data: 1-week = observation ~7 days ago, not index 1
    const trend = buildTrend([
      { date: "2026-02-14", value: "70.47" },
      { date: "2026-02-13", value: "70.68" },
      { date: "2026-02-12", value: "70.52" },
      { date: "2026-02-11", value: "70.40" },
      { date: "2026-02-10", value: "70.35" },
      { date: "2026-02-09", value: "70.20" },
      { date: "2026-02-08", value: "70.10" },
      { date: "2026-02-07", value: "69.50" }, // ~7 days ago
    ]);
    expect(trend!.current).toBe(70.47);
    // 1-week change should compare to Feb 7 (index 7), not Feb 13 (index 1)
    expect(trend!.change1w).toBeCloseTo(1.4, 1);
  });

  it("finds closest 4-week observation from daily data", () => {
    // Build 30 daily observations
    const obs = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(2026, 1, 28 - i).toISOString().slice(0, 10),
      value: String(100 - i * 0.5),
    }));
    const trend = buildTrend(obs);
    // 4-week = 28 days ago = index ~28, value = 100 - 28*0.5 = 86
    expect(trend!.change4w).toBeCloseTo(16.3, 0);
  });

  it("handles NaN values gracefully", () => {
    const trend = buildTrend([{ date: "2026-02-14", value: "not-a-number" }]);
    expect(trend).toBeNull();
  });

  it("rounds to 1 decimal place", () => {
    const trend = buildTrend([
      { date: "2026-02-14", value: "33.33" },
      { date: "2026-02-07", value: "33.00" },
    ]);
    // (33.33 - 33) / 33 * 100 = 1.0%
    expect(trend!.change1w).toBe(1);
  });
});
