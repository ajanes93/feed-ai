import { Source } from "../sources";
import { RawItem } from "../types";
import { ITEM_LIMIT, USER_AGENT, parsePublishedDate } from "./constants";

interface BlueskyPost {
  post: {
    uri: string;
    record: {
      text: string;
      createdAt: string;
    };
  };
}

interface BlueskyFeedResponse {
  feed: BlueskyPost[];
}

interface ResolveHandleResponse {
  did: string;
}

export async function fetchBlueskySource(source: Source): Promise<RawItem[]> {
  const handle = source.url;

  const didRes = await fetch(
    `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
    { headers: { "User-Agent": USER_AGENT } }
  );

  if (!didRes.ok) {
    console.error(
      `Failed to resolve Bluesky handle ${handle}: ${didRes.status}`
    );
    return [];
  }

  const { did } = (await didRes.json()) as ResolveHandleResponse;

  const feedRes = await fetch(
    `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(did)}&limit=${ITEM_LIMIT}`,
    { headers: { "User-Agent": USER_AGENT } }
  );

  if (!feedRes.ok) {
    console.error(
      `Failed to fetch Bluesky feed for ${handle}: ${feedRes.status}`
    );
    return [];
  }

  const { feed } = (await feedRes.json()) as BlueskyFeedResponse;

  return (feed || []).slice(0, ITEM_LIMIT).map((item) => {
    const rkey = item.post.uri.split("/").pop() ?? "";
    return {
      id: crypto.randomUUID(),
      sourceId: source.id,
      title: item.post.record.text.slice(0, 100),
      link: `https://bsky.app/profile/${handle}/post/${rkey}`,
      content: item.post.record.text,
      publishedAt: parsePublishedDate(item.post.record.createdAt),
    };
  });
}
