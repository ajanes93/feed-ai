import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { deduplicateItems, capPerSource, splitJobsAndNews } from "../index";
import { rawItemFactory } from "./factories";
import { seedDigest } from "./helpers";
import { sources } from "../sources";

describe("deduplicateItems", () => {
  it("removes items with matching URLs from recent digests", async () => {
    await seedDigest(
      env.DB,
      {
        id: "digest-old",
        date: new Date().toISOString().split("T")[0],
        itemCount: 1,
      },
      [
        {
          id: "existing-1",
          category: "ai",
          title: "Existing Article",
          summary: "Already seen",
          sourceName: "HN",
          sourceUrl: "https://example.com/already-seen",
          position: 0,
        },
      ]
    );

    const items = [
      rawItemFactory.build({
        link: "https://example.com/already-seen",
        title: "Different Title",
      }),
      rawItemFactory.build({
        link: "https://example.com/new-article",
        title: "New Article",
      }),
    ];

    const deduped = await deduplicateItems(items, env.DB);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].link).toBe("https://example.com/new-article");
  });

  it("removes items with matching titles (case-insensitive)", async () => {
    await seedDigest(
      env.DB,
      {
        id: "digest-title",
        date: new Date().toISOString().split("T")[0],
        itemCount: 1,
      },
      [
        {
          id: "existing-2",
          category: "dev",
          title: "Vue 4 Released",
          summary: "Big news",
          sourceName: "Vue Blog",
          sourceUrl: "https://vue.com/4",
          position: 0,
        },
      ]
    );

    const items = [
      rawItemFactory.build({
        link: "https://other-site.com/vue4",
        title: "vue 4 released",
      }),
      rawItemFactory.build({
        link: "https://example.com/unique",
        title: "Unique Article",
      }),
    ];

    const deduped = await deduplicateItems(items, env.DB);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].title).toBe("Unique Article");
  });

  it("keeps all items when no previous digests exist", async () => {
    const items = rawItemFactory.buildList(3);

    const deduped = await deduplicateItems(items, env.DB);

    expect(deduped).toHaveLength(3);
  });
});

describe("capPerSource", () => {
  it("limits items per source to the given max", () => {
    const items = [
      rawItemFactory.build({ sourceId: "src-a", publishedAt: Date.now() }),
      rawItemFactory.build({
        sourceId: "src-a",
        publishedAt: Date.now() - 1000,
      }),
      rawItemFactory.build({
        sourceId: "src-a",
        publishedAt: Date.now() - 2000,
      }),
      rawItemFactory.build({
        sourceId: "src-a",
        publishedAt: Date.now() - 3000,
      }),
      rawItemFactory.build({ sourceId: "src-b", publishedAt: Date.now() }),
    ];

    const capped = capPerSource(items, 2);

    const srcA = capped.filter((i) => i.sourceId === "src-a");
    const srcB = capped.filter((i) => i.sourceId === "src-b");
    expect(srcA).toHaveLength(2);
    expect(srcB).toHaveLength(1);
  });

  it("keeps newest items per source", () => {
    const now = Date.now();
    const items = [
      rawItemFactory.build({
        sourceId: "src-a",
        publishedAt: now - 3000,
        title: "Old",
      }),
      rawItemFactory.build({
        sourceId: "src-a",
        publishedAt: now,
        title: "New",
      }),
      rawItemFactory.build({
        sourceId: "src-a",
        publishedAt: now - 1000,
        title: "Mid",
      }),
    ];

    const capped = capPerSource(items, 2);

    expect(capped).toHaveLength(2);
    expect(capped[0].title).toBe("New");
    expect(capped[1].title).toBe("Mid");
  });

  it("handles items with no publish date", () => {
    const items = [
      rawItemFactory.build({ sourceId: "src-a", publishedAt: undefined }),
      rawItemFactory.build({ sourceId: "src-a", publishedAt: undefined }),
      rawItemFactory.build({ sourceId: "src-a", publishedAt: undefined }),
    ];

    const capped = capPerSource(items, 2);

    expect(capped).toHaveLength(2);
  });

  it("returns all items when under the cap", () => {
    const items = rawItemFactory.buildList(2);

    const capped = capPerSource(items, 5);

    expect(capped).toHaveLength(2);
  });
});

describe("splitJobsAndNews", () => {
  it("separates items by source category", () => {
    // Use real source IDs from the config
    const jobSource = sources.find((s) => s.category === "jobs");
    const newsSource = sources.find((s) => s.category !== "jobs");

    if (!jobSource || !newsSource) {
      throw new Error("Expected at least one jobs and one non-jobs source");
    }

    const items = [
      rawItemFactory.build({ sourceId: jobSource.id }),
      rawItemFactory.build({ sourceId: newsSource.id }),
      rawItemFactory.build({ sourceId: jobSource.id }),
    ];

    const { jobItems, newsItems } = splitJobsAndNews(items);

    expect(jobItems).toHaveLength(2);
    expect(newsItems).toHaveLength(1);
  });

  it("returns empty arrays when no items match", () => {
    const { jobItems, newsItems } = splitJobsAndNews([]);

    expect(jobItems).toHaveLength(0);
    expect(newsItems).toHaveLength(0);
  });

  it("treats unknown source IDs as news", () => {
    const items = [rawItemFactory.build({ sourceId: "unknown-source" })];

    const { jobItems, newsItems } = splitJobsAndNews(items);

    expect(jobItems).toHaveLength(0);
    expect(newsItems).toHaveLength(1);
  });
});
