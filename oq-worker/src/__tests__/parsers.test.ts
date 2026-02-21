import { describe, it, expect } from "vitest";
import {
  parseSanityHarnessHtml,
  buildSanityHarnessArticleSummary,
  type SanityHarnessData,
} from "../services/sanity-harness";
import { parseSWEBenchHtml } from "../services/swe-bench";

describe("SanityHarness parser", () => {
  function buildSanityHtml(entries: { rank: number; agent: string; model: string; score: number; passRate: number; languages?: Record<string, number> }[]): string {
    return entries
      .map((e) => {
        const langHtml = Object.entries(e.languages ?? {})
          .map(([lang, pct]) => `<span title="${lang}"><span>${lang}</span></span><span>${pct}%</span>`)
          .join("");
        return `
          <div>#${e.rank}</div>
          <a class="hover:text-indigo-600 transition-colors">${e.agent}</a>
          <span class="truncate" title="${e.model}">${e.model}</span>
          <span class="font-mono text-sm font-bold">${e.score}</span>
          <span class="text-emerald-500">${e.passRate}%</span>
          ${langHtml}
        `;
      })
      .join("\n");
  }

  it("parses entries from SSR HTML", () => {
    const html = buildSanityHtml([
      { rank: 1, agent: "TestAgent", model: "GPT-4", score: 45.2, passRate: 42.5 },
      { rank: 2, agent: "Agent2", model: "Claude", score: 30.1, passRate: 28.0 },
    ]);

    const result = parseSanityHarnessHtml(html);
    expect(result.entries).toHaveLength(2);
    expect(result.topAgent).toBe("TestAgent");
    expect(result.topModel).toBe("GPT-4");
    expect(result.topPassRate).toBe(42.5);
  });

  it("sorts entries by overall score descending", () => {
    const html = buildSanityHtml([
      { rank: 1, agent: "Low", model: "M1", score: 20, passRate: 20 },
      { rank: 2, agent: "High", model: "M2", score: 50, passRate: 50 },
    ]);

    const result = parseSanityHarnessHtml(html);
    expect(result.topAgent).toBe("High");
    expect(result.topPassRate).toBe(50);
  });

  it("throws when no entries parsed", () => {
    expect(() => parseSanityHarnessHtml("<html><body>Empty</body></html>")).toThrow(
      "SanityHarness: No entries parsed from HTML"
    );
  });

  it("calculates median pass rate", () => {
    const html = buildSanityHtml([
      { rank: 1, agent: "A1", model: "M1", score: 50, passRate: 50 },
      { rank: 2, agent: "A2", model: "M2", score: 30, passRate: 30 },
      { rank: 3, agent: "A3", model: "M3", score: 10, passRate: 10 },
    ]);

    const result = parseSanityHarnessHtml(html);
    // Sorted: 50, 30, 10 -> median index = floor(3/2) = 1 -> 30
    expect(result.medianPassRate).toBe(30);
  });

  it("limits entries to top 10", () => {
    const entries = Array.from({ length: 15 }, (_, i) => ({
      rank: i + 1,
      agent: `Agent${i}`,
      model: `Model${i}`,
      score: 50 - i,
      passRate: 50 - i,
    }));
    const html = buildSanityHtml(entries);

    const result = parseSanityHarnessHtml(html);
    expect(result.entries).toHaveLength(10);
  });

  it("skips entries with 0 score and 0 passRate", () => {
    const html = buildSanityHtml([
      { rank: 1, agent: "Good", model: "M1", score: 40, passRate: 40 },
      { rank: 2, agent: "Zero", model: "M2", score: 0, passRate: 0 },
    ]);

    const result = parseSanityHarnessHtml(html);
    expect(result.entries).toHaveLength(1);
    expect(result.topAgent).toBe("Good");
  });
});

describe("buildSanityHarnessArticleSummary", () => {
  const baseData: SanityHarnessData = {
    topPassRate: 42,
    topAgent: "TestAgent",
    topModel: "GPT-4",
    medianPassRate: 25,
    languageBreakdown: "python: 60%, javascript: 40%",
    entries: [],
    fetchedAt: "2025-01-01T00:00:00Z",
  };

  it("builds a summary string", () => {
    const summary = buildSanityHarnessArticleSummary(baseData);
    expect(summary).toContain("TestAgent");
    expect(summary).toContain("GPT-4");
    expect(summary).toContain("42%");
    expect(summary).toContain("25%");
  });

  it("adds high signal note when topPassRate > 85", () => {
    const data = { ...baseData, topPassRate: 90 };
    const summary = buildSanityHarnessArticleSummary(data);
    expect(summary).toContain("exceeding 85%");
  });

  it("adds struggling note when topPassRate < 50", () => {
    const summary = buildSanityHarnessArticleSummary(baseData);
    expect(summary).toContain("below 50%");
  });

  it("no note when topPassRate between 50 and 85", () => {
    const data = { ...baseData, topPassRate: 70 };
    const summary = buildSanityHarnessArticleSummary(data);
    expect(summary).not.toContain("Note:");
  });
});

describe("SWE-bench parser", () => {
  it("parses leaderboard JSON from script tag", () => {
    const html = `
      <html>
      <script id="leaderboard-data">
      [
        {"name": "Verified", "results": [
          {"name": "AgentA", "resolved": 85.5},
          {"name": "AgentB", "resolved": 79.2}
        ]},
        {"name": "Bash-Only", "results": [
          {"name": "AgentC", "resolved": 77.3},
          {"name": "AgentD", "resolved": 72.1}
        ]}
      ]
      </script>
      </html>
    `;

    const result = parseSWEBenchHtml(html);
    expect(result.topVerified).toBe(85.5);
    expect(result.topVerifiedModel).toBe("AgentA");
    expect(result.topBashOnly).toBe(77.3);
    expect(result.topBashOnlyModel).toBe("AgentC");
  });

  it("handles lowercase leaderboard names", () => {
    const html = `
      <script id="leaderboard-data">
      [
        {"name": "verified", "results": [{"name": "Top", "resolved": 90}]},
        {"name": "bash-only", "results": [{"name": "Top2", "resolved": 80}]}
      ]
      </script>
    `;

    const result = parseSWEBenchHtml(html);
    expect(result.topVerified).toBe(90);
    expect(result.topBashOnly).toBe(80);
  });

  it("handles bash only with space", () => {
    const html = `
      <script id="leaderboard-data">
      [
        {"name": "bash only", "results": [{"name": "Agent", "resolved": 75}]}
      ]
      </script>
    `;

    const result = parseSWEBenchHtml(html);
    expect(result.topBashOnly).toBe(75);
    expect(result.topBashOnlyModel).toBe("Agent");
  });

  it("returns 0 for missing tracks", () => {
    const html = `
      <script id="leaderboard-data">
      [
        {"name": "some-other-track", "results": [{"name": "X", "resolved": 50}]}
      ]
      </script>
    `;

    const result = parseSWEBenchHtml(html);
    expect(result.topVerified).toBe(0);
    expect(result.topBashOnly).toBe(0);
  });

  it("ignores scores above 100", () => {
    const html = `
      <script id="leaderboard-data">
      [
        {"name": "verified", "results": [
          {"name": "Bad", "resolved": 150},
          {"name": "Good", "resolved": 80}
        ]}
      ]
      </script>
    `;

    const result = parseSWEBenchHtml(html);
    expect(result.topVerified).toBe(80);
    expect(result.topVerifiedModel).toBe("Good");
  });

  it("uses folder as fallback name", () => {
    const html = `
      <script id="leaderboard-data">
      [
        {"name": "verified", "results": [{"folder": "my-agent", "resolved": 80}]}
      ]
      </script>
    `;

    const result = parseSWEBenchHtml(html);
    expect(result.topVerifiedModel).toBe("my-agent");
  });

  it("falls back to markdown parsing when no JSON", () => {
    // Markdown table format
    const html = `
      <html>
        <p>Leaderboard</p>
        | [x] | SuperAgent | 88.5 |
        | [x] | OtherAgent | 75.2 |
      </html>
    `;

    const result = parseSWEBenchHtml(html);
    expect(result.topVerified).toBe(88.5);
    expect(result.topVerifiedModel).toBe("SuperAgent");
    // Markdown fallback only extracts verified
    expect(result.topBashOnly).toBe(0);
  });

  it("handles empty results array", () => {
    const html = `
      <script id="leaderboard-data">
      [
        {"name": "verified", "results": []}
      ]
      </script>
    `;

    const result = parseSWEBenchHtml(html);
    expect(result.topVerified).toBe(0);
    expect(result.topVerifiedModel).toBe("Unknown");
  });

  it("throws on invalid JSON in script tag", () => {
    const html = `
      <script id="leaderboard-data">
      {not valid json
      </script>
    `;

    expect(() => parseSWEBenchHtml(html)).toThrow("Failed to parse leaderboard JSON");
  });

  it("handles string resolved values", () => {
    const html = `
      <script id="leaderboard-data">
      [
        {"name": "verified", "results": [{"name": "Agent", "resolved": "82.5"}]}
      ]
      </script>
    `;

    const result = parseSWEBenchHtml(html);
    expect(result.topVerified).toBe(82.5);
  });
});
