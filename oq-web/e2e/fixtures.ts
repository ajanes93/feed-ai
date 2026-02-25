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
    sanityHarnessNote: "Top agent improved 3% this week in Go.",
    economicNote: "Indeed index dropped 2 points this week.",
    signals: [
      oqSignalFactory.build({
        text: "GPT-5 rumored for Q3 release",
        direction: "up",
        source: "TechCrunch",
        impact: 2,
        url: "https://techcrunch.com/gpt5-rumor",
      }),
      oqSignalFactory.build({
        text: "Developer survey shows declining trust in AI code",
        direction: "down",
        source: "Stack Overflow",
        impact: -3,
      }),
      oqSignalFactory.build({
        text: "Cursor raises $400M Series C",
        direction: "up",
        source: "Bloomberg",
        impact: 2,
        url: "https://bloomberg.com/cursor",
      }),
      oqSignalFactory.build({
        text: "EU regulators propose AI liability framework",
        direction: "down",
        source: "Reuters",
        impact: -1,
      }),
      oqSignalFactory.build({
        text: "SWE-bench Verified hits 82% top score",
        direction: "up",
        source: "arXiv",
        impact: 3,
        url: "https://arxiv.org/swebench",
      }),
      oqSignalFactory.build({
        text: "Indeed software postings drop another 5%",
        direction: "up",
        source: "Indeed",
        impact: 1,
      }),
      oqSignalFactory.build({
        text: "Google DeepMind publishes agent safety framework",
        direction: "down",
        source: "DeepMind Blog",
        impact: -1,
        url: "https://deepmind.google/agent-safety",
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
    fundingEvents: [
      {
        company: "Cursor",
        amount: "$400M",
        round: "Series C",
        sourceUrl: "https://bloomberg.com/cursor",
        date: "2026-02-22",
        relevance: "AI code tool",
      },
      {
        company: "Anysphere",
        amount: "$200M",
        round: "Series B",
        date: "2026-02-20",
        relevance: "AI code tool",
      },
    ],
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
      verified: "~77%",
      verifiedSource: "https://www.swebench.com",
      pro: "~46%",
      proSource: "https://scale.com/leaderboard/swe_bench_pro_public",
      proPrivate: "~23%",
      proPrivateSource: "https://scale.com/leaderboard/swe_bench_pro_private",
      description:
        "SWE-bench (Princeton) measures AI on curated open-source bugs. SWE-bench Pro (Scale AI SEAL) uses unfamiliar real-world repos AI hasn't seen in training.",
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
      generalTrend: {
        current: 215000,
        currentDate: "2026-02-14",
        change1w: 1.2,
        change4w: -3.0,
      },
    },
    lastUpdated: {
      sanityHarness: "2026-02-20",
      sweBench: "2026-02-18",
      fred: "2026-02-14",
    },
    deltas: {
      fred: {
        softwareIndexDelta: -1.8,
        generalIndexDelta: 3000,
        previousDate: "2026-02-07",
      },
    },
    fundingSummary: {
      totalRaised: "$2.1B",
      count: 4,
      topRound: {
        company: "OpenAI",
        amount: "$1.5B",
        round: "Series G",
      },
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

  await page.route("**/api/prompt-history", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          hash: "abc123def456",
          firstUsed: "2026-02-10",
          lastUsed: "2026-02-22",
          changeSummary: "Added funding extraction and dynamic notes",
          createdAt: "2026-02-10T06:30:00Z",
        },
        {
          hash: "prev789hash01",
          firstUsed: "2026-01-15",
          lastUsed: "2026-02-09",
          changeSummary: "Initial scoring prompt",
          createdAt: "2026-01-15T06:30:00Z",
        },
      ]),
    })
  );

  await page.route("**/api/prompt/*", (route) => {
    const url = route.request().url();
    if (url.endsWith("/abc123def456")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          hash: "abc123def456",
          promptText:
            'You are an analyst tracking whether AI will fully replace the median\nprofessional software engineer within the next 10 years.\n\n"Replace" means: AI can independently handle the full role.\n\nCurrent score: 33/100\nScore history (last 14 days): 33, 32, 32\n\nCALIBRATION RULES:\n- Most days the score should move 0-2 points.\n- CEO hype carries less weight than actual headcount data.',
          firstUsed: "2026-02-10",
          lastUsed: "2026-02-22",
          changeSummary: "Added funding extraction and dynamic notes",
          createdAt: "2026-02-10T06:30:00Z",
        }),
      });
    }
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Prompt version not found" }),
    });
  });

  await page.route("**/api/economic-history*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        fredData: [
          { date: "2026-01-01", softwareIndex: 52.1, generalIndex: 220000 },
          { date: "2026-01-15", softwareIndex: 50.3, generalIndex: 218000 },
          { date: "2026-02-01", softwareIndex: 48.8, generalIndex: 216000 },
          { date: "2026-02-14", softwareIndex: 47.3, generalIndex: 215000 },
        ],
        scoreData: [
          { date: "2026-01-15", score: 32, scoreEconomic: 38, delta: 0.3 },
          { date: "2026-02-01", score: 33, scoreEconomic: 39, delta: 0.5 },
        ],
      }),
    })
  );

  await page.route("**/api/score/*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...todayData,
        deltaExplanation:
          "Minor benchmark movement drove a small upward change.",
        promptHash: "abc123def456",
        articles: [
          {
            title: "AI coding agents improve on Python tasks",
            url: "https://example.com/article1",
            source: "Ars Technica",
            pillar: "capability",
            publishedAt: "2026-02-22T10:00:00Z",
          },
          {
            title: "Software job postings continue to decline",
            url: "https://example.com/article2",
            source: "Indeed Blog",
            pillar: "labour_market",
            publishedAt: "2026-02-22T08:00:00Z",
          },
        ],
        externalData: {
          fred_software: {
            current: 68.5,
            currentDate: "2026-02-21",
            change1w: -1.2,
            change4w: -3.5,
          },
          fred_labour: {
            current: 219000,
            currentDate: "2026-02-20",
            change1w: 0.8,
            change4w: -1.1,
          },
          swe_bench: {
            topVerified: 79.2,
            topVerifiedModel: "codestory-aide",
            topBashOnly: 76.8,
            topBashOnlyModel: "claude-sonnet-4-5-20250929",
          },
          sanity_harness: {
            topPassRate: 72.5,
            topAgent: "TestAgent",
            topModel: "TestModel",
            medianPassRate: 50,
            languageBreakdown: "go: 95%, rust: 80%, python: 75%",
          },
        },
        modelResponses: [
          {
            model: "claude-sonnet-4-5-20250929",
            provider: "anthropic",
            pillarScores: {
              capability: 1,
              labour_market: -0.5,
              sentiment: 0,
              industry: 0,
              barriers: 0,
            },
            technicalDelta: 0.5,
            economicDelta: -0.3,
            suggestedDelta: 0.3,
            analysis: "Claude sees minor benchmark improvements.",
            topSignals: [],
            inputTokens: 5000,
            outputTokens: 500,
            latencyMs: 3200,
          },
        ],
      }),
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
