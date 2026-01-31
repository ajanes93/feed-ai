import { fetchMock } from "cloudflare:test";
import type { RawItem } from "../types";

// -- Fetch mock helpers --

export function mockFetchResponse(
  origin: string,
  path: string,
  body: string,
  status = 200,
  headers: Record<string, string> = {}
) {
  const mock = fetchMock.get(origin);
  mock.intercept({ method: "GET", path }).reply(status, body, { headers });
}

export function mockGeminiSuccess(
  text: string,
  tokens = { prompt: 100, candidates: 50 }
) {
  const mock = fetchMock.get("https://generativelanguage.googleapis.com");
  mock.intercept({ method: "POST", path: /.*/ }).reply(
    200,
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata: {
        promptTokenCount: tokens.prompt,
        candidatesTokenCount: tokens.candidates,
        totalTokenCount: tokens.prompt + tokens.candidates,
      },
    }),
    { headers: { "content-type": "application/json" } }
  );
}

// -- AI response builder --

export function aiResponse(
  items: RawItem[],
  indices: number[],
  category = "dev"
) {
  return JSON.stringify(
    indices.map((i) => ({
      item_index: i,
      title: items[i].title,
      summary: `Summary of ${items[i].title}`,
      why_it_matters: "Relevant",
      category,
      source_name: "Test Source",
    }))
  );
}

// -- DB seed helpers --

export async function seedDigest(
  db: D1Database,
  digest: { id: string; date: string; itemCount: number },
  items: Array<{
    id: string;
    category: string;
    title: string;
    summary: string;
    sourceName: string;
    sourceUrl: string;
    position: number;
    whyItMatters?: string;
  }>
) {
  await db.batch([
    db
      .prepare("INSERT INTO digests (id, date, item_count) VALUES (?, ?, ?)")
      .bind(digest.id, digest.date, digest.itemCount),
    ...items.map((item) =>
      db
        .prepare(
          "INSERT INTO items (id, digest_id, category, title, summary, why_it_matters, source_name, source_url, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          item.id,
          digest.id,
          item.category,
          item.title,
          item.summary,
          item.whyItMatters ?? null,
          item.sourceName,
          item.sourceUrl,
          item.position
        )
    ),
  ]);
}

// -- Feed XML fixtures --

export const RSS_FEED = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Article One</title>
      <link>https://example.com/1</link>
      <description>First &amp; best article</description>
      <pubDate>Mon, 27 Jan 2025 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Article Two</title>
      <link>https://example.com/2</link>
      <description>&lt;p&gt;HTML content&lt;/p&gt;</description>
      <pubDate>Tue, 28 Jan 2025 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

export const ATOM_FEED = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom Entry</title>
    <link href="https://example.com/atom/1"/>
    <summary>Atom summary</summary>
    <published>2025-01-28T12:00:00Z</published>
  </entry>
</feed>`;

export const JOBICY_RESPONSE = JSON.stringify({
  jobs: [
    {
      id: 1,
      jobTitle: "Senior Vue Dev",
      url: "https://jobicy.com/1",
      jobDescription: "<p>Great job</p>",
      pubDate: "2025-01-28T12:00:00Z",
    },
    {
      id: 2,
      jobTitle: "Frontend Lead",
      url: "https://jobicy.com/2",
      jobDescription: "Another role",
      pubDate: "2025-01-28T10:00:00Z",
    },
  ],
});
