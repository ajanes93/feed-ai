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
  // SanityHarness is a SSR React app — data is in div grid layout, not tables.
  const entries = parseSSREntries(html);

  if (entries.length === 0) {
    throw new Error("SanityHarness: No entries parsed from HTML");
  }

  // Sort by overall descending
  entries.sort((a, b) => b.overall - a.overall);

  const top = entries[0];
  const medianIdx = Math.floor(entries.length / 2);
  const medianPassRate = Math.round(entries[medianIdx].overall * 10) / 10;

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

function parseSSREntries(html: string): SanityHarnessEntry[] {
  const entries: SanityHarnessEntry[] = [];

  // Each leaderboard entry starts with a rank marker like "#1</div>"
  // Followed by agent name, model, overall score, and pass rate in div columns.
  const rankPattern = /#(\d+)<\/div>/g;
  let rankMatch;

  while ((rankMatch = rankPattern.exec(html)) !== null) {
    const rank = parseInt(rankMatch[1]);
    const windowStart = rankMatch.index;
    const windowEnd = Math.min(html.length, windowStart + 5000);
    const window = html.slice(windowStart, windowEnd);

    // Agent name: first <a> with transition-colors class
    const agentMatch = window.match(
      /class="hover:text-indigo-600[^"]*">([\s\S]*?)<\/a>/
    );
    const agent = agentMatch
      ? agentMatch[1].replace(/<[^>]*>/g, "").trim()
      : `Agent #${rank}`;

    // Model name: <span class="truncate" title="ModelName">
    const modelMatch = window.match(
      /<span\s+class="truncate"\s+title="([^"]+)"/
    );
    const model = modelMatch ? modelMatch[1] : "Unknown";

    // Overall score: bold monospace number
    const scoreMatch = window.match(
      /font-mono text-sm font-bold[^"]*">([\d.]+)<\/span>/
    );
    const overall = scoreMatch ? parseFloat(scoreMatch[1]) : 0;

    // Pass rate: emerald-colored percentage
    const passMatch = window.match(/text-emerald-\d+[^"]*">([\d.]+)%/);
    const passRate = passMatch ? parseFloat(passMatch[1]) : 0;

    // Language scores from the flight recorder links and language spectrum
    const languages: Record<string, number> = {};
    const langPattern =
      /title="([a-z]+)"[^>]*>[^<]*<\/span>[^<]*<[^>]*>([\d.]+)%/gi;
    let langMatch;
    while ((langMatch = langPattern.exec(window)) !== null) {
      languages[langMatch[1].toLowerCase()] = parseFloat(langMatch[2]);
    }

    if (overall > 0 || passRate > 0) {
      entries.push({
        agent,
        model,
        overall: passRate > 0 ? passRate : overall,
        languages,
      });
    }
  }

  return entries;
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
