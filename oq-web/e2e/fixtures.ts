import { test as base, type Page } from "@playwright/test";
import {
  oqSignalFactory,
  oqModelScoreFactory,
  oqHistoryEntryFactory,
} from "@feed-ai/shared/factories";

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

/** Build mock /api/today response */
function buildTodayResponse(overrides: Record<string, unknown> = {}) {
  return {
    date: todayDate(),
    score: 33,
    scoreTechnical: 26,
    scoreEconomic: 39,
    delta: 0.3,
    analysis:
      "SWE-bench Verified: 79.2%. Bash Only: 76.8%. No significant movement in AI capability benchmarks this week.",
    signals: [
      oqSignalFactory.build({
        text: "GPT-5 rumored for Q3 release",
        direction: "up",
        source: "TechCrunch",
        impact: 2,
      }),
      oqSignalFactory.build({
        text: "Developer survey shows declining trust in AI code",
        direction: "down",
        source: "Stack Overflow",
        impact: -3,
      }),
    ],
    pillarScores: {
      capability: 1.2,
      labour_market: -0.5,
      sentiment: -1.0,
      industry: 0.3,
      barriers: 0,
    },
    modelScores: [
      oqModelScoreFactory.build({
        model: "claude-sonnet-4-5-20250929",
        suggested_delta: 0.5,
        analysis: "Claude sees modest progress in benchmarks.",
      }),
      oqModelScoreFactory.build({
        model: "gpt-4o",
        suggested_delta: 0.2,
        analysis: "GPT-4 notes continued gap in enterprise code.",
      }),
      oqModelScoreFactory.build({
        model: "gemini-2.0-flash",
        suggested_delta: 0.1,
        analysis: "Gemini sees limited movement.",
      }),
    ],
    modelAgreement: "agree",
    modelSpread: 0.4,
    capabilityGap:
      "SWE-bench Verified: ~79% | Bash Only: ~77% — curated benchmarks; real engineering is harder.",
    isSeed: false,
    ...overrides,
  };
}

/** Build mock /api/history response */
function buildHistoryResponse() {
  return [
    oqHistoryEntryFactory.build({ date: todayDate(), score: 33, delta: 0.3 }),
    ...oqHistoryEntryFactory.buildList(6),
  ];
}

/** Build mock /api/methodology response */
function buildMethodologyResponse() {
  return {
    pillars: [
      { name: "AI Capability Benchmarks", weight: 0.25, key: "capability" },
      { name: "Labour Market Signals", weight: 0.25, key: "labour_market" },
      {
        name: "Developer Sentiment & Adoption",
        weight: 0.2,
        key: "sentiment",
      },
      { name: "Industry & Economic Signals", weight: 0.2, key: "industry" },
      { name: "Structural Barriers", weight: 0.1, key: "barriers" },
    ],
    formula: {
      models: [
        "Claude (claude-sonnet-4-5-20250929)",
        "GPT-4o",
        "Gemini 2.0 Flash",
      ],
      weights: { claude: 0.4, gpt4: 0.3, gemini: 0.3 },
      dampening: 0.3,
      dailyCap: 1.2,
      scoreRange: [5, 95],
      decayTarget: 40,
    },
    startingScore: 32,
    currentPromptHash: "abc123def456",
    capabilityGap: {
      verified: "~79%",
      pro: "~46%",
      description:
        "SWE-bench scores on curated open-source issues. Real enterprise engineering involves ambiguous requirements.",
    },
    sanityHarness: {
      topPassRate: 72.5,
      topAgent: "Agentless",
      topModel: "Claude 3.5",
      medianPassRate: 45,
      languageBreakdown: "go: 95%, rust: 80%, python: 72%, dart: 30%",
    },
    fredData: {
      softwareIndex: 47.3,
      softwareDate: "2026-02-14",
      softwareTrend: {
        current: 47.3,
        currentDate: "2026-02-14",
        change1w: -2.1,
        change4w: -12.1,
      },
      generalIndex: 215000,
      generalDate: "2026-02-14",
    },
    whatWouldChange: {
      to50: [
        "SWE-bench Verified consistently above 90%",
        "Multiple Fortune 500 companies reporting 50%+ reduction in engineering headcount",
      ],
      to70: [
        "AI autonomously shipping production systems for 6+ months",
        "Measurable, sustained decline in software engineering salaries",
      ],
      below20: [
        "AI coding tool market contracting",
        "SWE-bench Verified progress plateauing for 12+ months",
      ],
    },
  };
}

/** Mock all OQ API routes */
async function mockApi(page: Page) {
  const todayData = buildTodayResponse();
  const historyData = buildHistoryResponse();

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
      body: JSON.stringify(historyData),
    })
  );

  await page.route("**/api/subscribe", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    })
  );

  await page.route("**/api/methodology", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildMethodologyResponse()),
    })
  );
}

/**
 * Extended test fixture that mocks API before each test.
 * Tests get a page with all API routes pre-mocked.
 */
export const test = base.extend<{ mockPage: Page }>({
  mockPage: async ({ page }, use) => {
    await mockApi(page);
    await use(page);
  },
});

export { buildTodayResponse, buildHistoryResponse, buildMethodologyResponse };
export { expect } from "@playwright/test";
