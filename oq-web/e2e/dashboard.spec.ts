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

  await page.route("**/api/admin/backfill?type=dedup-funding", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ deleted: 3, remaining: 12 }),
    });
  });

  await page.route("**/api/admin/extract-funding", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ extracted: 5, scanned: 20 }),
    });
  });

  await page.route("**/api/fetch-sanity", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ stored: 8 }),
    });
  });

  await page.route("**/api/fetch-swebench", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ stored: 15 }),
    });
  });

  await page.route("**/api/admin/purge-scores", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        scores: 5,
        modelResponses: 15,
        fundingEvents: 3,
        aiUsage: 20,
        scoreArticles: 10,
      }),
    });
  });

  await page.route("**/api/admin/purge-funding", (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ fundingEvents: 42 }),
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

  test("Delete Score shows confirm dialog and succeeds on confirm", async ({
    page,
  }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);

    await page.getByText("Actions").click();
    await page.getByText("Delete Score").click();

    // Confirm dialog should appear
    await expect(page.getByText("Delete today's score?")).toBeVisible();
    await expect(page.getByText(/re-run Predigest/)).toBeVisible();

    // Confirm the action
    await page.getByRole("button", { name: "Delete Score" }).click();

    await expect(page.getByText(/Deleted score/)).toBeVisible();
  });

  test("Predigest shows success result", async ({ page }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);

    await page.getByText("Actions").click();
    await page.getByText("Predigest").click();

    await expect(page.getByText(/Pre-digested 42 articles/)).toBeVisible();
  });

  test("shows grouped actions with section labels", async ({ page }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);

    await page.getByText("Actions").click();
    // Section labels
    await expect(page.getByText("Fetch Data")).toBeVisible();
    await expect(page.getByText("Score Pipeline")).toBeVisible();
    await expect(page.getByText("Funding", { exact: true })).toBeVisible();
    // Actions
    await expect(
      page.getByText("Dedup Funding", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Extract Funding", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("Fetch Sanity")).toBeVisible();
    await expect(page.getByText("Fetch SWE-bench")).toBeVisible();
  });

  test("Dedup Funding shows confirm dialog and succeeds on confirm", async ({
    page,
  }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);

    await page.getByText("Actions").click();
    await page.getByText("Dedup Funding").click();

    // Confirm dialog should appear
    await expect(page.getByText("Deduplicate funding rows?")).toBeVisible();
    await expect(page.getByText(/cannot be undone/)).toBeVisible();

    // Confirm the action
    await page.getByRole("button", { name: "Dedup Funding" }).click();

    await expect(
      page.getByText(/Removed 3 duplicates, 12 remaining/)
    ).toBeVisible();
  });

  test("Extract Funding shows confirm dialog and succeeds on confirm", async ({
    page,
  }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);

    await page.getByText("Actions").click();
    await page.getByText("Extract Funding", { exact: true }).click();

    // Confirm dialog should appear
    await expect(page.getByText("Extract funding events?")).toBeVisible();
    await expect(page.getByText(/API credits/)).toBeVisible();

    // Confirm the action
    await page.getByRole("button", { name: "Extract Funding" }).click();

    await expect(
      page.getByText(/Extracted 5 funding events.*20 articles scanned/)
    ).toBeVisible();
  });

  test("confirm dialog cancel does not execute action", async ({ page }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);

    await page.getByText("Actions").click();
    await page.getByText("Delete Score").click();

    // Dialog appears
    await expect(page.getByText("Delete today's score?")).toBeVisible();

    // Cancel
    await page.getByRole("button", { name: "Cancel" }).click();

    // Dialog should close, no result banner
    await expect(page.getByText("Delete today's score?")).not.toBeVisible();
    await expect(page.getByText(/Deleted score/)).not.toBeVisible();
  });

  test("Fetch Sanity shows success result", async ({ page }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);

    await page.getByText("Actions").click();
    await page.getByText("Fetch Sanity").click();

    await expect(page.getByText(/Fetched Sanity Harness data/)).toBeVisible();
  });

  test("Fetch SWE-bench shows success result", async ({ page }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);

    await page.getByText("Actions").click();
    await page.getByText("Fetch SWE-bench").click();

    await expect(page.getByText(/Fetched SWE-bench data/)).toBeVisible();
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

  test("shows Purge section in actions menu", async ({ page }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);

    await page.getByText("Actions").click();
    await expect(page.getByText("Purge", { exact: true })).toBeVisible();
    await expect(page.getByText("Purge Scores", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Purge Funding", { exact: true })
    ).toBeVisible();
  });

  test("Purge Scores shows confirm dialog and succeeds on confirm", async ({
    page,
  }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);

    await page.getByText("Actions").click();
    await page.getByText("Purge Scores", { exact: true }).click();

    // Confirm dialog should appear
    await expect(page.getByText("Purge all scores?")).toBeVisible();
    await expect(page.getByText(/cannot be undone/)).toBeVisible();

    // Confirm the action
    await page.getByRole("button", { name: "Purge Scores" }).click();

    await expect(page.getByText(/Purged 5 scores/)).toBeVisible();
  });

  test("Purge Funding shows confirm dialog and succeeds on confirm", async ({
    page,
  }) => {
    await mockDashboardApi(page);
    await gotoDashboard(page);

    await page.getByText("Actions").click();
    await page.getByText("Purge Funding", { exact: true }).click();

    // Confirm dialog should appear
    await expect(page.getByText("Purge all funding events?")).toBeVisible();
    await expect(page.getByText(/cannot be undone/)).toBeVisible();

    // Confirm the action
    await page.getByRole("button", { name: "Purge Funding" }).click();

    await expect(page.getByText(/Purged 42 funding events/)).toBeVisible();
  });

  test("Fetch Articles shows error details when sources fail", async ({
    page,
  }) => {
    // Override the default /api/fetch mock to return errors
    await mockDashboardApi(page);
    await page.route("**/api/fetch", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          fetched: 0,
          errors: [
            {
              sourceId: "oq-openai",
              errorType: "http_error",
              message: "HTTP 403",
            },
          ],
        }),
      });
    });
    await gotoDashboard(page);

    await page.getByText("Actions").click();
    await page.getByText("Fetch Articles").click();

    await expect(page.getByText(/1 error/)).toBeVisible();
    await expect(page.getByText(/oq-openai: HTTP 403/)).toBeVisible();
  });
});
