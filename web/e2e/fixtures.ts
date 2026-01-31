import { test as base, type Page } from "@playwright/test";

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

/** Standard test digest with items across all categories */
const TEST_DIGEST = {
  id: "digest-2025-01-28",
  date: "2025-01-28",
  itemCount: 5,
  items: [
    buildDigestItem({ category: "ai", title: "AI Breakthrough" }, 1),
    buildDigestItem({ category: "ai", title: "Machine Learning Update" }, 2),
    buildDigestItem({ category: "dev", title: "Rust 2.0 Released" }, 3),
    buildDigestItem({ category: "dev", title: "TypeScript 6.0" }, 4),
    buildDigestItem({ category: "jobs", title: "Senior Engineer at Acme" }, 5),
  ],
};

const TEST_DIGEST_LIST = [{ date: "2025-01-28" }, { date: "2025-01-27" }];

const TEST_DIGEST_JAN_27 = {
  id: "digest-2025-01-27",
  date: "2025-01-27",
  itemCount: 1,
  items: [buildDigestItem({ category: "ai", title: "Yesterday Story" }, 1)],
};

/** Mock all API routes with standard test data */
async function mockApi(page: Page) {
  await page.route("**/api/digests", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(TEST_DIGEST_LIST),
    }),
  );

  await page.route("**/api/digest/2025-01-28", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(TEST_DIGEST),
    }),
  );

  await page.route("**/api/digest/2025-01-27", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(TEST_DIGEST_JAN_27),
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

export { TEST_DIGEST, TEST_DIGEST_LIST, TEST_DIGEST_JAN_27, buildDigestItem };
export { expect } from "@playwright/test";
