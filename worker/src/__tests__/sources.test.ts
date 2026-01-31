import { describe, it, expect, beforeAll } from "vitest";
import { sources, CATEGORY_LIMITS, FRESHNESS_THRESHOLDS } from "../sources";

describe("sources", () => {
  let categories: Set<string>;

  beforeAll(() => {
    categories = new Set(sources.map((s) => s.category));
  });

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
      expect(source.url).toMatch(/^https?:\/\//);
      expect(["rss", "reddit", "hn", "github", "bluesky", "api"]).toContain(source.type);
      expect(["ai", "dev", "jobs"]).toContain(source.category);
    }
  });

  it("has sources in all categories", () => {
    expect(categories).toEqual(new Set(["ai", "dev", "jobs"]));
  });

  it("CATEGORY_LIMITS covers all categories", () => {
    for (const cat of categories) {
      expect(CATEGORY_LIMITS[cat]).toBeGreaterThan(0);
    }
  });

  it("FRESHNESS_THRESHOLDS covers all categories", () => {
    for (const cat of categories) {
      expect(FRESHNESS_THRESHOLDS[cat]).toBeGreaterThan(0);
    }
  });
});
