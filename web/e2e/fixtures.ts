import { test as base, type Page } from "@playwright/test";

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function yesterdayDate(): string {
  return new Date(Date.now() - 86400000).toISOString().split("T")[0];
}

/** Digest item matching the worker API shape */
function buildDigestItem(
  overrides: Partial<{
    id: string;
    category: string;
    title: string;
    summary: string;
    whyItMatters: string;
    sourceName: string;
    sourceUrl: string;
    publishedAt: string;
    position: number;
  }> = {},
  seq = 1,
) {
  return {
    id: overrides.id ?? `item-${seq}`,
    category: overrides.category ?? "ai",
    title: overrides.title ?? `Test Story ${seq}`,
    summary: overrides.summary ?? `Summary for story ${seq}`,
    whyItMatters: overrides.whyItMatters ?? "This matters for testing",
    sourceName: overrides.sourceName ?? "Test Source",
    sourceUrl: overrides.sourceUrl ?? `https://example.com/${seq}`,
    publishedAt: overrides.publishedAt ?? "2025-01-28T10:00:00Z",
    position: overrides.position ?? seq,
  };
}

/** Build test data with dynamic dates (today + yesterday) */
function buildTestData() {
  const today = todayDate();
  const yesterday = yesterdayDate();

  const todayDigest = {
    id: `digest-${today}`,
    date: today,
    itemCount: 5,
    items: [
      buildDigestItem({ category: "ai", title: "AI Breakthrough" }, 1),
      buildDigestItem({ category: "ai", title: "Machine Learning Update" }, 2),
      buildDigestItem({ category: "dev", title: "Rust 2.0 Released" }, 3),
      buildDigestItem({ category: "dev", title: "TypeScript 6.0" }, 4),
      buildDigestItem(
        { category: "jobs", title: "Senior Engineer at Acme" },
        5,
      ),
    ],
  };

  const yesterdayDigest = {
    id: `digest-${yesterday}`,
    date: yesterday,
    itemCount: 1,
    items: [buildDigestItem({ category: "ai", title: "Yesterday Story" }, 1)],
  };

  const digestList = [{ date: today }, { date: yesterday }];

  return { today, yesterday, todayDigest, yesterdayDigest, digestList };
}

/** Mock all API routes with standard test data */
async function mockApi(page: Page) {
  const { today, yesterday, todayDigest, yesterdayDigest, digestList } =
    buildTestData();

  await page.route("**/api/digests", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(digestList),
    }),
  );

  await page.route(`**/api/digest/${today}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(todayDigest),
    }),
  );

  await page.route(`**/api/digest/${yesterday}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(yesterdayDigest),
    }),
  );
}

/**
 * Extended test fixture that mocks API before each test.
 * Tests get a page with all API routes pre-mocked.
 */
export const test = base.extend<{ mockPage: Page }>({
  mockPage: async ({ page }, use) => {
    await mockApi(page);
    await use(page);
  },
});

export { buildDigestItem, buildTestData };
export { expect } from "@playwright/test";
