import { test, expect, feedSlide } from "./fixtures";

test.describe("Feed layout", () => {
  test("digest cards are visible in the viewport", async ({ mockPage }) => {
    await mockPage.goto("/");

    const cards = feedSlide(mockPage).locator("article");
    await expect(cards.first()).toBeVisible();
    await expect(cards.first()).toBeInViewport();
  });

  test("all cards render with non-zero height", async ({ mockPage }) => {
    await mockPage.goto("/");

    const cards = feedSlide(mockPage).locator("article");
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

    const container = feedSlide(mockPage);
    const firstCard = container.locator("article").first();
    await expect(firstCard).toBeVisible();

    const initialScroll = await container.evaluate((el) => el.scrollTop);
    await container.evaluate((el) => el.scrollBy(0, 200));
    const afterScroll = await container.evaluate((el) => el.scrollTop);

    const cardCount = await container.locator("article").count();
    if (cardCount > 2) {
      expect(afterScroll).toBeGreaterThan(initialScroll);
    }
  });

  test("feed container fills viewport height", async ({ mockPage }) => {
    await mockPage.goto("/");

    await expect(feedSlide(mockPage).locator("article").first()).toBeVisible();

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

    const slide = feedSlide(mockPage);
    await expect(slide.getByText("AI Breakthrough")).toBeVisible();
    await expect(slide.getByText("Rust 2.0 Released")).toBeVisible();
  });

  test("renders card summaries", async ({ mockPage }) => {
    await mockPage.goto("/");

    await expect(
      feedSlide(mockPage).getByText("Summary for story 1"),
    ).toBeVisible();
  });

  test("renders category badges", async ({ mockPage }) => {
    await mockPage.goto("/");

    await expect(
      feedSlide(mockPage).locator("article").first().getByText("AI", { exact: true }),
    ).toBeVisible();
  });

  test("renders source names", async ({ mockPage }) => {
    await mockPage.goto("/");

    await expect(
      feedSlide(mockPage).locator("article").first().getByText("Test Source"),
    ).toBeVisible();
  });

  test("renders why it matters section", async ({ mockPage }) => {
    await mockPage.goto("/");

    await expect(
      feedSlide(mockPage).getByText("This matters for testing").first(),
    ).toBeVisible();
  });
});
