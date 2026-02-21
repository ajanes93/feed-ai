import { test as base, expect, type Page } from "@playwright/test";
import {
  buildTodayResponse,
  buildMethodologyResponse,
} from "./fixtures";

/** Mock all routes with a custom /api/today override and optional history */
async function mockApiWith(
  page: Page,
  todayOverrides: Record<string, unknown>,
  opts: { history?: unknown[]; subscribeStatus?: number } = {}
) {
  await page.route("**/api/today", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildTodayResponse(todayOverrides)),
    })
  );
  await page.route("**/api/history*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(opts.history ?? []),
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
      status: opts.subscribeStatus ?? 200,
      contentType: "application/json",
      body: JSON.stringify(
        opts.subscribeStatus && opts.subscribeStatus >= 400
          ? { error: "Server error" }
          : { ok: true }
      ),
    })
  );
}

base.describe("Error states", () => {
  base("shows error message when /api/today fails", async ({ page }) => {
    await page.route("**/api/today", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
    );
    await page.route("**/api/history*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );
    await page.route("**/api/methodology", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMethodologyResponse()),
      })
    );
    await page.goto("/");
    await expect(page.getByText("Failed to load score")).toBeVisible();
    await expect(page.getByText("Safe for now")).not.toBeVisible();
  });
});

base.describe("Edge cases", () => {
  base("seed state shows starting score and no change", async ({ page }) => {
    await mockApiWith(page, {
      score: 32,
      scoreTechnical: 25,
      scoreEconomic: 38,
      delta: 0,
      analysis: "Tracking begins today.",
      signals: [],
      modelScores: [],
      isSeed: true,
    });
    await page.goto("/");
    await expect(page.getByText("32")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("No change")).toBeVisible();
  });

  base("hides model agreement when only one model", async ({ page }) => {
    await mockApiWith(page, {
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
      signals: [],
    });
    await page.goto("/");
    await expect(page.getByText("Models agree")).not.toBeVisible();
  });

  base("hides trend chart with single history entry", async ({ page }) => {
    await mockApiWith(
      page,
      { signals: [] },
      { history: [{ date: "2025-01-01", score: 33, delta: 0.3, modelSpread: 0 }] }
    );
    await page.goto("/");
    await expect(page.getByText("Score over time")).not.toBeVisible();
  });
});

base.describe("Subscribe error", () => {
  base("shows error state on subscribe failure", async ({ page }) => {
    await mockApiWith(page, { signals: [] }, { subscribeStatus: 500 });
    await page.goto("/");
    await page.getByPlaceholder("your@email.com").fill("test@example.com");
    await page.getByRole("button", { name: "Subscribe" }).click();
    await expect(page.getByText(/error|failed|try again/i)).toBeVisible();
  });
});
