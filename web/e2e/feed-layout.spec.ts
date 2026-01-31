import { test, expect } from "./fixtures";

test.describe("Feed layout", () => {
  test("digest cards are visible in the viewport", async ({ mockPage }) => {
    await mockPage.goto("/");

    const cards = mockPage.locator("article");
    await expect(cards.first()).toBeVisible();
    await expect(cards.first()).toBeInViewport();
  });

  test("all cards render with non-zero height", async ({ mockPage }) => {
    await mockPage.goto("/");

    const cards = mockPage.locator("article");
    await expect(cards.first()).toBeVisible();

    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThan(50);
      expect(box!.width).toBeGreaterThan(100);
    }
  });

  test("cards are scrollable within the feed container", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");

    const firstCard = mockPage.locator("article").first();
    await expect(firstCard).toBeVisible();

    // Find the scroll container
    const scrollContainer = mockPage.locator("[data-scroll-container]").first();
    const initialScroll = await scrollContainer.evaluate(
      (el) => el.scrollTop,
    );

    // Scroll down
    await scrollContainer.evaluate((el) => el.scrollBy(0, 200));
    const afterScroll = await scrollContainer.evaluate((el) => el.scrollTop);

    // If there are enough cards to scroll, scroll position should change
    const cardCount = await mockPage.locator("article").count();
    if (cardCount > 2) {
      expect(afterScroll).toBeGreaterThan(initialScroll);
    }
  });

  test("feed container fills viewport height", async ({ mockPage }) => {
    await mockPage.goto("/");

    await expect(mockPage.locator("article").first()).toBeVisible();

    const viewport = mockPage.viewportSize();
    const rootEl = mockPage.locator("body > #app > div").first();
    const box = await rootEl.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.height).toBeCloseTo(viewport!.height, -1);
  });
});

test.describe("Feed content", () => {
  test("renders card titles from digest data", async ({ mockPage }) => {
    await mockPage.goto("/");

    await expect(mockPage.getByText("AI Breakthrough")).toBeVisible();
    await expect(mockPage.getByText("Rust 2.0 Released")).toBeVisible();
  });

  test("renders card summaries", async ({ mockPage }) => {
    await mockPage.goto("/");

    await expect(mockPage.getByText("Summary for story 1")).toBeVisible();
  });

  test("renders category badges", async ({ mockPage }) => {
    await mockPage.goto("/");

    await expect(
      mockPage.locator("article").first().getByText("AI"),
    ).toBeVisible();
  });

  test("renders source names", async ({ mockPage }) => {
    await mockPage.goto("/");

    await expect(
      mockPage.locator("article").first().getByText("Test Source"),
    ).toBeVisible();
  });

  test("renders why it matters section", async ({ mockPage }) => {
    await mockPage.goto("/");

    await expect(
      mockPage.getByText("This matters for testing").first(),
    ).toBeVisible();
  });
});
