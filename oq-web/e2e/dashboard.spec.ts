import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

/** Mock admin dashboard API */
async function mockDashboardApi(
  page: Page,
  opts?: { todayScoreExists?: boolean }
) {
  const todayScoreExists = opts?.todayScoreExists ?? false;

  await page.route("**/api/admin/dashboard", (route) => {
    const auth = route.request().headers()["authorization"];
    if (!auth || !auth.startsWith("Bearer ")) {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        totalScores: 14,
        totalArticles: 328,
        totalSubscribers: 5,
        todayScoreExists,
        ai: {
          totalTokens: 125000,
          recentCalls: [
            {
              id: "call-1",
              model: "claude-sonnet-4-5-20250929",
              provider: "anthropic",
              inputTokens: 2500,
              outputTokens: 800,
              totalTokens: 3300,
              latencyMs: 1200,
              wasFallback: false,
              error: null,
              status: "success",
              createdAt: new Date().toISOString(),
            },
            {
              id: "call-2",
              model: "gemini-2.0-flash",
              provider: "google",
              inputTokens: 1800,
              outputTokens: 600,
              totalTokens: 2400,
              latencyMs: 900,
              wasFallback: false,
              error: null,
              status: "success",
              createdAt: new Date().toISOString(),
            },
          ],
        },
        sources: [
          {
            sourceName: "TechCrunch",
            pillar: "capability",
            articleCount: 42,
            lastFetched: new Date().toISOString(),
          },
          {
            sourceName: "HN Jobs",
            pillar: "labour_market",
            articleCount: 15,
            lastFetched: new Date().toISOString(),
          },
        ],
      }),
    });
  });

  await page.route("**/api/fetch", (route) => {
    const auth = route.request().headers()["authorization"];
    if (!auth || !auth.startsWith("Bearer ")) {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ fetched: 12, errors: [] }),
    });
  });

  await page.route("**/api/score", (route) => {
    const auth = route.request().headers()["authorization"];
    if (!auth || !auth.startsWith("Bearer ")) {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ score: 33, delta: 0.3, date: "2025-01-15" }),
    });
  });

  await page.route("**/api/delete-score", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ deleted: true, date: "2025-01-15" }),
    });
  });

  await page.route("**/api/predigest", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        articleCount: 42,
        pillarCounts: { capability: 10 },
        preDigested: false,
        date: "2025-01-15",
      }),
    });
  });
}

/** Set admin key in sessionStorage and navigate to dashboard */
async function gotoDashboard(page: Page) {
  // Navigate first so we have an origin, then set sessionStorage
  await page.goto("/dashboard");
  await page.evaluate(() => sessionStorage.setItem("oq_admin_key", "test-key"));
  // Reload to trigger fetchDashboard with the key
  await page.goto("/dashboard");
}

test.describe("Dashboard", () => {
  test("shows auth prompt without admin key", async ({ page }) => {
    await mockDashboardApi(page);
    await page.goto("/dashboard");
    await expect(
      page.getByText("Enter admin key to access the dashboard")
    ).toBeVisible();
  });

  test("displays dashboard stats after auth", async ({ page }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);
    await expect(page.getByText("OQ Dashboard")).toBeVisible();
    await expect(page.getByText("Total Scores")).toBeVisible();
    await expect(page.getByText("Total Articles")).toBeVisible();
    await expect(page.getByText("Tokens (recent)")).toBeVisible();
    await expect(page.getByText("Subscribers")).toBeVisible();
  });

  test("renders AI usage section", async ({ page }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);
    await expect(page.getByText("AI Usage")).toBeVisible();
    await expect(page.getByText("Claude")).toBeVisible();
    await expect(page.getByText("Gemini")).toBeVisible();
  });

  test("renders sources section", async ({ page }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);
    await expect(page.getByText("Sources")).toBeVisible();
    await expect(page.getByText("TechCrunch")).toBeVisible();
    await expect(page.getByText("HN Jobs")).toBeVisible();
  });

  test("has link to public view", async ({ page }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);
    await expect(page.getByText("Public View")).toBeVisible();
  });

  test("shows actions dropdown after auth", async ({ page }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);
    await expect(page.getByText("Actions")).toBeVisible();
  });

  test("submits admin key via form", async ({ page }) => {
    await mockDashboardApi(page);
    await page.goto("/dashboard");
    await expect(
      page.getByText("Enter admin key to access the dashboard")
    ).toBeVisible();

    await page.getByPlaceholder("Admin key").fill("test-key");
    await page.getByRole("button", { name: "Go" }).click();

    await expect(page.getByText("OQ Dashboard")).toBeVisible();
    await expect(page.getByText("Total Scores")).toBeVisible();
  });

  test("disables Score button when today's score exists", async ({ page }) => {
    await mockDashboardApi(page, { todayScoreExists: true });
    await gotoDashboard(page);

    await page.getByText("Actions").click();
    // Score menu item should show "delete first" hint
    await expect(page.getByText("Score (delete first)")).toBeVisible();
  });

  test("shows Delete Score, Predigest, and Score in actions menu", async ({
    page,
  }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);

    await page.getByText("Actions").click();
    await expect(page.getByText("Delete Score")).toBeVisible();
    await expect(page.getByText("Predigest")).toBeVisible();
    await expect(
      page.getByText("Score", { exact: true }).first()
    ).toBeVisible();
  });

  test("Delete Score shows success result", async ({ page }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);

    await page.getByText("Actions").click();
    await page.getByText("Delete Score").click();

    await expect(page.getByText(/Deleted score/)).toBeVisible();
  });

  test("Predigest shows success result", async ({ page }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);

    await page.getByText("Actions").click();
    await page.getByText("Predigest").click();

    await expect(page.getByText(/Pre-digested 42 articles/)).toBeVisible();
  });

  test("shows friendly error when dashboard API network fails", async ({
    page,
  }) => {
    // Abort the dashboard request to simulate iOS Safari TypeError
    await page.route("**/api/admin/dashboard", (route) => route.abort());
    await page.route("**/api/admin/logs*", (route) => route.abort());

    await page.goto("/dashboard");
    await page.evaluate(() =>
      sessionStorage.setItem("oq_admin_key", "test-key")
    );
    await page.goto("/dashboard");

    // Should show friendly network error, not raw "Type error"
    await expect(page.getByText(/Network error.*Refresh/)).toBeVisible();
    await expect(page.getByText("Type error")).not.toBeVisible();
  });
});
