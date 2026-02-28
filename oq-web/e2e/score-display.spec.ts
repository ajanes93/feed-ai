import { test, expect } from "./fixtures";

test.describe("Score display", () => {
  test("renders the main heading", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.getByRole("heading", { name: /Will AI replace/i })
    ).toBeVisible();
  });

  test("displays the score gauge", async ({ mockPage }) => {
    await mockPage.goto("/");
    // The animated score should reach 33
    await expect(mockPage.getByText("33").first()).toBeVisible({
      timeout: 5000,
    });
    await expect(mockPage.getByText("Safe for now")).toBeVisible();
  });

  test("shows sub-scores for technical and economic", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("Technical Feasibility")).toBeVisible();
    await expect(mockPage.getByText("Economic Replacement")).toBeVisible();
  });

  test("displays delta indicator", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("+0.3 from yesterday")).toBeVisible();
  });

  test("shows today's analysis text", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.getByText(/SWE-bench Verified: 79\.2%/)
    ).toBeVisible();
  });

  test("displays the capability gap section", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.getByText("Can AI actually do the job?")
    ).toBeVisible();
    await expect(mockPage.getByTestId("pro-score")).toBeVisible();
  });
});

test.describe("Signals", () => {
  test("renders signal entries", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.getByText("GPT-5 rumored for Q3 release")
    ).toBeVisible();
    await expect(
      mockPage.getByText(/declining trust in AI code/)
    ).toBeVisible();
  });

  test("shows signal source labels", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("TechCrunch")).toBeVisible();
    await expect(mockPage.getByText("Stack Overflow")).toBeVisible();
  });
});

test.describe("Model agreement", () => {
  test("shows agreement status when multiple models", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("Models agree")).toBeVisible();
    await expect(mockPage.getByText("spread: 0.4")).toBeVisible();
  });
});

test.describe("Trend chart", () => {
  test("renders the trend chart section", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("Score over time")).toBeVisible();
    // Chart SVG should be present (use viewBox to target the chart, not icon SVGs)
    await expect(mockPage.locator('svg[viewBox="0 0 656 200"]')).toBeVisible();
  });

  test("shows Today label on chart", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("Today", { exact: true })).toBeVisible();
  });
});

test.describe("Subscribe", () => {
  test("renders subscribe section", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("Get the daily take")).toBeVisible();
    const card = mockPage.locator("section", {
      hasText: "Get the daily take",
    });
    await expect(card.getByPlaceholder("your@email.com")).toBeVisible();
  });

  test("submits subscription email", async ({ mockPage }) => {
    await mockPage.goto("/");
    const card = mockPage.locator("section", {
      hasText: "Get the daily take",
    });
    await card.getByPlaceholder("your@email.com").fill("test@example.com");
    await card.getByRole("button", { name: "Subscribe" }).click();
    await expect(mockPage.getByText(/Subscribed/).first()).toBeVisible();
  });
});

test.describe("Header and footer", () => {
  test("renders header with live badge", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("Live — Updated Daily")).toBeVisible();
  });

  test("renders footer with attribution", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("Andres Janes")).toBeVisible();
    await expect(mockPage.getByText(/06:30 UTC/)).toBeVisible();
  });
});
