import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { fetchMock } from "cloudflare:test";
import { enrichWithCommentSummaries } from "../services/comments";
import type { DigestItem } from "@feed-ai/shared/types";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

function buildItem(overrides: Partial<DigestItem> = {}): DigestItem {
  return {
    id: "item-1",
    category: "ai",
    title: "Test Article",
    summary: "A test summary",
    sourceName: "r/LocalLLaMA",
    sourceUrl: "https://www.reddit.com/r/LocalLLaMA/comments/abc123/test_post",
    position: 0,
    ...overrides,
  };
}

function mockRedditPost(
  score: number,
  numComments: number,
  comments: string[]
) {
  const mock = fetchMock.get("https://www.reddit.com");
  mock.intercept({ method: "GET", path: /.*\.json$/ }).reply(
    200,
    JSON.stringify([
      {
        data: {
          children: [{ data: { score, num_comments: numComments } }],
        },
      },
      {
        data: {
          children: comments.map((body) => ({ data: { body } })),
        },
      },
    ]),
    { headers: { "content-type": "application/json" } }
  );
}

function mockAlgoliaSearch(
  objectID: string,
  points: number,
  numComments: number
) {
  const mock = fetchMock.get("https://hn.algolia.com");
  mock.intercept({ method: "GET", path: /.*/ }).reply(
    200,
    JSON.stringify({
      hits: [{ objectID, points, num_comments: numComments }],
    }),
    { headers: { "content-type": "application/json" } }
  );
}

function mockHNItem(id: string, kids: number[]) {
  const mock = fetchMock.get("https://hacker-news.firebaseio.com");
  mock
    .intercept({ method: "GET", path: `/v0/item/${id}.json` })
    .reply(
      200,
      JSON.stringify({ id: Number(id), kids, score: 100, descendants: 50 }),
      { headers: { "content-type": "application/json" } }
    );
}

function mockHNComment(id: number, text: string) {
  const mock = fetchMock.get("https://hacker-news.firebaseio.com");
  mock
    .intercept({ method: "GET", path: `/v0/item/${id}.json` })
    .reply(200, JSON.stringify({ id, text, type: "comment" }), {
      headers: { "content-type": "application/json" },
    });
}

function mockGeminiSummary(summary: string) {
  const mock = fetchMock.get("https://generativelanguage.googleapis.com");
  mock.intercept({ method: "POST", path: /.*/ }).reply(
    200,
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: summary }] } }],
      usageMetadata: {
        promptTokenCount: 50,
        candidatesTokenCount: 30,
        totalTokenCount: 80,
      },
    }),
    { headers: { "content-type": "application/json" } }
  );
}

describe("enrichWithCommentSummaries", () => {
  describe("Reddit items", () => {
    it("enriches Reddit items above threshold with comment summaries", async () => {
      const item = buildItem();
      const sourceIdMap = new Map([[item.sourceUrl, "r-localllama"]]);

      mockRedditPost(100, 50, [
        "This is a really great post about the topic",
        "I found this very insightful and helpful",
        "I completely agree with this perspective",
      ]);
      mockGeminiSummary(
        "The community was enthusiastic about this development."
      );

      const result = await enrichWithCommentSummaries([item], sourceIdMap, {
        gemini: "test-key",
      });

      expect(result.items[0].commentSummary).toBe(
        "The community was enthusiastic about this development."
      );
      expect(result.items[0].commentCount).toBe(50);
      expect(result.items[0].commentScore).toBe(100);
      expect(result.items[0].commentSummarySource).toBe("generated");
      expect(result.aiUsages).toHaveLength(1);
    });

    it("skips Reddit items below score threshold", async () => {
      const item = buildItem();
      const sourceIdMap = new Map([[item.sourceUrl, "r-localllama"]]);

      mockRedditPost(30, 50, ["This is a comment that will not be summarized"]);

      const result = await enrichWithCommentSummaries([item], sourceIdMap, {
        gemini: "test-key",
      });

      expect(result.items[0].commentSummary).toBeUndefined();
      expect(result.aiUsages).toHaveLength(0);
    });

    it("skips Reddit items below comment count threshold", async () => {
      const item = buildItem();
      const sourceIdMap = new Map([[item.sourceUrl, "r-localllama"]]);

      mockRedditPost(100, 5, ["This is a comment that will not be summarized"]);

      const result = await enrichWithCommentSummaries([item], sourceIdMap, {
        gemini: "test-key",
      });

      expect(result.items[0].commentSummary).toBeUndefined();
    });

    it("detects Reddit items by URL when sourceId is unknown", async () => {
      const item = buildItem();
      const sourceIdMap = new Map<string, string>();

      mockRedditPost(100, 50, [
        "This is a meaningful discussion point about the topic",
      ]);
      mockGeminiSummary("Key takeaway from the discussion.");

      const result = await enrichWithCommentSummaries([item], sourceIdMap, {
        gemini: "test-key",
      });

      expect(result.items[0].commentSummary).toBe(
        "Key takeaway from the discussion."
      );
    });
  });

  describe("HN items", () => {
    it("enriches HN items above threshold with comment summaries", async () => {
      const item = buildItem({
        sourceUrl: "https://example.com/article",
        sourceName: "Hacker News AI",
      });
      const sourceIdMap = new Map([[item.sourceUrl, "hn-ai"]]);

      mockAlgoliaSearch("12345", 200, 80);
      mockHNItem("12345", [100, 101]);
      mockHNComment(100, "This is a really great article about the topic");
      mockHNComment(101, "Interesting perspective on this subject matter");
      mockGeminiSummary("Commenters praised the article's insights.");

      const result = await enrichWithCommentSummaries([item], sourceIdMap, {
        gemini: "test-key",
      });

      expect(result.items[0].commentSummary).toBe(
        "Commenters praised the article's insights."
      );
      expect(result.items[0].commentCount).toBe(80);
      expect(result.items[0].commentScore).toBe(200);
      expect(result.items[0].commentSummarySource).toBe("generated");
    });

    it("skips HN items below threshold", async () => {
      const item = buildItem({
        sourceUrl: "https://example.com/article",
      });
      const sourceIdMap = new Map([[item.sourceUrl, "hn-ai"]]);

      mockAlgoliaSearch("12345", 20, 3);

      const result = await enrichWithCommentSummaries([item], sourceIdMap, {
        gemini: "test-key",
      });

      expect(result.items[0].commentSummary).toBeUndefined();
    });

    it("handles Algolia returning no results", async () => {
      const item = buildItem({
        sourceUrl: "https://example.com/article",
      });
      const sourceIdMap = new Map([[item.sourceUrl, "hn-ai"]]);

      const mock = fetchMock.get("https://hn.algolia.com");
      mock
        .intercept({ method: "GET", path: /.*/ })
        .reply(200, JSON.stringify({ hits: [] }), {
          headers: { "content-type": "application/json" },
        });

      const result = await enrichWithCommentSummaries([item], sourceIdMap, {
        gemini: "test-key",
      });

      expect(result.items[0].commentSummary).toBeUndefined();
    });
  });

  describe("non-discussion items", () => {
    it("skips items from non-Reddit/HN sources", async () => {
      const item = buildItem({
        sourceUrl: "https://blog.vuejs.org/some-post",
        sourceName: "Vue.js Blog",
      });
      const sourceIdMap = new Map([[item.sourceUrl, "vue-blog"]]);

      const result = await enrichWithCommentSummaries([item], sourceIdMap, {
        gemini: "test-key",
      });

      expect(result.items[0].commentSummary).toBeUndefined();
      expect(result.aiUsages).toHaveLength(0);
    });
  });

  describe("error handling", () => {
    it("skips comment enrichment when no Gemini key is provided", async () => {
      const item = buildItem();
      const sourceIdMap = new Map([[item.sourceUrl, "r-localllama"]]);

      const result = await enrichWithCommentSummaries([item], sourceIdMap, {});

      expect(result.items[0].commentSummary).toBeUndefined();
      expect(result.logs[0].message).toContain("no Gemini API key");
    });

    it("continues with other items when one fetch fails", async () => {
      const item1 = buildItem({
        id: "item-1",
        sourceUrl: "https://www.reddit.com/r/LocalLLaMA/comments/fail/post",
      });
      const item2 = buildItem({
        id: "item-2",
        sourceUrl: "https://www.reddit.com/r/vuejs/comments/good/post",
      });
      const sourceIdMap = new Map([
        [item1.sourceUrl, "r-localllama"],
        [item2.sourceUrl, "r-vuejs"],
      ]);

      // First Reddit call fails
      const mock1 = fetchMock.get("https://www.reddit.com");
      mock1
        .intercept({ method: "GET", path: /.*fail.*\.json$/ })
        .reply(500, "server error");

      // Second Reddit call succeeds
      mock1.intercept({ method: "GET", path: /.*good.*\.json$/ }).reply(
        200,
        JSON.stringify([
          {
            data: {
              children: [{ data: { score: 100, num_comments: 50 } }],
            },
          },
          {
            data: {
              children: [
                {
                  data: {
                    body: "This is a good discussion about the topic at hand",
                  },
                },
              ],
            },
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

      mockGeminiSummary("Community discussed this topic.");

      const result = await enrichWithCommentSummaries(
        [item1, item2],
        sourceIdMap,
        { gemini: "test-key" }
      );

      // First item should not be enriched (fetch failed)
      expect(result.items[0].commentSummary).toBeUndefined();
      // Second item should be enriched
      expect(result.items[1].commentSummary).toBe(
        "Community discussed this topic."
      );
    });

    it("handles Gemini summarization failure gracefully", async () => {
      const item = buildItem();
      const sourceIdMap = new Map([[item.sourceUrl, "r-localllama"]]);

      mockRedditPost(100, 50, [
        "This is comment one about the topic being discussed",
        "This is comment two with some further thoughts",
      ]);

      const geminiMock = fetchMock.get(
        "https://generativelanguage.googleapis.com"
      );
      geminiMock
        .intercept({ method: "POST", path: /.*/ })
        .reply(500, "server error");

      const result = await enrichWithCommentSummaries([item], sourceIdMap, {
        gemini: "test-key",
      });

      expect(result.items[0].commentSummary).toBeUndefined();
      expect(result.aiUsages).toHaveLength(0);
    });
  });

  describe("logging", () => {
    it("logs enrichment completion with count", async () => {
      const item = buildItem({
        sourceUrl: "https://blog.vuejs.org/post",
      });
      const sourceIdMap = new Map([[item.sourceUrl, "vue-blog"]]);

      const result = await enrichWithCommentSummaries([item], sourceIdMap, {
        gemini: "test-key",
      });

      const completionLog = result.logs.find((l) =>
        l.message.includes("Comment enrichment complete")
      );
      expect(completionLog).toBeDefined();
      expect(completionLog!.message).toContain("0 items enriched");
    });
  });
});
