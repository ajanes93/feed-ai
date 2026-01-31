import { vi } from "vitest";
import type { RawItem } from "../types";

// -- Fetch helpers --

export function stubFetchWith(body: string, status = 200, headers: Record<string, string> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(body, { status, headers })),
  );
}

export function mockGeminiSuccess(text: string, tokens = { prompt: 100, candidates: 50 }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text }] } }],
          usageMetadata: {
            promptTokenCount: tokens.prompt,
            candidatesTokenCount: tokens.candidates,
            totalTokenCount: tokens.prompt + tokens.candidates,
          },
        }),
        { status: 200 },
      ),
    ),
  );
}

// -- AI response builder --

export function aiResponse(items: RawItem[], indices: number[], category = "dev") {
  return JSON.stringify(
    indices.map((i) => ({
      item_index: i,
      title: items[i].title,
      summary: `Summary of ${items[i].title}`,
      why_it_matters: "Relevant",
      category,
      source_name: "Test Source",
    })),
  );
}

// -- D1 mock --

export function mockDB(overrides = {}) {
  const mockFirst = vi.fn().mockResolvedValue(null);
  const mockAll = vi.fn().mockResolvedValue({ results: [] });
  const mockRun = vi.fn().mockResolvedValue({});

  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: mockFirst,
        all: mockAll,
        run: mockRun,
      }),
      first: mockFirst,
      all: mockAll,
    }),
    batch: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

export function makeEnv(db = mockDB()) {
  return {
    DB: db as unknown as D1Database,
    ADMIN_KEY: "test-admin-key",
    ANTHROPIC_API_KEY: "test-anthropic",
    GEMINI_API_KEY: "test-gemini",
  };
}

export function makeRequest(path: string, options: RequestInit = {}) {
  return new Request(`http://localhost${path}`, options);
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
