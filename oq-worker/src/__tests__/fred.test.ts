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

  it("computes 1-week change from two observations", () => {
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

  it("computes 4-week change from 5+ observations", () => {
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

  it("caps 4-week index at available observations", () => {
    // Only 3 observations: idx4w = min(4, 2) = 2, which is >= 2 so we compute
    const trend = buildTrend([
      { date: "2026-02-14", value: "100" },
      { date: "2026-02-07", value: "98" },
      { date: "2026-01-31", value: "90" },
    ]);
    expect(trend).toMatchObject({
      change1w: expect.any(Number),
      change4w: expect.any(Number), // uses index 2
    });
    expect(trend!.change4w).toBeCloseTo(11.1, 1);
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
