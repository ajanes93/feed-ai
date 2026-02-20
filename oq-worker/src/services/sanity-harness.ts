// SanityHarness leaderboard scraper (sanityboard.lr7.dev)
// Pillar 1 data source — measures AI coding *agents* across 6 languages

export interface SanityHarnessEntry {
  agent: string;
  model: string;
  overall: number;
  languages: Record<string, number>;
}

export interface SanityHarnessData {
  topPassRate: number;
  topAgent: string;
  topModel: string;
  medianPassRate: number;
  languageBreakdown: string;
  entries: SanityHarnessEntry[];
  fetchedAt: string;
}

export async function fetchSanityHarness(): Promise<SanityHarnessData> {
  const res = await fetch("https://sanityboard.lr7.dev", {
    headers: { "User-Agent": "FeedAI-OQ/1.0" },
  });
  if (!res.ok) {
    throw new Error(`SanityHarness fetch failed: HTTP ${res.status}`);
  }

  const html = await res.text();
  return parseSanityHarnessHtml(html);
}

export function parseSanityHarnessHtml(html: string): SanityHarnessData {
  const entries: SanityHarnessEntry[] = [];

  const languages = extractLanguages(html);

  // Match all <tr> blocks
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trPattern.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    const cells: string[] = [];
    let cellMatch;
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    while ((cellMatch = cellRe.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]*>/g, "").trim());
    }

    // Need at least: agent, model, overall
    if (cells.length < 3) continue;

    const overall = parseFloat(cells[2]);
    if (isNaN(overall)) continue;

    const langScores: Record<string, number> = {};
    for (let i = 3; i < cells.length && i - 3 < languages.length; i++) {
      const val = parseFloat(cells[i]);
      if (!isNaN(val)) {
        langScores[languages[i - 3]] = val;
      }
    }

    entries.push({
      agent: cells[0],
      model: cells[1],
      overall,
      languages: langScores,
    });
  }

  if (entries.length === 0) {
    throw new Error("SanityHarness: No entries parsed from HTML");
  }

  // Sort by overall descending
  entries.sort((a, b) => b.overall - a.overall);

  const top = entries[0];
  const medianIdx = Math.floor(entries.length / 2);
  const medianPassRate = Math.round(entries[medianIdx].overall * 10) / 10;

  // Build language breakdown string for top agent
  const langParts = Object.entries(top.languages)
    .map(([lang, pct]) => `${lang}: ${pct}%`)
    .join(", ");

  return {
    topPassRate: top.overall,
    topAgent: top.agent,
    topModel: top.model,
    medianPassRate,
    languageBreakdown: langParts || "N/A",
    entries: entries.slice(0, 10),
    fetchedAt: new Date().toISOString(),
  };
}

function extractLanguages(html: string): string[] {
  // Extract language names from table headers
  const thPattern = /<th[^>]*>([\s\S]*?)<\/th>/gi;
  const headers: string[] = [];
  let thMatch;
  while ((thMatch = thPattern.exec(html)) !== null) {
    headers.push(thMatch[1].replace(/<[^>]*>/g, "").trim());
  }

  // Skip first few columns (rank/agent/model/overall) — rest are languages
  // Look for known language names
  const knownLangs = [
    "Python",
    "JavaScript",
    "TypeScript",
    "Go",
    "Rust",
    "Java",
    "Dart",
    "Zig",
    "C",
    "C++",
    "Ruby",
    "Swift",
  ];
  const langs = headers.filter((h) =>
    knownLangs.some((l) => h.toLowerCase().includes(l.toLowerCase()))
  );

  return langs.length > 0 ? langs : headers.slice(3);
}

export function buildSanityHarnessArticleSummary(
  data: SanityHarnessData
): string {
  const note =
    data.topPassRate > 85
      ? " Note: Top agent exceeding 85% — strong signal."
      : data.topPassRate < 50
        ? " Note: Top agent below 50% — agents still struggling."
        : "";

  return `SanityHarness agent benchmark update: Top agent: ${data.topAgent} (${data.topModel}) at ${data.topPassRate}% overall pass rate. Median agent pass rate: ${data.medianPassRate}%. Language breakdown (top agent): ${data.languageBreakdown}.${note}`;
}
