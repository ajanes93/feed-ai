import { env, fetchMock } from "cloudflare:test";
import { oqSources } from "../sources";

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
  "oq_predigest_cache",
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

const VALID_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Test</title>
<item><title>Test Article</title><link>https://example.com/test-1</link>
<pubDate>${new Date().toUTCString()}</pubDate><description>Test desc</description></item>
</channel></rss>`;

/**
 * Mock all OQ source URLs for /api/fetch tests.
 * - failOrigin: return HTTP error for this origin
 * - failStatus: HTTP status to return for the failing origin (default 403)
 * - All other origins return a valid RSS feed with one article.
 */
export function mockAllOQSources(opts?: {
  failOrigin?: string;
  failStatus?: number;
}) {
  fetchMock.activate();
  fetchMock.disableNetConnect();

  // Group sources by origin so we mock every path
  const byOrigin = new Map<string, string[]>();
  for (const source of oqSources) {
    const url = new URL(source.url);
    const paths = byOrigin.get(url.origin) ?? [];
    paths.push(url.pathname + url.search);
    byOrigin.set(url.origin, paths);
  }

  for (const [origin, paths] of byOrigin) {
    const pool = fetchMock.get(origin);
    for (const path of paths) {
      if (opts?.failOrigin && origin === opts.failOrigin) {
        const status = opts.failStatus ?? 403;
        // Retryable statuses (502/503/504) need extra interceptors for retries
        const count = [502, 503, 504].includes(status) ? 3 : 1;
        for (let i = 0; i < count; i++) {
          pool
            .intercept({ method: "GET", path })
            .reply(status, "Forbidden");
        }
      } else {
        pool.intercept({ method: "GET", path }).reply(200, VALID_RSS, {
          headers: { "content-type": "application/xml" },
        });
      }
    }
  }
}
