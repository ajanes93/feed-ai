import { test as base, expect, type Page } from "@playwright/test";

const DASHBOARD_DATA = {
  ai: {
    recentCalls: [
      {
        id: "1",
        model: "gemini-2.0-flash",
        provider: "gemini",
        inputTokens: 5000,
        outputTokens: 2000,
        totalTokens: 7000,
        latencyMs: 3200,
        wasFallback: false,
        error: null,
        status: "success",
        createdAt: Math.floor(Date.now() / 1000) - 3600,
      },
    ],
    totalTokens: 7000,
    rateLimitCount: 0,
    fallbackCount: 0,
  },
  sources: [
    {
      sourceId: "anthropic-news",
      sourceName: "Anthropic News",
      category: "ai",
      lastSuccessAt: Math.floor(Date.now() / 1000) - 3600,
      lastErrorAt: null,
      lastError: null,
      itemCount: 5,
      consecutiveFailures: 0,
      stale: false,
    },
  ],
  errors: [],
  totalDigests: 42,
};

async function mockDashboardApi(page: Page) {
  await page.route("**/api/admin/dashboard", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(DASHBOARD_DATA),
    }),
  );
}

const test = base.extend<{ dashboardPage: Page }>({
  dashboardPage: async ({ page }, use) => {
    // Set admin key in sessionStorage before navigating
    await page.goto("/dashboard");
    await page.evaluate(() =>
      sessionStorage.setItem("admin_key", "test-admin-key"),
    );
    await mockDashboardApi(page);
    await page.reload();
    await use(page);
  },
});

test.describe("Dashboard", () => {
  test("shows auth prompt without admin key", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByText("Enter admin key to access the dashboard"),
    ).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("loads dashboard after entering admin key", async ({ page }) => {
    await page.goto("/dashboard");
    await mockDashboardApi(page);

    await page.locator('input[type="password"]').fill("test-admin-key");
    await page.locator('input[type="password"]').press("Enter");

    await expect(page.getByText("Total Digests")).toBeVisible();
    await expect(page.getByText("42")).toBeVisible();
  });

  test("renders Rebuild Today button", async ({ dashboardPage }) => {
    await expect(
      dashboardPage.getByRole("button", { name: "Rebuild Today" }),
    ).toBeVisible();
  });

  test("shows Rebuilding state when rebuild is clicked", async ({
    dashboardPage,
  }) => {
    await dashboardPage.route("**/api/rebuild", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: "Generated digest with 15 items",
      }),
    );

    await dashboardPage.getByRole("button", { name: "Rebuild Today" }).click();

    await expect(
      dashboardPage.getByText("Generated digest with 15 items"),
    ).toBeVisible();
  });

  test("shows success message after rebuild completes", async ({
    dashboardPage,
  }) => {
    await dashboardPage.route("**/api/rebuild", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: "Generated digest with 12 items",
      }),
    );

    await dashboardPage.getByRole("button", { name: "Rebuild Today" }).click();

    await expect(
      dashboardPage.getByText("Generated digest with 12 items"),
    ).toBeVisible();
  });

  test("shows error message when rebuild fails", async ({ dashboardPage }) => {
    await dashboardPage.route("**/api/rebuild", (route) =>
      route.fulfill({
        status: 500,
        contentType: "text/plain",
        body: "No items fetched",
      }),
    );

    await dashboardPage.getByRole("button", { name: "Rebuild Today" }).click();

    await expect(dashboardPage.getByText("No items fetched")).toBeVisible();
  });

  test("navigates back to feed via link", async ({ dashboardPage }) => {
    await dashboardPage.getByText("Back to Feed").click();
    await expect(dashboardPage).toHaveURL("/");
  });
});
