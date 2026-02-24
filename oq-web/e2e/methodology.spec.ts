import { test, expect } from "./fixtures";

test.describe("Methodology page", () => {
  test("renders methodology heading", async ({ mockPage }) => {
    await mockPage.goto("/methodology");
    await expect(
      mockPage.getByRole("heading", { name: "Methodology" })
    ).toBeVisible();
  });

  test("displays all five scoring pillars", async ({ mockPage }) => {
    await mockPage.goto("/methodology");
    await expect(mockPage.getByText("AI Capability Benchmarks")).toBeVisible();
    await expect(mockPage.getByText("Labour Market Signals")).toBeVisible();
    await expect(
      mockPage.getByText("Developer Sentiment & Adoption")
    ).toBeVisible();
    await expect(
      mockPage.getByText("Industry & Economic Signals")
    ).toBeVisible();
    await expect(mockPage.getByText("Structural Barriers")).toBeVisible();
  });

  test("shows pillar weights", async ({ mockPage }) => {
    await mockPage.goto("/methodology");
    // 25% pillars
    const twentyFives = mockPage.getByText("25%");
    await expect(twentyFives.first()).toBeVisible();
    // 20% pillars
    const twenties = mockPage.getByText("20%");
    await expect(twenties.first()).toBeVisible();
    // 10% pillar
    await expect(mockPage.getByText("10%")).toBeVisible();
  });

  test("displays consensus formula section", async ({ mockPage }) => {
    await mockPage.goto("/methodology");
    await expect(mockPage.getByText("Consensus Formula")).toBeVisible();
    await expect(mockPage.getByText("Claude")).toBeVisible();
    await expect(mockPage.getByText("GPT-4o")).toBeVisible();
    await expect(mockPage.getByText("Gemini 2.0 Flash")).toBeVisible();
  });

  test("shows formula parameters", async ({ mockPage }) => {
    await mockPage.goto("/methodology");
    await expect(mockPage.getByText("Dampening")).toBeVisible();
    await expect(mockPage.getByText("0.3x")).toBeVisible();
    await expect(mockPage.getByText("Daily Cap")).toBeVisible();
    await expect(mockPage.getByText("Score Range")).toBeVisible();
    await expect(mockPage.getByText("Decay Target")).toBeVisible();
  });

  test("shows capability gap section", async ({ mockPage }) => {
    await mockPage.goto("/methodology");
    await expect(mockPage.getByText("The Capability Gap")).toBeVisible();
    await expect(
      mockPage.getByText("SWE-bench Verified").first()
    ).toBeVisible();
    await expect(mockPage.getByText("SWE-bench Pro").first()).toBeVisible();
  });

  test("shows what-would-change scenarios", async ({ mockPage }) => {
    await mockPage.goto("/methodology");
    await expect(
      mockPage.getByText("What Would Move This Score")
    ).toBeVisible();
    await expect(mockPage.getByText("To 50+")).toBeVisible();
    await expect(mockPage.getByText("To 70+")).toBeVisible();
    await expect(mockPage.getByText("Below 20")).toBeVisible();
    // Check specific items exist
    await expect(
      mockPage.getByText(/SWE-bench Verified consistently above 90%/)
    ).toBeVisible();
    await expect(
      mockPage.getByText(/AI coding tool market contracting/)
    ).toBeVisible();
  });

  test("shows prompt audit trail heading", async ({ mockPage }) => {
    await mockPage.goto("/methodology");
    await expect(mockPage.getByText("Prompt Audit Trail")).toBeVisible();
  });

  test("displays prompt version history timeline", async ({ mockPage }) => {
    await mockPage.goto("/methodology");
    // Current version should show "current" badge (matched by hash, not position)
    await expect(mockPage.getByText("abc123def456")).toBeVisible();
    await expect(mockPage.getByText("current", { exact: true })).toBeVisible();
    // Previous version hash should be visible
    await expect(mockPage.getByText("prev789hash01")).toBeVisible();
    // Change summaries should be visible
    await expect(
      mockPage.getByText("Added funding extraction and dynamic notes")
    ).toBeVisible();
    await expect(mockPage.getByText("Initial scoring prompt")).toBeVisible();
  });

  test("clicking a prompt hash reveals the full prompt text", async ({
    mockPage,
  }) => {
    await mockPage.goto("/methodology");
    // Prompt text should not be visible initially
    await expect(mockPage.getByText("CALIBRATION RULES:")).not.toBeVisible();
    // Click the hash to expand
    await mockPage.getByText("abc123def456").click();
    // Prompt text should now be visible
    await expect(mockPage.getByText("CALIBRATION RULES:")).toBeVisible();
    await expect(
      mockPage.getByText("CEO hype carries less weight")
    ).toBeVisible();
    // Click again to collapse
    await mockPage.getByText("abc123def456").click();
    await expect(mockPage.getByText("CALIBRATION RULES:")).not.toBeVisible();
  });

  test("navigating to unknown hash fragment does not break the page", async ({
    mockPage,
  }) => {
    await mockPage.goto("/methodology#prompt-deadbeef00000000");
    await expect(
      mockPage.getByRole("heading", { name: "Methodology" })
    ).toBeVisible();
    // Should not expand anything
    await expect(mockPage.getByText("CALIBRATION RULES:")).not.toBeVisible();
  });

  test("has back-to-score link", async ({ mockPage }) => {
    await mockPage.goto("/methodology");
    const backLink = mockPage.getByText("Back to score").first();
    await expect(backLink).toBeVisible();
  });
});

test.describe("What Would Change (home page)", () => {
  test("renders what-would-change section on home page", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText("To 50+")).toBeVisible();
    await expect(mockPage.getByText("To 70+")).toBeVisible();
    await expect(mockPage.getByText("Below 20")).toBeVisible();
  });

  test("shows scenario items from methodology", async ({ mockPage }) => {
    await mockPage.goto("/");
    await expect(mockPage.getByText(/Fortune 500 companies/)).toBeVisible();
    await expect(mockPage.getByText(/AI autonomously shipping/)).toBeVisible();
    await expect(mockPage.getByText(/AI coding tool market/)).toBeVisible();
  });
});
