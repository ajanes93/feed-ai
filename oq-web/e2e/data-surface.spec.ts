import {
  test,
  expect,
  buildTodayResponse,
  buildMethodologyResponse,
} from "./fixtures";

test.describe("Capability Gap section (SWE-bench deprecation)", () => {
  test("renders the Capability Gap heading", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("The Capability Gap")).toBeVisible();
  });

  test("shows SWE-bench Pro and Pro Private as primary scores", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByTestId("pro-score")).toContainText("~46%");
    await expect(mockPage.getByTestId("pro-private-score")).toContainText(
      "~23%"
    );
  });

  test("displays gap indicator between Pro scores", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.locator("[data-testid='gap-indicator']")
    ).toBeVisible();
  });

  test("shows Pro and Pro Private labels", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByTestId("pro-label")).toContainText(
      "SWE-bench Pro"
    );
    await expect(mockPage.getByTestId("pro-private-label")).toContainText(
      "Pro Private"
    );
  });

  test("shows Pro descriptions", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("Public GPL repos")).toBeVisible();
    await expect(mockPage.getByText("Proprietary startup code")).toBeVisible();
  });

  test("shows Scale AI SEAL source links", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.locator(
        'a[href="https://scale.com/leaderboard/swe_bench_pro_public"]'
      )
    ).toBeVisible();
    await expect(
      mockPage.locator(
        'a[href="https://scale.com/leaderboard/swe_bench_pro_private"]'
      )
    ).toBeVisible();
  });

  test("shows deprecated Verified score as footnote", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("Previously: ~77%").first()).toBeVisible();
    await expect(mockPage.getByText("deprecated Feb 23").first()).toBeVisible();
    await expect(
      mockPage.getByText("contamination confirmed").first()
    ).toBeVisible();
  });

  test("links to OpenAI deprecation post", async ({ mockPage }) => {
    await mockPage.goto("/");
    const link = mockPage
      .locator(
        'a[href="https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/"]'
      )
      .first();
    await expect(link).toBeVisible();
  });

  test("drill-down explains deprecation story", async ({ mockPage }) => {
    await mockPage.goto("/");
    const drillDown = mockPage.getByText("Drill down", { exact: true }).first();
    await drillDown.click();
    await expect(
      mockPage.getByText("Why was SWE-bench Verified deprecated")
    ).toBeVisible();
    await expect(
      mockPage.getByText("memorised SWE-bench Verified solutions")
    ).toBeVisible();
  });

  test("drill-down shows LessWrong counterpoint", async ({ mockPage }) => {
    await mockPage.goto("/");
    const drillDown = mockPage.getByText("Drill down", { exact: true }).first();
    await drillDown.click();
    await expect(mockPage.getByText("LessWrong audit")).toBeVisible();
    await expect(mockPage.getByText("test leniency")).toBeVisible();
  });

  test("shows fraction text about unfamiliar code", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.getByText("Less than 1 in 2 on unfamiliar code", {
        exact: false,
      })
    ).toBeVisible();
  });
});

test.describe("Model agreement + summary", () => {
  test("shows model agreement indicator", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("Models agree")).toBeVisible();
  });

  test("shows model spread value", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("spread: 0.4")).toBeVisible();
  });

  test("shows AI-generated model summary", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.getByText(
        "All models see reliability barriers outweighing modest capability gains."
      )
    ).toBeVisible();
  });

  test("model summary not shown when absent", async ({ page }) => {
    const todayData = buildTodayResponse({ modelSummary: undefined });

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
    // The model agreement section should still appear
    await expect(page.getByText("Models agree")).toBeVisible();
    // But no model summary text
    const summaryLocator = page.locator("[data-testid='model-summary']");
    await expect(summaryLocator).toHaveCount(0);
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
    await expect(
      mockPage.getByText("go", { exact: true }).first()
    ).toBeVisible();
    await expect(mockPage.getByText("95%").first()).toBeVisible();
    await expect(mockPage.getByText("dart")).toBeVisible();
    await expect(mockPage.getByText("30%")).toBeVisible();
  });

  test("shows dynamic sanity harness note", async ({ mockPage }) => {
    await mockPage.goto("/");
    const noteEl = mockPage.locator("[data-testid='sanity-harness-note']");
    await expect(noteEl).toBeVisible();
    await expect(noteEl).toContainText("Top agent improved 3%");
  });
});

test.describe("Technical Evidence merged section", () => {
  test("both Capability Gap and SanityHarness under same header", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");
    // The section header
    await expect(
      mockPage.getByText("Can AI actually do the job?")
    ).toBeVisible();
    // Both components should be visible under it
    await expect(mockPage.getByText("The Capability Gap")).toBeVisible();
    await expect(mockPage.getByText("AI Agent Reality Check")).toBeVisible();
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

  test("shows baseline reference", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("vs 100 baseline")).toBeVisible();
  });

  test("shows dynamic economic note", async ({ mockPage }) => {
    await mockPage.goto("/");
    const noteEl = mockPage.locator("[data-testid='economic-note']");
    await expect(noteEl).toBeVisible();
    await expect(noteEl).toContainText("Indeed index dropped 2 points");
  });

  test("shows 4-week trend", async ({ mockPage }) => {
    await mockPage.goto("/");
    const trend = mockPage.getByTestId("software-trend");
    await expect(trend).toBeVisible();
    await expect(trend).toContainText("-12.1%");
    await expect(trend).toContainText("4wk");
  });
});

test.describe("Delta explanation", () => {
  test("shows delta explanation when present", async ({ page }) => {
    const todayData = buildTodayResponse({
      deltaExplanation: "SWE-bench Pro rose 2 points to 48%.",
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
      page.getByText("SWE-bench Pro rose 2 points to 48%.")
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
  test("shows 'Can AI actually do the job?' before technical evidence", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");
    await expect(
      mockPage.getByText("Can AI actually do the job?")
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

test.describe("Signal list collapsible", () => {
  test("shows first 5 signals and hides the rest", async ({ mockPage }) => {
    await mockPage.goto("/");
    // First signal should be visible
    await expect(mockPage.getByText("GPT-5 rumored")).toBeVisible();
    // 5th signal should be visible (SWE-bench)
    await expect(
      mockPage.getByText("SWE-bench Verified hits 82%")
    ).toBeVisible();
    // 6th signal should be hidden initially
    await expect(
      mockPage.getByText("Indeed software postings drop")
    ).not.toBeVisible();
  });

  test("shows 'more signals' button with correct count", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("+ 2 more signals")).toBeVisible();
  });

  test("expands to show all signals when clicked", async ({ mockPage }) => {
    await mockPage.goto("/");
    await mockPage.getByText("+ 2 more signals").click();
    await expect(
      mockPage.getByText("Indeed software postings drop")
    ).toBeVisible();
    await expect(
      mockPage.getByText("Google DeepMind publishes agent safety")
    ).toBeVisible();
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

test.describe("Economic Reality general index", () => {
  test("shows general employment index", async ({ mockPage }) => {
    await mockPage.goto("/");
    const general = mockPage.locator("[data-testid='general-index']");
    await expect(general).toBeVisible();
    await expect(general).toContainText("Initial Claims (ICSA)");
    await expect(general).toContainText("215,000");
  });

  test("shows general 4-week trend", async ({ mockPage }) => {
    await mockPage.goto("/");
    const general = mockPage.locator("[data-testid='general-index']");
    await expect(general).toContainText("-3%");
    await expect(general).toContainText("4wk");
  });

  test("highlights divergence when software falls faster", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");
    const callout = mockPage.locator("[data-testid='divergence-callout']");
    await expect(callout).toBeVisible();
    await expect(callout).toContainText("software-specific decline");
  });
});

test.describe("Economic Reality FRED delta", () => {
  test("shows FRED index delta badge", async ({ mockPage }) => {
    await mockPage.goto("/");
    const delta = mockPage.locator("[data-testid='fred-delta']");
    await expect(delta).toBeVisible();
    await expect(delta).toContainText("-1.8");
  });
});

test.describe("Economic Reality funding headline", () => {
  test("shows headline funding total", async ({ mockPage }) => {
    await mockPage.goto("/");
    const total = mockPage.locator("[data-testid='funding-total']");
    await expect(total).toBeVisible();
    await expect(total).toContainText("$2.1B");
  });

  test("shows funding round count", async ({ mockPage }) => {
    await mockPage.goto("/");
    const count = mockPage.locator("[data-testid='funding-count']");
    await expect(count).toBeVisible();
    await expect(count).toContainText("4 rounds");
  });

  test("shows top round callout", async ({ mockPage }) => {
    await mockPage.goto("/");
    const topRound = mockPage.locator("[data-testid='top-round']");
    await expect(topRound).toBeVisible();
    await expect(topRound).toContainText("OpenAI");
    await expect(topRound).toContainText("$1.5B");
  });
});

test.describe("Economic Reality drill-down", () => {
  test("drill-down shows real funding events", async ({ mockPage }) => {
    await mockPage.goto("/");
    const drillDowns = mockPage.getByText("Drill down", { exact: true });
    await drillDowns.last().click();
    await expect(mockPage.getByText("Recent AI Spending")).toBeVisible();
    const events = mockPage.locator("[data-testid='funding-event']");
    await expect(events).toHaveCount(2);
  });

  test("shows funding event with company and amount", async ({ mockPage }) => {
    await mockPage.goto("/");
    const drillDowns = mockPage.getByText("Drill down", { exact: true });
    await drillDowns.last().click();
    const event = mockPage.getByTestId("funding-event").first();
    await expect(event).toContainText("Cursor");
    await expect(event).toContainText("$400M");
    await expect(event).toContainText("Series C");
  });

  test("drill-down shows software vs general divergence", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");
    const drillDowns = mockPage.getByText("Drill down", { exact: true });
    await drillDowns.last().click();
    const divergence = mockPage.locator(
      "[data-testid='drill-down-divergence']"
    );
    await expect(divergence).toBeVisible();
    await expect(divergence).toContainText("Software vs General");
    await expect(divergence).toContainText("-12.1%");
    await expect(divergence).toContainText("-3%");
  });

  test("drill-down still shows CEPR study", async ({ mockPage }) => {
    await mockPage.goto("/");
    const drillDowns = mockPage.getByText("Drill down", { exact: true });
    await drillDowns.last().click();
    await expect(mockPage.getByText("CEPR / BIS / EIB Study")).toBeVisible();
    await expect(mockPage.getByText("12,000+ European firms")).toBeVisible();
    await expect(mockPage.getByText("0 job losses")).toBeVisible();
  });

  test("shows FRED source link with updated date", async ({ mockPage }) => {
    await mockPage.goto("/");
    const fredLink = mockPage.locator(
      'a[href="https://fred.stlouisfed.org/series/IHLIDXUSTPSOFTDEVE"]'
    );
    await expect(fredLink).toBeVisible();
    await expect(fredLink).toContainText("FRED");
    await expect(fredLink).toContainText("Updated");
    await expect(fredLink).toContainText("2026-02-14");
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

  test("score detail page shows prompt hash as clickable link", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");
    await mockPage.getByText("Full breakdown: model reasoning").click();
    await mockPage.waitForURL(/\/score\//);
    const hashLink = mockPage.locator(
      'a[href="/methodology#prompt-abc123def456"]'
    );
    await expect(hashLink).toBeVisible();
    await expect(hashLink).toContainText("abc123def456");
  });
});
