// SWE-bench leaderboard scraper
// Extracts top scores for Verified and Bash Only tracks from embedded JSON

export interface SWEBenchData {
  topVerified: number;
  topVerifiedModel: string;
  topBashOnly: number;
  topBashOnlyModel: string;
  fetchedAt: string;
}

export async function fetchSWEBenchLeaderboard(): Promise<SWEBenchData> {
  const res = await fetch("https://www.swebench.com", {
    headers: { "User-Agent": "FeedAI-OQ/1.0" },
  });
  if (!res.ok) {
    throw new Error(`SWE-bench fetch failed: HTTP ${res.status}`);
  }

  const html = await res.text();
  return parseSWEBenchHtml(html);
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
    fetchedAt: new Date().toISOString(),
  };
}
