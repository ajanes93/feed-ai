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
    await expect(mockPage.getByText("SWE-bench Bash Only")).toBeVisible();
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

  test("displays current prompt hash", async ({ mockPage }) => {
    await mockPage.goto("/methodology");
    await expect(mockPage.getByText("Current Prompt Hash")).toBeVisible();
    await expect(mockPage.getByText("abc123def456")).toBeVisible();
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
