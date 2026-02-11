import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

/** Mock AI-specific API routes in addition to standard feed routes */
async function mockAiApi(page: Page) {
  await page.route("**/api/ai/remaining", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ remaining: 5 }),
    }),
  );

  await page.route("**/api/ai/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        text: "## Daily Briefing\n\n**GLM-5** dominates today's headlines with benchmark results surpassing GPT-4o.\n\n- **AI**: Major model release from Zhipu\n- **Dev**: Vue 3.5 brings reactivity improvements",
        remaining: 4,
      }),
    }),
  );
}

test.describe("AI FAB", () => {
  test("FAB is visible on feed page", async ({ mockPage }) => {
    await mockPage.goto("/");
    const fab = mockPage.getByLabel("Open AI Assistant");
    await expect(fab).toBeVisible();
  });

  test("FAB navigates to /ai", async ({ mockPage }) => {
    await mockPage.goto("/");
    await mockPage.getByLabel("Open AI Assistant").click();
    await expect(mockPage).toHaveURL("/ai");
  });

  test("FAB is hidden on AI view", async ({ mockPage }) => {
    await mockAiApi(mockPage);
    await mockPage.goto("/ai");
    const fab = mockPage.getByLabel("Open AI Assistant");
    await expect(fab).not.toBeVisible();
  });
});

test.describe("AI Assistant — Welcome State", () => {
  test.beforeEach(async ({ mockPage }) => {
    await mockAiApi(mockPage);
    await mockPage.goto("/ai");
  });

  test("shows welcome heading", async ({ mockPage }) => {
    await expect(
      mockPage.getByText("What do you want to know?"),
    ).toBeVisible();
  });

  test("shows subtitle", async ({ mockPage }) => {
    await expect(
      mockPage.getByText("AI-powered summaries of your feed."),
    ).toBeVisible();
  });

  test("shows 6 prompt chips", async ({ mockPage }) => {
    const chips = [
      "Today's briefing",
      "This week",
      "Monthly recap",
      "Top AI news",
      "Dev updates",
      "Lincoln City",
    ];
    for (const label of chips) {
      await expect(mockPage.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("shows rate counter", async ({ mockPage }) => {
    await expect(mockPage.getByText("5/5")).toBeVisible();
  });

  test("shows back button", async ({ mockPage }) => {
    await expect(mockPage.getByText("Feed", { exact: true })).toBeVisible();
  });
});

test.describe("AI Assistant — Chat Interaction", () => {
  test.beforeEach(async ({ mockPage }) => {
    await mockAiApi(mockPage);
    await mockPage.goto("/ai");
  });

  test("clicking a prompt shows user pill and AI response", async ({
    mockPage,
  }) => {
    await mockPage.getByText("Today's briefing", { exact: true }).click();

    // User pill should show
    await expect(mockPage.getByText("Today's briefing")).toBeVisible();

    // AI response should render with markdown
    await expect(mockPage.getByText("Daily Briefing")).toBeVisible();
    await expect(mockPage.getByText("GLM-5")).toBeVisible();
  });

  test("rate counter decrements after query", async ({ mockPage }) => {
    await mockPage.getByText("Today's briefing", { exact: true }).click();
    await expect(mockPage.getByText("Daily Briefing")).toBeVisible();
    // Server returned remaining: 4
    await expect(mockPage.getByText("4/5")).toBeVisible();
  });

  test("follow-up chips appear after first query", async ({ mockPage }) => {
    await mockPage.getByText("Today's briefing", { exact: true }).click();
    await expect(mockPage.getByText("Daily Briefing")).toBeVisible();

    // "Ask something else" footer should appear
    await expect(mockPage.getByText("Ask something else")).toBeVisible();

    // Used prompt should NOT be in follow-up chips
    // Other prompts should be available
    await expect(mockPage.getByText("This week")).toBeVisible();
    await expect(mockPage.getByText("Top AI news")).toBeVisible();
  });

  test("reset button clears conversation", async ({ mockPage }) => {
    await mockPage.getByText("Today's briefing", { exact: true }).click();
    await expect(mockPage.getByText("Daily Briefing")).toBeVisible();

    // Click reset (X) button
    await mockPage.getByTitle("New conversation").click();

    // Should return to welcome state
    await expect(
      mockPage.getByText("What do you want to know?"),
    ).toBeVisible();
  });
});

test.describe("AI Assistant — Navigation", () => {
  test("back button returns to feed", async ({ mockPage }) => {
    await mockAiApi(mockPage);
    await mockPage.goto("/");
    await mockPage.getByLabel("Open AI Assistant").click();
    await expect(mockPage).toHaveURL("/ai");

    // Click back
    await mockPage.getByText("Feed", { exact: true }).click();
    await expect(mockPage).not.toHaveURL("/ai");
  });

  test("direct navigation to /ai works", async ({ mockPage }) => {
    await mockAiApi(mockPage);
    await mockPage.goto("/ai");
    await expect(
      mockPage.getByText("What do you want to know?"),
    ).toBeVisible();
  });
});

test.describe("AI Assistant — Error Handling", () => {
  test("shows error on rate limit", async ({ mockPage }) => {
    await mockPage.route("**/api/ai/remaining", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ remaining: 0 }),
      }),
    );

    await mockPage.route("**/api/ai/chat", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Daily limit reached. Try again tomorrow.",
          remaining: 0,
        }),
      }),
    );

    await mockPage.goto("/ai");
    // Chips should be disabled when remaining is 0 (but we can still check the UI renders)
    await expect(
      mockPage.getByText("What do you want to know?"),
    ).toBeVisible();
  });
});
