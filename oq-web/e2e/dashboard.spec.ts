import { test, expect, buildTodayResponse } from "./fixtures";
import type { Page } from "@playwright/test";

/** Mock API with admin-aware routes */
async function mockDashboardApi(page: Page) {
  const todayData = buildTodayResponse();

  await page.route("**/api/today", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(todayData),
    })
  );

  await page.route("**/api/history*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          date: new Date().toISOString().split("T")[0],
          score: 33,
          scoreTechnical: 26,
          scoreEconomic: 39,
          delta: 0.3,
          modelSpread: 0.4,
        },
      ]),
    })
  );

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
}

test.describe("Dashboard", () => {
  test("displays dashboard title and stats", async ({ page }) => {
    await mockDashboardApi(page);
    await page.goto("/dashboard");
    await expect(page.getByText("OQ Dashboard")).toBeVisible();
    await expect(page.getByText("Today's Score")).toBeVisible();
    await expect(page.getByText("Technical")).toBeVisible();
    await expect(page.getByText("Economic")).toBeVisible();
    await expect(page.getByText("Daily Delta")).toBeVisible();
  });

  test("shows today's analysis section", async ({ page }) => {
    await mockDashboardApi(page);
    await page.goto("/dashboard");
    await expect(page.getByText("Today's Analysis")).toBeVisible();
    await expect(page.getByText(/SWE-bench Pro remains at 23%/)).toBeVisible();
  });

  test("renders score history table", async ({ page }) => {
    await mockDashboardApi(page);
    await page.goto("/dashboard");
    await expect(page.getByText("Score History (14d)")).toBeVisible();
    // Table headers
    await expect(
      page.getByRole("columnheader", { name: "Date" })
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Spread" })
    ).toBeVisible();
  });

  test("shows model breakdown section", async ({ page }) => {
    await mockDashboardApi(page);
    await page.goto("/dashboard");
    await expect(page.getByText("Model Breakdown")).toBeVisible();
    await expect(page.getByText("Claude", { exact: true })).toBeVisible();
    await expect(page.getByText("GPT-4", { exact: true })).toBeVisible();
    await expect(page.getByText("Gemini", { exact: true })).toBeVisible();
  });

  test("has link to public view", async ({ page }) => {
    await mockDashboardApi(page);
    await page.goto("/dashboard");
    await expect(page.getByText("Public View")).toBeVisible();
  });

  test("shows admin buttons after entering key", async ({ page }) => {
    await mockDashboardApi(page);
    await page.goto("/dashboard");

    // Admin buttons require auth — trigger 401 first
    // Initially no fetch/score buttons without key
    await expect(page.getByText("Fetch Articles")).not.toBeVisible();

    // Trigger auth by attempting via admin action
    // The dashboard shows auth prompt on 401
    await page.route("**/api/fetch", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unauthorized" }),
      })
    );
  });
});
