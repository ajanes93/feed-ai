import {
  test,
  expect,
  buildTodayResponse,
  buildMethodologyResponse,
} from "./fixtures";

test.describe("Capability Gap section", () => {
  test("renders the Capability Gap heading", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("The Capability Gap")).toBeVisible();
  });

  test("shows SWE-bench Verified and Pro scores", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("~79%").first()).toBeVisible();
    await expect(mockPage.getByText("~46%")).toBeVisible();
  });

  test("displays gap indicator", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.locator("[data-testid='gap-indicator']")
    ).toBeVisible();
  });

  test("shows Verified and Pro labels", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.getByText("SWE-bench Verified").first()
    ).toBeVisible();
    await expect(mockPage.getByText("SWE-bench Pro")).toBeVisible();
  });

  test("shows Curated bugs and Private codebases labels", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("Curated bugs")).toBeVisible();
    await expect(mockPage.getByText("Private codebases")).toBeVisible();
  });
});

test.describe("Sanity Harness section", () => {
  test("renders the AI Agent Reality Check heading", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("AI Agent Reality Check")).toBeVisible();
  });

  test("shows top and median pass rates", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("72.5")).toBeVisible();
    await expect(
      mockPage.getByText("Top Agent", { exact: true })
    ).toBeVisible();
    await expect(mockPage.getByText("~45")).toBeVisible();
    await expect(mockPage.getByText("Median Agent")).toBeVisible();
  });

  test("shows agent and model names", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("Agentless")).toBeVisible();
    await expect(mockPage.getByText("Claude 3.5")).toBeVisible();
  });

  test("renders language breakdown chips", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("Language spread")).toBeVisible();
    await expect(mockPage.getByText("go")).toBeVisible();
    await expect(mockPage.getByText("95%").first()).toBeVisible();
    await expect(mockPage.getByText("dart")).toBeVisible();
    await expect(mockPage.getByText("30%")).toBeVisible();
  });
});

test.describe("Economic Reality section", () => {
  test("renders the Economic Reality heading", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("The Economic Reality")).toBeVisible();
  });

  test("shows Indeed Software Index value", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("~47.3")).toBeVisible();
    await expect(mockPage.getByText("Indeed Software Index")).toBeVisible();
  });

  test("shows VC funding section", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("$4B+")).toBeVisible();
    await expect(mockPage.getByText("VC in AI Code Tools")).toBeVisible();
  });

  test("shows F500 Teams Replaced", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("F500 Teams Replaced")).toBeVisible();
  });

  test("shows 4-week trend", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("-12.1%")).toBeVisible();
    await expect(mockPage.getByText("4wk")).toBeVisible();
  });
});

test.describe("Delta explanation", () => {
  test("shows delta explanation when present", async ({ page }) => {
    const todayData = buildTodayResponse({
      deltaExplanation: "SWE-bench Verified rose 2 points to 81%.",
    });

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
        body: "[]",
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
    await expect(
      page.getByText("SWE-bench Verified rose 2 points to 81%.")
    ).toBeVisible();
  });

  test("does not render delta explanation paragraph when absent", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");
    // Default mock data has no deltaExplanation, so the v-if="today.deltaExplanation"
    // paragraph should not be rendered.
    const deltaArea = mockPage.locator("[data-testid='delta-area']");
    await expect(deltaArea).toBeVisible();
    await expect(deltaArea.locator("p")).toHaveCount(0);
  });
});
