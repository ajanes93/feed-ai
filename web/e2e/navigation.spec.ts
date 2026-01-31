import { test, expect } from "./fixtures";

test.describe("Date navigation", () => {
  test("displays formatted date in header", async ({ mockPage }) => {
    await mockPage.goto("/");

    await expect(mockPage.getByText("January")).toBeVisible();
    await expect(mockPage.getByText("28")).toBeVisible();
  });

  test("shows story count in header", async ({ mockPage }) => {
    await mockPage.goto("/");

    await expect(mockPage.getByText("5 stories")).toBeVisible();
  });

  test("previous button navigates to older digest", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("AI Breakthrough")).toBeVisible();

    await mockPage.getByLabel("Previous digest").click();
    await expect(mockPage.getByText("Yesterday Story")).toBeVisible();
  });

  test("navigating to older digest updates the URL", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("AI Breakthrough")).toBeVisible();

    await mockPage.getByLabel("Previous digest").click();
    await expect(mockPage.getByText("Yesterday Story")).toBeVisible();

    await expect(mockPage).toHaveURL(/2025-01-27/);
  });

  test("direct URL loads the correct digest", async ({ mockPage }) => {
    await mockPage.goto("/digest/2025-01-27");

    await expect(mockPage.getByText("Yesterday Story")).toBeVisible();
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

    // All: 5, AI: 2, Dev: 2, Jobs: 1
    const allBtn = mockPage.getByRole("button", { name: /All/ });
    await expect(allBtn).toContainText("5");

    const aiBtn = mockPage.getByRole("button", { name: /AI/ });
    await expect(aiBtn).toContainText("2");
  });

  test("category filter highlights active category", async ({ mockPage }) => {
    await mockPage.goto("/");

    // "All" should be active by default
    const allBtn = mockPage.getByRole("button", { name: /All/ });
    await expect(allBtn).toHaveClass(/text-gray-950/);
  });
});
