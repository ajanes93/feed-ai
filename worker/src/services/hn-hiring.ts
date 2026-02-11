import { Source } from "../sources";
import { RawItem } from "../types";
import {
  ITEM_LIMIT,
  USER_AGENT,
  stripHtml,
  parsePublishedDate,
} from "./constants";

const JOB_KEYWORDS = /\b(vue|vuejs|vue\.js|nuxt)\b/i;

interface AlgoliaSearchResponse {
  hits: Array<{ objectID: string }>;
}

interface AlgoliaItemResponse {
  children: Array<{
    id: number;
    text: string;
    created_at: string;
  }>;
}

export async function fetchHNHiring(source: Source): Promise<RawItem[]> {
  // Step 1: Find the latest "Who is hiring" thread
  const searchRes = await fetch(source.url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!searchRes.ok) {
    console.error(`HN Algolia search failed: ${searchRes.status}`);
    return [];
  }

  const { hits } = (await searchRes.json()) as AlgoliaSearchResponse;
  if (!hits.length) return [];

  const threadId = hits[0].objectID;

  // Step 2: Fetch the thread's comments (job listings)
  const commentsRes = await fetch(
    `https://hn.algolia.com/api/v1/items/${threadId}`,
    { headers: { "User-Agent": USER_AGENT } }
  );

  if (!commentsRes.ok) {
    console.error(`HN Algolia item fetch failed: ${commentsRes.status}`);
    return [];
  }

  const thread = (await commentsRes.json()) as AlgoliaItemResponse;
  const children = thread.children || [];

  // Step 3: Filter for relevant job postings
  return children
    .filter((c) => c.text && JOB_KEYWORDS.test(c.text))
    .slice(0, ITEM_LIMIT)
    .map((c) => {
      const plainText = stripHtml(c.text);
      const title =
        plainText.length > 100 ? plainText.slice(0, 100) + "…" : plainText;
      return {
        id: crypto.randomUUID(),
        sourceId: source.id,
        title,
        link: `https://news.ycombinator.com/item?id=${c.id}`,
        content: plainText,
        publishedAt: parsePublishedDate(c.created_at),
      };
    });
}
