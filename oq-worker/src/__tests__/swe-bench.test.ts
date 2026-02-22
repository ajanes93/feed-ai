import { describe, it, expect } from "vitest";
import {
  parseSWEBenchHtml,
  parseScaleLeaderboard,
} from "../services/swe-bench";

describe("parseSWEBenchHtml", () => {
  function buildHtml(leaderboards: unknown[]): string {
    return `<html><body><script id="leaderboard-data">${JSON.stringify(leaderboards)}</script></body></html>`;
  }

  it("extracts verified and bash-only top scores from JSON blob", () => {
    const html = buildHtml([
      {
        name: "verified",
        results: [
          { name: "Agent-A", resolved: 79.2 },
          { name: "Agent-B", resolved: 65.0 },
        ],
      },
      {
        name: "bash-only",
        results: [
          { name: "Model-X", resolved: 77.1 },
          { name: "Model-Y", resolved: 50.3 },
        ],
      },
    ]);
    const result = parseSWEBenchHtml(html);
    expect(result.topVerified).toBe(79.2);
    expect(result.topVerifiedModel).toBe("Agent-A");
    expect(result.topBashOnly).toBe(77.1);
    expect(result.topBashOnlyModel).toBe("Model-X");
  });

  it("handles 'bash only' name variant (with space)", () => {
    const html = buildHtml([
      { name: "verified", results: [{ name: "A", resolved: 80 }] },
      { name: "bash only", results: [{ name: "B", resolved: 70 }] },
    ]);
    const result = parseSWEBenchHtml(html);
    expect(result.topBashOnly).toBe(70);
    expect(result.topBashOnlyModel).toBe("B");
  });

  it("uses folder as model name when name is missing", () => {
    const html = buildHtml([
      {
        name: "verified",
        results: [{ folder: "my-agent-folder", resolved: 82 }],
      },
    ]);
    const result = parseSWEBenchHtml(html);
    expect(result.topVerifiedModel).toBe("my-agent-folder");
  });

  it("defaults to Unknown when both name and folder are missing", () => {
    const html = buildHtml([{ name: "verified", results: [{ resolved: 75 }] }]);
    const result = parseSWEBenchHtml(html);
    expect(result.topVerifiedModel).toBe("Unknown");
  });

  it("skips scores above 100", () => {
    const html = buildHtml([
      {
        name: "verified",
        results: [
          { name: "Buggy", resolved: 150 },
          { name: "Valid", resolved: 60 },
        ],
      },
    ]);
    const result = parseSWEBenchHtml(html);
    expect(result.topVerified).toBe(60);
    expect(result.topVerifiedModel).toBe("Valid");
  });

  it("handles empty results array", () => {
    const html = buildHtml([{ name: "verified", results: [] }]);
    const result = parseSWEBenchHtml(html);
    expect(result.topVerified).toBe(0);
    expect(result.topVerifiedModel).toBe("Unknown");
  });

  it("handles missing results key", () => {
    const html = buildHtml([{ name: "verified" }]);
    const result = parseSWEBenchHtml(html);
    expect(result.topVerified).toBe(0);
  });

  it("initializes topPro and topProPrivate to 0 and models to Unknown", () => {
    const html = buildHtml([
      { name: "verified", results: [{ name: "A", resolved: 80 }] },
    ]);
    const result = parseSWEBenchHtml(html);
    expect(result.topPro).toBe(0);
    expect(result.topProModel).toBe("Unknown");
    expect(result.topProPrivate).toBe(0);
    expect(result.topProPrivateModel).toBe("Unknown");
  });

  it("parses resolved as string number", () => {
    const html = buildHtml([
      { name: "verified", results: [{ name: "A", resolved: "85.5" }] },
    ]);
    const result = parseSWEBenchHtml(html);
    expect(result.topVerified).toBe(85.5);
  });

  it("throws on invalid JSON in script tag", () => {
    const html =
      '<html><script id="leaderboard-data">not valid json</script></html>';
    expect(() => parseSWEBenchHtml(html)).toThrow(
      "Failed to parse leaderboard JSON"
    );
  });

  it("falls back to markdown parsing when no JSON blob found", () => {
    // Markdown table from Jina-style format
    const html = `
| [x] | Top Agent Name | 88.5 |
| [-] | Second Agent | 75.0 |
`;
    const result = parseSWEBenchHtml(html);
    expect(result.topVerified).toBe(88.5);
    expect(result.topVerifiedModel).toContain("Top Agent Name");
  });

  it("returns zeros when markdown fallback finds nothing", () => {
    const result = parseSWEBenchHtml("<html><body>No data</body></html>");
    expect(result.topVerified).toBe(0);
    expect(result.topVerifiedModel).toBe("Unknown");
    expect(result.topBashOnly).toBe(0);
  });

  it("includes fetchedAt timestamp", () => {
    const html = buildHtml([]);
    const result = parseSWEBenchHtml(html);
    expect(result.fetchedAt).toBeTruthy();
    // Should be a valid ISO date string
    expect(() => new Date(result.fetchedAt)).not.toThrow();
  });
});

describe("parseScaleLeaderboard", () => {
  function buildNextHtml(data: Record<string, unknown>[]): string {
    const serialized = JSON.stringify(data).replace(/"/g, '\\"');
    return `<html><body><script>self.__next_f.push([1,"${serialized}"])</script></body></html>`;
  }

  it("extracts highest score and model from Next.js data", () => {
    const data = [
      { model: "claude-3.5-sonnet", score: 45.89 },
      { model: "gpt-4o", score: 42.1 },
    ];
    const html = buildNextHtml(data);
    const result = parseScaleLeaderboard(html);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(45.89);
    expect(result!.model).toBe("claude-3.5-sonnet");
  });

  it("returns null when no score data found", () => {
    const html = "<html><body>No next data here</body></html>";
    expect(parseScaleLeaderboard(html)).toBeNull();
  });

  it("returns null for empty HTML", () => {
    expect(parseScaleLeaderboard("")).toBeNull();
  });

  it("skips scores above 100 and picks valid entry", () => {
    const data = [
      { model: "buggy", score: 150 },
      { model: "valid", score: 30 },
    ];
    const html = buildNextHtml(data);
    const result = parseScaleLeaderboard(html);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(30);
    expect(result!.model).toBe("valid");
  });

  it("handles reversed key order (score before model)", () => {
    // Score key appears before model key
    const chunk = `<script>self.__next_f.push([1,"{\\"score\\":48.5,\\"model\\":\\"reversed-model\\"}"])</script>`;
    const html = `<html>${chunk}</html>`;
    const result = parseScaleLeaderboard(html);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(48.5);
    expect(result!.model).toBe("reversed-model");
  });

  it("handles version key as alternative to model", () => {
    const chunk = `<script>self.__next_f.push([1,"{\\"version\\":\\"v2-agent\\",\\"score\\":50.2}"])</script>`;
    const html = `<html>${chunk}</html>`;
    const result = parseScaleLeaderboard(html);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(50.2);
    expect(result!.model).toBe("v2-agent");
  });

  it("ignores version keys that are just numbers (Next.js page metadata)", () => {
    // Next.js pages often have {"version":"2.0","score":97} in metadata
    const chunk = `<script>self.__next_f.push([1,"{\\"version\\":\\"2.0\\",\\"score\\":97}"])</script>`;
    const html = `<html>${chunk}</html>`;
    const result = parseScaleLeaderboard(html);
    expect(result).toBeNull();
  });

  it("ignores version keys that are just numbers alongside real model entries", () => {
    const chunk = `<script>self.__next_f.push([1,"[{\\"version\\":\\"3.2\\",\\"score\\":97},{\\"model\\":\\"claude-3.5\\",\\"score\\":45.89}]"])</script>`;
    const html = `<html>${chunk}</html>`;
    const result = parseScaleLeaderboard(html);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(45.89);
    expect(result!.model).toBe("claude-3.5");
  });
});
