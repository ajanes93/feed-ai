import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { fetchMock } from "cloudflare:test";
import { fetchBlueskySource } from "../services/bluesky";
import { sourceFactory } from "./factories";

const BLUESKY_SOURCE = sourceFactory.build({
  id: "evan-you-bluesky",
  name: "Evan You",
  type: "bluesky",
  url: "evanyou.me",
  category: "dev",
});

const RESOLVE_HANDLE_RESPONSE = JSON.stringify({
  did: "did:plc:abc123",
});

function blueskyFeedResponse(
  posts: Array<{ text: string; createdAt: string; rkey: string }>
) {
  return JSON.stringify({
    feed: posts.map((p) => ({
      post: {
        uri: `at://did:plc:abc123/app.bsky.feed.post/${p.rkey}`,
        record: {
          text: p.text,
          createdAt: p.createdAt,
        },
      },
    })),
  });
}

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
});

describe("fetchBlueskySource", () => {
  it("resolves handle and returns posts", async () => {
    fetchMock
      .get("https://bsky.social")
      .intercept({
        method: "GET",
        path: "/xrpc/com.atproto.identity.resolveHandle?handle=evanyou.me",
      })
      .reply(200, RESOLVE_HANDLE_RESPONSE, {
        headers: { "content-type": "application/json" },
      });

    fetchMock
      .get("https://public.api.bsky.app")
      .intercept({
        method: "GET",
        path: /\/xrpc\/app\.bsky\.feed\.getAuthorFeed/,
      })
      .reply(
        200,
        blueskyFeedResponse([
          {
            text: "Just released Vue 4.0!",
            createdAt: "2026-01-30T12:00:00Z",
            rkey: "post123",
          },
          {
            text: "Working on some exciting stuff",
            createdAt: "2026-01-29T10:00:00Z",
            rkey: "post456",
          },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchBlueskySource(BLUESKY_SOURCE);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Just released Vue 4.0!");
    expect(items[0].link).toBe(
      "https://bsky.app/profile/evanyou.me/post/post123"
    );
    expect(items[0].content).toBe("Just released Vue 4.0!");
    expect(items[0].sourceId).toBe("evan-you-bluesky");
    expect(items[0].publishedAt).toBe(
      new Date("2026-01-30T12:00:00Z").getTime()
    );
  });

  it("truncates title to 100 characters", async () => {
    const longText = "A".repeat(150);

    fetchMock
      .get("https://bsky.social")
      .intercept({
        method: "GET",
        path: /\/xrpc\/com\.atproto\.identity\.resolveHandle/,
      })
      .reply(200, RESOLVE_HANDLE_RESPONSE, {
        headers: { "content-type": "application/json" },
      });

    fetchMock
      .get("https://public.api.bsky.app")
      .intercept({
        method: "GET",
        path: /\/xrpc\/app\.bsky\.feed\.getAuthorFeed/,
      })
      .reply(
        200,
        blueskyFeedResponse([
          { text: longText, createdAt: "2026-01-30T12:00:00Z", rkey: "post1" },
        ]),
        { headers: { "content-type": "application/json" } }
      );

    const items = await fetchBlueskySource(BLUESKY_SOURCE);

    expect(items[0].title).toHaveLength(100);
    expect(items[0].content).toBe(longText);
  });

  it("returns empty array when handle resolution fails", async () => {
    fetchMock
      .get("https://bsky.social")
      .intercept({
        method: "GET",
        path: /\/xrpc\/com\.atproto\.identity\.resolveHandle/,
      })
      .reply(404, "Not found");

    const items = await fetchBlueskySource(BLUESKY_SOURCE);

    expect(items).toEqual([]);
  });

  it("returns empty array when feed fetch fails", async () => {
    fetchMock
      .get("https://bsky.social")
      .intercept({
        method: "GET",
        path: /\/xrpc\/com\.atproto\.identity\.resolveHandle/,
      })
      .reply(200, RESOLVE_HANDLE_RESPONSE, {
        headers: { "content-type": "application/json" },
      });

    fetchMock
      .get("https://public.api.bsky.app")
      .intercept({
        method: "GET",
        path: /\/xrpc\/app\.bsky\.feed\.getAuthorFeed/,
      })
      .reply(500, "Server error");

    const items = await fetchBlueskySource(BLUESKY_SOURCE);

    expect(items).toEqual([]);
  });

  it("handles empty feed", async () => {
    fetchMock
      .get("https://bsky.social")
      .intercept({
        method: "GET",
        path: /\/xrpc\/com\.atproto\.identity\.resolveHandle/,
      })
      .reply(200, RESOLVE_HANDLE_RESPONSE, {
        headers: { "content-type": "application/json" },
      });

    fetchMock
      .get("https://public.api.bsky.app")
      .intercept({
        method: "GET",
        path: /\/xrpc\/app\.bsky\.feed\.getAuthorFeed/,
      })
      .reply(200, JSON.stringify({ feed: [] }), {
        headers: { "content-type": "application/json" },
      });

    const items = await fetchBlueskySource(BLUESKY_SOURCE);

    expect(items).toEqual([]);
  });
});
