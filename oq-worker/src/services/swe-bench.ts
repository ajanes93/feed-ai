// SWE-bench leaderboard scraper
// Extracts top scores for Verified and Pro tracks

export interface SWEBenchData {
  topVerified: number;
  topVerifiedModel: string;
  topPro: number;
  topProModel: string;
  fetchedAt: string;
}

export async function fetchSWEBenchLeaderboard(): Promise<SWEBenchData> {
  // SWE-bench hosts leaderboard data as JSON on their website
  const res = await fetch("https://www.swebench.com", {
    headers: { "User-Agent": "FeedAI-OQ/1.0" },
  });
  if (!res.ok) {
    throw new Error(`SWE-bench fetch failed: HTTP ${res.status}`);
  }

  const html = await res.text();
  return parseSWEBenchHtml(html);
}

export function parseSWEBenchHtml(html: string): SWEBenchData {
  // Extract percentage scores from the leaderboard table
  // Look for patterns like "XX.X%" near model names
  let topVerified = 0;
  let topVerifiedModel = "Unknown";
  let topPro = 0;
  let topProModel = "Unknown";

  // Try to find Verified scores section (fall back to "lite" if "verified" not found)
  const verifiedSection =
    extractSection(html, "verified") ?? extractSection(html, "lite");
  if (verifiedSection) {
    const top = extractTopScore(verifiedSection);
    if (top) {
      topVerified = top.score;
      topVerifiedModel = top.model;
    }
  }

  // Try to find Pro scores section
  const proSection = extractSection(html, "pro");
  if (proSection) {
    const top = extractTopScore(proSection);
    if (top) {
      topPro = top.score;
      topProModel = top.model;
    }
  }

  // Fallback: scan entire page for score patterns
  if (topVerified === 0 && topPro === 0) {
    const scores = extractAllScores(html);
    if (scores.length > 0) {
      topVerified = scores[0];
    }
  }

  return {
    topVerified,
    topVerifiedModel,
    topPro,
    topProModel,
    fetchedAt: new Date().toISOString(),
  };
}

function extractSection(html: string, keyword: string): string | null {
  const idx = html.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return null;
  return html.slice(idx, idx + 5000);
}

function extractTopScore(
  section: string
): { score: number; model: string } | null {
  // Look for patterns like "XX.X" near a model name in table rows
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  let bestScore = 0;
  let bestModel = "Unknown";

  while ((match = rowPattern.exec(section)) !== null) {
    const row = match[1];
    const cells: string[] = [];
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellRe.exec(row)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]*>/g, "").trim());
    }

    for (const cell of cells) {
      const numMatch = cell.match(/(\d{1,3}(?:\.\d{1,2})?)\s*%?/);
      if (numMatch) {
        const val = parseFloat(numMatch[1]);
        if (val > bestScore && val <= 100) {
          bestScore = val;
          bestModel = cells[0] || cells[1] || "Unknown";
        }
      }
    }
  }

  return bestScore > 0 ? { score: bestScore, model: bestModel } : null;
}

function extractAllScores(html: string): number[] {
  const results: number[] = [];
  const pattern = /(\d{1,3}\.\d{1,2})\s*%/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const score = parseFloat(match[1]);
    if (score > 10 && score <= 100) results.push(score);
  }
  return results.sort((a, b) => b - a);
}
