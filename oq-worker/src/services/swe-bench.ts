// SWE-bench leaderboard scraper
// Extracts top scores for Verified and Bash Only tracks from embedded JSON
// Also scrapes SWE-bench Pro from Scale AI leaderboard

export interface SWEBenchData {
  topVerified: number;
  topVerifiedModel: string;
  topBashOnly: number;
  topBashOnlyModel: string;
  topPro: number;
  topProModel: string;
  fetchedAt: string;
}

export async function fetchSWEBenchLeaderboard(): Promise<SWEBenchData> {
  const [swebenchRes, proRes] = await Promise.all([
    fetch("https://www.swebench.com", {
      headers: { "User-Agent": "FeedAI-OQ/1.0" },
    }),
    fetch("https://scale.com/leaderboard", {
      headers: { "User-Agent": "FeedAI-OQ/1.0" },
    }).catch(() => null),
  ]);

  if (!swebenchRes.ok) {
    throw new Error(`SWE-bench fetch failed: HTTP ${swebenchRes.status}`);
  }

  const html = await swebenchRes.text();
  const data = parseSWEBenchHtml(html);

  // Try to enrich with SWE-bench Pro data from Scale AI
  if (proRes?.ok) {
    const proHtml = await proRes.text();
    const pro = parseScaleLeaderboard(proHtml);
    if (pro) {
      data.topPro = pro.score;
      data.topProModel = pro.model;
    }
  }

  return data;
}

interface LeaderboardEntry {
  name?: string;
  resolved?: number | string;
  folder?: string;
}

interface Leaderboard {
  name: string;
  results?: LeaderboardEntry[];
}

export function parseSWEBenchHtml(html: string): SWEBenchData {
  // SWE-bench stores all leaderboard data in a <script id="leaderboard-data"> JSON blob
  const jsonMatch = html.match(
    /<script[^>]*id="leaderboard-data"[^>]*>([\s\S]*?)<\/script>/
  );

  if (jsonMatch) {
    return parseLeaderboardJson(jsonMatch[1]);
  }

  // Fallback: try to extract from Jina-style markdown table
  return parseMarkdownFallback(html);
}

function parseLeaderboardJson(json: string): SWEBenchData {
  let leaderboards: Leaderboard[];
  try {
    leaderboards = JSON.parse(json);
  } catch {
    throw new Error("SWE-bench: Failed to parse leaderboard JSON");
  }

  let topVerified = 0;
  let topVerifiedModel = "Unknown";
  let topBashOnly = 0;
  let topBashOnlyModel = "Unknown";

  for (const lb of leaderboards) {
    const name = lb.name?.toLowerCase() ?? "";
    const results = lb.results ?? [];
    if (results.length === 0) continue;

    // Find best resolved score
    let best = 0;
    let bestName = "Unknown";
    for (const entry of results) {
      const score = parseFloat(String(entry.resolved ?? 0));
      if (score > best && score <= 100) {
        best = score;
        bestName = entry.name ?? entry.folder ?? "Unknown";
      }
    }

    if (name === "verified") {
      topVerified = best;
      topVerifiedModel = bestName;
    } else if (name === "bash-only" || name === "bash only") {
      topBashOnly = best;
      topBashOnlyModel = bestName;
    }
  }

  return {
    topVerified,
    topVerifiedModel,
    topBashOnly,
    topBashOnlyModel,
    topPro: 0,
    topProModel: "Unknown",
    fetchedAt: new Date().toISOString(),
  };
}

function parseMarkdownFallback(text: string): SWEBenchData {
  // Fallback for Jina markdown table format
  let topVerified = 0;
  let topVerifiedModel = "Unknown";

  const rowPattern =
    /\|\s*(?:\[.\]|-\s*\[.\])\s*\|\s*(.+?)\s*\|\s*(\d+\.\d+)\s*\|/g;
  let match;
  while ((match = rowPattern.exec(text)) !== null) {
    const name = match[1].replace(/\s+/g, " ").replace(/🆕/g, "").trim();
    const score = parseFloat(match[2]);
    if (score > topVerified && score <= 100) {
      topVerified = score;
      topVerifiedModel = name;
    }
  }

  return {
    topVerified,
    topVerifiedModel,
    topBashOnly: 0,
    topBashOnlyModel: "Unknown",
    topPro: 0,
    topProModel: "Unknown",
    fetchedAt: new Date().toISOString(),
  };
}

// Scale AI leaderboard parser for SWE-bench Pro scores
// Data is embedded in Next.js __next_f.push() calls as serialized JSON
interface ScaleProResult {
  score: number;
  model: string;
}

export function parseScaleLeaderboard(html: string): ScaleProResult | null {
  // Scale uses Next.js streaming — data is in self.__next_f.push() calls
  // Look for score data with model names and numeric scores
  const chunks = html.match(/self\.__next_f\.push\(\[[\s\S]*?\]\)/g) ?? [];

  let bestScore = 0;
  let bestModel = "Unknown";

  for (const chunk of chunks) {
    // Extract the string content from the push call
    const strMatch = chunk.match(/"((?:[^"\\]|\\.)*)"/g);
    if (!strMatch) continue;

    for (const quoted of strMatch) {
      const str = quoted
        .slice(1, -1)
        .replace(/\\"/g, '"')
        .replace(/\\n/g, "\n");

      // Look for JSON objects containing score data
      // Pattern: {"model":"...","score":45.89,...} — limit gap to 200 chars
      // to avoid matching across unrelated JSON objects
      const scoreMatches = str.matchAll(
        /"(?:model|version)"\s*:\s*"([^"]+)"[^}]{0,200}"score"\s*:\s*([\d.]+)/g
      );
      for (const m of scoreMatches) {
        const score = parseFloat(m[2]);
        if (score > bestScore && score <= 100) {
          bestScore = score;
          bestModel = m[1];
        }
      }

      // Also try reversed key order: score before model
      const reversedMatches = str.matchAll(
        /"score"\s*:\s*([\d.]+)[^}]{0,200}"(?:model|version)"\s*:\s*"([^"]+)"/g
      );
      for (const m of reversedMatches) {
        const score = parseFloat(m[1]);
        if (score > bestScore && score <= 100) {
          bestScore = score;
          bestModel = m[2];
        }
      }
    }
  }

  if (bestScore > 0) {
    return { score: bestScore, model: bestModel };
  }

  return null;
}
