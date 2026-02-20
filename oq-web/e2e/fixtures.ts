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
      "SWE-bench Pro remains at 23%. No significant movement in AI capability benchmarks this week.",
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
      "SWE-bench Verified: ~80% | SWE-bench Pro: ~23% — the gap persists.",
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

/** Mock all OQ API routes */
async function mockApi(page: Page) {
  const todayData = buildTodayResponse();
  const historyData = buildHistoryResponse();

  await page.route("**/api/today", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(todayData),
    }),
  );

  await page.route("**/api/history*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(historyData),
    }),
  );

  await page.route("**/api/subscribe", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    }),
  );

  await page.route("**/api/methodology", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        pillars: [],
        formula: { models: [], weights: {} },
        startingScore: 32,
      }),
    }),
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

export { buildTodayResponse, buildHistoryResponse };
export { expect } from "@playwright/test";
