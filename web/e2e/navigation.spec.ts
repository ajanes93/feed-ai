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

    await expect(mockPage.getByText("5 stories")).toBeVisible();
  });

  test("previous button navigates to older digest", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(feedSlide(mockPage).getByText("AI Breakthrough")).toBeVisible();

    await mockPage.getByLabel("Previous digest").click();
    await expect(feedSlide(mockPage).getByText("Yesterday Story")).toBeVisible();
  });

  test("navigating to older digest updates the URL", async ({ mockPage }) => {
    const { yesterday } = buildTestData();

    await mockPage.goto("/");
    await expect(feedSlide(mockPage).getByText("AI Breakthrough")).toBeVisible();

    await mockPage.getByLabel("Previous digest").click();
    await expect(feedSlide(mockPage).getByText("Yesterday Story")).toBeVisible();

    await expect(mockPage).toHaveURL(new RegExp(yesterday));
  });

  test("direct URL loads the correct digest", async ({ mockPage }) => {
    const { yesterday } = buildTestData();

    await mockPage.goto(`/digest/${yesterday}`);

    await expect(feedSlide(mockPage).getByText("Yesterday Story")).toBeVisible();
  });

  test("previous digest URL persists after reload", async ({ mockPage }) => {
    const { yesterday } = buildTestData();

    await mockPage.goto("/");
    await expect(feedSlide(mockPage).getByText("AI Breakthrough")).toBeVisible();

    await mockPage.getByLabel("Previous digest").click();
    await expect(mockPage).toHaveURL(new RegExp(yesterday));
    await expect(feedSlide(mockPage).getByText("Yesterday Story")).toBeVisible();

    await mockPage.reload();

    await expect(mockPage).toHaveURL(new RegExp(yesterday));
    await expect(feedSlide(mockPage).getByText("Yesterday Story")).toBeVisible();
  });
});

test.describe("Category filter", () => {
  test("renders all category buttons", async ({ mockPage }) => {
    await mockPage.goto("/");

    await expect(mockPage.getByRole("button", { name: /All/ })).toBeVisible();
    await expect(mockPage.getByRole("button", { name: /AI/ })).toBeVisible();
    await expect(mockPage.getByRole("button", { name: /Dev/ })).toBeVisible();
    await expect(mockPage.getByRole("button", { name: /Jobs/ })).toBeVisible();
  });

  test("shows correct counts per category", async ({ mockPage }) => {
    await mockPage.goto("/");

    const allBtn = mockPage.getByRole("button", { name: /All/ });
    await expect(allBtn).toContainText("5");

    const aiBtn = mockPage.getByRole("button", { name: /AI/ });
    await expect(aiBtn).toContainText("2");
  });

  test("category filter highlights active category", async ({ mockPage }) => {
    await mockPage.goto("/");

    const allBtn = mockPage.getByRole("button", { name: /All/ });
    await expect(allBtn).toHaveClass(/text-gray-950/);
  });
});
