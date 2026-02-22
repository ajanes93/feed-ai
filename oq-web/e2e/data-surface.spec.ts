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
    await expect(mockPage.getByText("~77%").first()).toBeVisible();
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

  test("shows updated benchmark descriptions", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("Curated open-source bugs")).toBeVisible();
    await expect(
      mockPage.getByText("Unfamiliar real-world repos")
    ).toBeVisible();
  });

  test("shows source links for benchmarks", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.locator('a[href="https://www.swebench.com"]')
    ).toBeVisible();
    await expect(
      mockPage.locator(
        'a[href="https://scale.com/leaderboard/swe_bench_pro_public"]'
      )
    ).toBeVisible();
  });

  test("drill-down reveals Pro Private score", async ({ mockPage }) => {
    await mockPage.goto("/");
    const drillDown = mockPage.getByText("Drill down: Private codebases");
    await drillDown.click();
    await expect(mockPage.getByText("~23%")).toBeVisible();
    await expect(mockPage.getByText("truly private code")).toBeVisible();
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

test.describe("Narrative section headers", () => {
  test("shows 'Can AI actually do the job?' before capability gap", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.getByText("Can AI actually do the job?")
    ).toBeVisible();
  });

  test("shows 'How reliable are AI agents?' before sanity harness", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.getByText("How reliable are AI agents?")
    ).toBeVisible();
  });

  test("shows 'Will companies actually do it?' before economic reality", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.getByText("Will companies actually do it?")
    ).toBeVisible();
  });

  test("shows 'What should you watch for?' before what would change", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.getByText("What should you watch for?")
    ).toBeVisible();
  });

  test("shows Technical and Economic sub-score badges in section headers", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("Technical: 26%")).toBeVisible();
    await expect(mockPage.getByText("Economic: 39%")).toBeVisible();
  });
});

test.describe("Signal card links", () => {
  test("renders signal with URL as a link", async ({ mockPage }) => {
    await mockPage.goto("/");
    const signalLink = mockPage.locator(
      'a[href="https://techcrunch.com/gpt5-rumor"]'
    );
    await expect(signalLink).toBeVisible();
    await expect(signalLink).toContainText("GPT-5 rumored");
  });

  test("renders signal without URL as non-link", async ({ mockPage }) => {
    await mockPage.goto("/");
    // "declining trust" signal has no URL, should not be a link
    await expect(
      mockPage.getByText("Developer survey shows declining trust")
    ).toBeVisible();
  });
});

test.describe("Economic Reality drill-down", () => {
  test("drill-down reveals VC breakdown", async ({ mockPage }) => {
    await mockPage.goto("/");
    // Click the drill-down trigger in Economic Reality
    const drillDowns = mockPage.getByText("Drill down", { exact: true });
    // Economic Reality's drill down
    await drillDowns.last().click();
    await expect(mockPage.getByText("Cursor")).toBeVisible();
    await expect(mockPage.getByText("$400M Series C")).toBeVisible();
  });

  test("shows FRED source link", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.locator(
        'a[href="https://fred.stlouisfed.org/series/IHLIDXUSTPSOFTDEVE"]'
      )
    ).toBeVisible();
  });
});

test.describe("SanityHarness source link", () => {
  test("shows source link to SanityHarness", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.locator('a[href="https://sanityboard.lr7.dev"]')
    ).toBeVisible();
  });
});

test.describe("Full breakdown link", () => {
  test("shows link to score detail page", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.getByText("Full breakdown: model reasoning")
    ).toBeVisible();
  });
});

test.describe("Score detail page", () => {
  test("navigates to score detail page and shows data", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");
    // Click the full breakdown link
    await mockPage.getByText("Full breakdown: model reasoning").click();
    // Should navigate to /score/:date
    await mockPage.waitForURL(/\/score\//);
    // Should show the score
    await expect(mockPage.getByText("33")).toBeVisible({ timeout: 5000 });
  });

  test("score detail page shows model breakdown section", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");
    await mockPage.getByText("Full breakdown: model reasoning").click();
    await mockPage.waitForURL(/\/score\//);
    await expect(mockPage.getByText("Model Breakdown")).toBeVisible();
  });

  test("score detail page shows articles section", async ({ mockPage }) => {
    await mockPage.goto("/");
    await mockPage.getByText("Full breakdown: model reasoning").click();
    await mockPage.waitForURL(/\/score\//);
    await expect(mockPage.getByText(/Articles Fed to Models/)).toBeVisible();
  });

  test("score detail page shows prompt hash", async ({ mockPage }) => {
    await mockPage.goto("/");
    await mockPage.getByText("Full breakdown: model reasoning").click();
    await mockPage.waitForURL(/\/score\//);
    await expect(mockPage.getByText("abc123def456")).toBeVisible();
  });
});
