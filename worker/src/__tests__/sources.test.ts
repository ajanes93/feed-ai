import { describe, it, expect } from "vitest";
import { sources, CATEGORY_LIMITS, FRESHNESS_THRESHOLDS } from "../sources";

describe("sources", () => {
  it("has no duplicate source IDs", () => {
    const ids = sources.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate URLs", () => {
    const urls = sources.map((s) => s.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("every source has required fields", () => {
    for (const source of sources) {
      expect(source.id).toBeTruthy();
      expect(source.name).toBeTruthy();
      if (source.type === "bluesky") {
        expect(source.url).toBeTruthy();
      } else {
        expect(source.url).toMatch(/^https?:\/\//);
      }
      expect([
        "rss",
        "reddit",
        "hn",
        "github",
        "bluesky",
        "api",
        "scrape",
      ]).toContain(source.type);
      expect(["ai", "dev", "jobs", "sport"]).toContain(source.category);
    }
  });

  it("has sources in all categories", () => {
    const categories = new Set(sources.map((s) => s.category));
    expect(categories).toEqual(new Set(["ai", "dev", "jobs", "sport"]));
  });

  it("CATEGORY_LIMITS covers all categories", () => {
    const categories = new Set(sources.map((s) => s.category));
    for (const cat of categories) {
      expect(CATEGORY_LIMITS[cat]).toBeGreaterThan(0);
    }
  });

  it("FRESHNESS_THRESHOLDS covers all categories", () => {
    const categories = new Set(sources.map((s) => s.category));
    for (const cat of categories) {
      expect(FRESHNESS_THRESHOLDS[cat]).toBeGreaterThan(0);
    }
  });
});
