import { test as base, expect, type Page } from "@playwright/test";
import { buildHistoryResponse, buildMethodologyResponse } from "./fixtures";

/** Mock API with configurable failures */
async function mockApiWithError(
  page: Page,
  opts: { todayStatus?: number; historyStatus?: number } = {}
) {
  await page.route("**/api/today", (route) =>
    route.fulfill({
      status: opts.todayStatus ?? 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Internal server error" }),
    })
  );

  await page.route("**/api/history*", (route) => {
    if (opts.historyStatus) {
      return route.fulfill({
        status: opts.historyStatus,
        contentType: "application/json",
        body: JSON.stringify({ error: "Failed" }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildHistoryResponse()),
    });
  });

  await page.route("**/api/methodology", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildMethodologyResponse()),
    })
  );

  await page.route("**/api/subscribe", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    })
  );
}

base.describe("Error states", () => {
  base("shows error message when /api/today fails", async ({ page }) => {
    await mockApiWithError(page, { todayStatus: 500 });
    await page.goto("/");
    await expect(page.getByText("Failed to load score")).toBeVisible();
  });

  base("does not show score gauge on error", async ({ page }) => {
    await mockApiWithError(page, { todayStatus: 500 });
    await page.goto("/");
    await expect(page.getByText("Failed to load score")).toBeVisible();
    // Score gauge should not be visible
    await expect(page.getByText("Safe for now")).not.toBeVisible();
  });
});

base.describe("Seed data state", () => {
  base("shows seed state heading and score", async ({ page }) => {
    await page.route("**/api/today", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          date: new Date().toISOString().split("T")[0],
          score: 32,
          scoreTechnical: 25,
          scoreEconomic: 38,
          delta: 0,
          analysis: "Tracking begins today.",
          signals: [],
          pillarScores: {
            capability: 0,
            labour_market: 0,
            sentiment: 0,
            industry: 0,
            barriers: 0,
          },
          modelScores: [],
          modelAgreement: "partial",
          modelSpread: 0,
          isSeed: true,
        }),
      })
    );
    await page.route("**/api/history*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      })
    );
    await page.route("**/api/methodology", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMethodologyResponse()),
      })
    );

    await page.goto("/");
    await expect(page.getByText("32")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("No change")).toBeVisible();
  });

  base("hides model agreement when only one model", async ({ page }) => {
    await page.route("**/api/today", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          date: new Date().toISOString().split("T")[0],
          score: 32,
          scoreTechnical: 25,
          scoreEconomic: 38,
          delta: 0,
          analysis: "Only one model responded.",
          signals: [],
          pillarScores: {
            capability: 0,
            labour_market: 0,
            sentiment: 0,
            industry: 0,
            barriers: 0,
          },
          modelScores: [
            {
              model: "claude-sonnet",
              suggested_delta: 0,
              analysis: "Single model.",
              pillar_scores: {
                capability: 0,
                labour_market: 0,
                sentiment: 0,
                industry: 0,
                barriers: 0,
              },
              technical_delta: 0,
              economic_delta: 0,
              top_signals: [],
            },
          ],
          modelAgreement: "partial",
          modelSpread: 0,
          isSeed: false,
        }),
      })
    );
    await page.route("**/api/history*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      })
    );
    await page.route("**/api/methodology", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMethodologyResponse()),
      })
    );

    await page.goto("/");
    // Model agreement section is only shown when > 1 model
    await expect(page.getByText("Models agree")).not.toBeVisible();
    await expect(page.getByText("Models disagree")).not.toBeVisible();
  });

  base("hides trend chart when only one history entry", async ({ page }) => {
    await page.route("**/api/today", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          date: new Date().toISOString().split("T")[0],
          score: 33,
          scoreTechnical: 26,
          scoreEconomic: 39,
          delta: 0.3,
          analysis: "Test analysis.",
          signals: [],
          pillarScores: {
            capability: 1,
            labour_market: 0,
            sentiment: 0,
            industry: 0,
            barriers: 0,
          },
          modelScores: [],
          modelAgreement: "partial",
          modelSpread: 0,
          isSeed: false,
        }),
      })
    );
    await page.route("**/api/history*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { date: "2025-01-01", score: 33, delta: 0.3, modelSpread: 0 },
        ]),
      })
    );
    await page.route("**/api/methodology", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMethodologyResponse()),
      })
    );

    await page.goto("/");
    // Trend chart only renders when history.length > 1
    await expect(page.getByText("Score over time")).not.toBeVisible();
  });
});

base.describe("Subscribe error", () => {
  base("shows error state on subscribe failure", async ({ page }) => {
    await page.route("**/api/today", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          date: new Date().toISOString().split("T")[0],
          score: 33,
          scoreTechnical: 26,
          scoreEconomic: 39,
          delta: 0.3,
          analysis: "Test.",
          signals: [],
          pillarScores: {
            capability: 0,
            labour_market: 0,
            sentiment: 0,
            industry: 0,
            barriers: 0,
          },
          modelScores: [],
          modelAgreement: "partial",
          modelSpread: 0,
          isSeed: false,
        }),
      })
    );
    await page.route("**/api/history*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      })
    );
    await page.route("**/api/methodology", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMethodologyResponse()),
      })
    );
    await page.route("**/api/subscribe", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Server error" }),
      })
    );

    await page.goto("/");
    await page.getByPlaceholder("your@email.com").fill("test@example.com");
    await page.getByRole("button", { name: "Subscribe" }).click();
    await expect(page.getByText(/error|failed|try again/i)).toBeVisible();
  });
});
