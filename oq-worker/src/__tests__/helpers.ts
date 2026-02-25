import { env, fetchMock } from "cloudflare:test";

const TABLES = [
  "oq_scores",
  "oq_articles",
  "oq_subscribers",
  "oq_ai_usage",
  "oq_external_data_history",
  "oq_model_responses",
  "oq_score_articles",
  "oq_cron_runs",
  "oq_fetch_errors",
  "oq_logs",
  "oq_funding_events",
  "oq_prompt_versions",
];

export async function cleanAllTables() {
  for (const table of TABLES) {
    await env.DB.exec(`DELETE FROM ${table}`);
  }
}

// --- Fetch mock helpers ---

export function buildSanityHtml(
  entries: {
    rank: number;
    agent: string;
    model: string;
    score: number;
    passRate: number;
    languages?: Record<string, number>;
  }[]
): string {
  return entries
    .map((e) => {
      const langHtml = Object.entries(e.languages ?? {})
        .map(
          ([lang, pct]) =>
            `<div class="h-full bg-cyan-500" title="${lang}: ${pct}% Pass"></div>`
        )
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

export function mockSanityHarness(html: string) {
  fetchMock.activate();
  fetchMock.disableNetConnect();
  fetchMock
    .get("https://sanityboard.lr7.dev")
    .intercept({ method: "GET", path: "/" })
    .reply(200, html, { headers: { "content-type": "text/html" } });
}

export function mockSanityHarnessError(status = 500) {
  fetchMock.activate();
  fetchMock.disableNetConnect();
  fetchMock
    .get("https://sanityboard.lr7.dev")
    .intercept({ method: "GET", path: "/" })
    .reply(status, "Server Error");
}
