import { test, expect, buildTestData, feedSlide } from "./fixtures";

test.describe("Date navigation", () => {
  test("displays formatted date in header", async ({ mockPage }) => {
    await mockPage.goto("/");

    const formatted = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    await expect(mockPage.getByText(formatted)).toBeVisible();
  });

  test("shows story count in header", async ({ mockPage }) => {
    await mockPage.goto("/");

    // Shows count for active category (AI has 2 items)
    await expect(mockPage.getByText("2 stories")).toBeVisible();
  });

  test("previous button navigates to older digest", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(
      feedSlide(mockPage).getByText("AI Breakthrough")
    ).toBeVisible();

    await mockPage.getByLabel("Previous digest").click();
    await expect(
      feedSlide(mockPage).getByText("Yesterday Story")
    ).toBeVisible();
  });

  test("navigating to older digest updates the URL", async ({ mockPage }) => {
    const { yesterday } = buildTestData();

    await mockPage.goto("/");
    await expect(
      feedSlide(mockPage).getByText("AI Breakthrough")
    ).toBeVisible();

    await mockPage.getByLabel("Previous digest").click();
    await expect(
      feedSlide(mockPage).getByText("Yesterday Story")
    ).toBeVisible();

    await expect(mockPage).toHaveURL(new RegExp(yesterday));
  });

  test("direct URL loads the correct digest", async ({ mockPage }) => {
    const { yesterday } = buildTestData();

    await mockPage.goto(`/digest/${yesterday}`);

    await expect(
      feedSlide(mockPage).getByText("Yesterday Story")
    ).toBeVisible();
  });

  test("pull-to-refresh on old digest stays on that digest", async ({
    mockPage,
  }) => {
    const { yesterday } = buildTestData();

    await mockPage.goto("/");
    await mockPage.getByLabel("Previous digest").click();
    await expect(
      feedSlide(mockPage).getByText("Yesterday Story")
    ).toBeVisible();
    await expect(mockPage).toHaveURL(new RegExp(yesterday));

    // Simulate pull-to-refresh gesture (needs > 25px dead zone + enough for 80px threshold at 0.4 damping)
    const box = (await mockPage.locator("body").boundingBox())!;
    const x = box.width / 2;
    await mockPage.dispatchEvent("body", "touchstart", {
      touches: [{ clientX: x, clientY: 100, identifier: 0 }],
      changedTouches: [{ clientX: x, clientY: 100, identifier: 0 }],
    });
    for (let y = 130; y <= 400; y += 30) {
      await mockPage.dispatchEvent("body", "touchmove", {
        touches: [{ clientX: x, clientY: y, identifier: 0 }],
        changedTouches: [{ clientX: x, clientY: y, identifier: 0 }],
      });
    }
    await mockPage.dispatchEvent("body", "touchend", {
      touches: [],
      changedTouches: [{ clientX: x, clientY: 400, identifier: 0 }],
    });

    // Should still show yesterday's digest, not today's
    await expect(
      feedSlide(mockPage).getByText("Yesterday Story")
    ).toBeVisible();
    await expect(mockPage).toHaveURL(new RegExp(yesterday));
  });

  test("previous digest URL persists after reload", async ({ mockPage }) => {
    const { yesterday } = buildTestData();

    await mockPage.goto("/");
    await expect(
      feedSlide(mockPage).getByText("AI Breakthrough")
    ).toBeVisible();

    await mockPage.getByLabel("Previous digest").click();
    await expect(mockPage).toHaveURL(new RegExp(yesterday));
    await expect(
      feedSlide(mockPage).getByText("Yesterday Story")
    ).toBeVisible();

    await mockPage.reload();

    await expect(mockPage).toHaveURL(new RegExp(yesterday));
    await expect(
      feedSlide(mockPage).getByText("Yesterday Story")
    ).toBeVisible();
  });
});

test.describe("Category filter", () => {
  test("renders all category buttons", async ({ mockPage }) => {
    await mockPage.goto("/");
    const filter = mockPage.getByTestId("category-filter");

    await expect(filter.getByRole("button", { name: /AI/ })).toBeVisible();
    await expect(filter.getByRole("button", { name: /Dev/ })).toBeVisible();
    await expect(filter.getByRole("button", { name: /Jobs/ })).toBeVisible();
    await expect(filter.getByRole("button", { name: /Sport/ })).toBeVisible();
  });

  test("shows correct counts per category", async ({ mockPage }) => {
    await mockPage.goto("/");
    const filter = mockPage.getByTestId("category-filter");

    const aiBtn = filter.getByRole("button", { name: /AI/ });
    await expect(aiBtn).toContainText("2");

    const devBtn = filter.getByRole("button", { name: /Dev/ });
    await expect(devBtn).toContainText("2");
  });

  test("category filter highlights active category", async ({ mockPage }) => {
    await mockPage.goto("/");
    const filter = mockPage.getByTestId("category-filter");

    // AI is the default active category
    const aiBtn = filter.getByRole("button", { name: /AI/ });
    await expect(aiBtn).toHaveClass(/text-background/);
  });
});
