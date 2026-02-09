import type { DigestItem } from "@feed-ai/shared/types";
import { stripHtml, USER_AGENT } from "./constants";
import type { AIUsageEntry } from "./logger";
import type { SummarizerLog } from "./summarizer";

// --- Thresholds for comment summarization ---
// Filter out low-engagement posts to avoid wasting AI calls on uninteresting discussions
const MIN_SCORE = 50;
const MIN_COMMENTS = 10;
const MAX_COMMENTS_TO_FETCH = 20;

// Reddit requires a descriptive User-Agent with contact info
const REDDIT_USER_AGENT = "web:feed-ai:v1.0 (by /u/feed-ai-bot)";

// --- Source identification ---

const REDDIT_SOURCE_IDS = new Set(["r-localllama", "r-vuejs", "r-laravel"]);

const HN_SOURCE_IDS = new Set(["hn-ai", "hn-vue", "hn-frontend", "hn-hiring"]);

function isRedditUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith("reddit.com");
  } catch {
    return false;
  }
}

// --- Reddit comment fetching ---

interface RedditListing {
  data: {
    children: Array<{
      data: {
        score?: number;
        num_comments?: number;
        selftext?: string;
        body?: string;
        replies?: RedditListing | "";
      };
    }>;
  };
}

interface CommentData {
  score: number;
  commentCount: number;
  comments: string[];
}

async function fetchRedditComments(
  postUrl: string,
  logs: SummarizerLog[]
): Promise<CommentData | null> {
  // Reddit JSON API: append .json to the URL path
  let jsonUrl: string;
  try {
    const url = new URL(postUrl);
    url.pathname = url.pathname.replace(/\/?$/, ".json");
    jsonUrl = url.toString();
  } catch (err) {
    logs.push({
      level: "warn",
      message: `Reddit: invalid URL "${postUrl}": ${err instanceof Error ? err.message : String(err)}`,
    });
    return null;
  }

  try {
    logs.push({
      level: "info",
      message: `Reddit: fetching ${jsonUrl}`,
    });
    const response = await fetch(jsonUrl, {
      headers: {
        "User-Agent": REDDIT_USER_AGENT,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      logs.push({
        level: "warn",
        message: `Reddit: HTTP ${response.status} ${response.statusText} for ${jsonUrl}`,
      });
      return null;
    }

    const data = (await response.json()) as RedditListing[];
    if (!Array.isArray(data) || data.length < 2) {
      logs.push({
        level: "warn",
        message: `Reddit: unexpected response shape (array length: ${Array.isArray(data) ? data.length : "not array"}) for ${jsonUrl}`,
      });
      return null;
    }

    const post = data[0]?.data?.children?.[0]?.data;
    if (!post) return null;

    const score = post.score ?? 0;
    const commentCount = post.num_comments ?? 0;

    // Extract top-level comments
    const commentNodes = data[1]?.data?.children ?? [];
    const comments: string[] = [];

    for (const node of commentNodes) {
      if (comments.length >= MAX_COMMENTS_TO_FETCH) break;
      const body = node.data?.body;
      if (body) {
        const text = stripHtml(body).slice(0, 500);
        if (text.length >= 20) comments.push(text);
      }
    }

    logs.push({
      level: "info",
      message: `Reddit: got ${comments.length} comments, score=${score}, commentCount=${commentCount} for "${postUrl}"`,
    });
    return { score, commentCount, comments };
  } catch (err) {
    logs.push({
      level: "warn",
      message: `Reddit: fetch error for ${jsonUrl}: ${err instanceof Error ? err.message : String(err)}`,
    });
    return null;
  }
}

// --- HN comment fetching ---

interface HNItem {
  id: number;
  score?: number;
  descendants?: number;
  kids?: number[];
  text?: string;
  title?: string;
}

interface AlgoliaSearchResult {
  hits: Array<{
    objectID: string;
    points: number;
    num_comments: number;
  }>;
}

async function findHNItemByUrl(
  articleUrl: string,
  logs: SummarizerLog[]
): Promise<{ id: string; score: number; commentCount: number } | null> {
  const searchUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(articleUrl)}&restrictSearchableAttributes=url&hitsPerPage=1`;
  try {
    logs.push({
      level: "info",
      message: `HN: searching Algolia for "${articleUrl}"`,
    });
    const response = await fetch(searchUrl, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      logs.push({
        level: "warn",
        message: `HN: Algolia HTTP ${response.status} ${response.statusText}`,
      });
      return null;
    }

    const data = (await response.json()) as AlgoliaSearchResult;
    const hit = data.hits?.[0];
    if (!hit) {
      logs.push({
        level: "info",
        message: `HN: no Algolia results for "${articleUrl}"`,
      });
      return null;
    }

    logs.push({
      level: "info",
      message: `HN: found item ${hit.objectID} (score=${hit.points}, comments=${hit.num_comments})`,
    });
    return {
      id: hit.objectID,
      score: hit.points ?? 0,
      commentCount: hit.num_comments ?? 0,
    };
  } catch (err) {
    logs.push({
      level: "warn",
      message: `HN: Algolia search error: ${err instanceof Error ? err.message : String(err)}`,
    });
    return null;
  }
}

async function fetchHNItemWithComments(
  itemId: string,
  logs: SummarizerLog[]
): Promise<{ item: HNItem; comments: string[] } | null> {
  try {
    const response = await fetch(
      `https://hacker-news.firebaseio.com/v0/item/${itemId}.json`,
      { headers: { "User-Agent": USER_AGENT } }
    );

    if (!response.ok) {
      logs.push({
        level: "warn",
        message: `HN: Firebase HTTP ${response.status} for item ${itemId}`,
      });
      return null;
    }

    const item = (await response.json()) as HNItem;
    const kidIds = item.kids?.slice(0, MAX_COMMENTS_TO_FETCH) ?? [];
    logs.push({
      level: "info",
      message: `HN: fetching ${kidIds.length} comments for item ${itemId}`,
    });

    // Fetch top-level comments in parallel
    const commentFetches = kidIds.map(async (kidId) => {
      try {
        const res = await fetch(
          `https://hacker-news.firebaseio.com/v0/item/${kidId}.json`,
          { headers: { "User-Agent": USER_AGENT } }
        );
        if (!res.ok) return null;
        const comment = (await res.json()) as HNItem;
        if (!comment.text) return null;
        const text = stripHtml(comment.text).slice(0, 500);
        return text.length >= 20 ? text : null;
      } catch {
        return null;
      }
    });

    const results = await Promise.allSettled(commentFetches);
    const comments = results.flatMap((r) =>
      r.status === "fulfilled" && r.value ? [r.value] : []
    );
    return { item, comments };
  } catch (err) {
    logs.push({
      level: "warn",
      message: `HN: Firebase fetch error for item ${itemId}: ${err instanceof Error ? err.message : String(err)}`,
    });
    return null;
  }
}

/**
 * Extract the HN item ID from a news.ycombinator.com URL.
 * e.g. "https://news.ycombinator.com/item?id=12345" → "12345"
 */
function extractHNItemId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "news.ycombinator.com") {
      const id = parsed.searchParams.get("id");
      return id && /^\d+$/.test(id) ? id : null;
    }
  } catch {
    // ignore invalid URLs
  }
  return null;
}

async function fetchHNComments(
  articleUrl: string,
  logs: SummarizerLog[],
  commentsUrl?: string
): Promise<CommentData | null> {
  // If we have a direct HN comments URL, extract the item ID and skip Algolia
  if (commentsUrl) {
    const directId = extractHNItemId(commentsUrl);
    if (directId) {
      logs.push({
        level: "info",
        message: `HN: using direct item ID ${directId} from comments URL`,
      });
      const result = await fetchHNItemWithComments(directId, logs);
      if (!result) return null;
      return {
        score: result.item.score ?? 0,
        commentCount: result.item.descendants ?? 0,
        comments: result.comments,
      };
    }
  }

  // Fallback: search Algolia by article URL
  const hnItem = await findHNItemByUrl(articleUrl, logs);
  if (!hnItem) return null;

  const result = await fetchHNItemWithComments(hnItem.id, logs);
  if (!result) return null;

  return {
    score: hnItem.score,
    commentCount: hnItem.commentCount,
    comments: result.comments,
  };
}

// --- Comment summarization via Gemini ---

async function summarizeComments(
  itemTitle: string,
  comments: string[],
  apiKey: string,
  logs: SummarizerLog[]
): Promise<{ summary: string; usage: AIUsageEntry } | null> {
  if (comments.length === 0) return null;

  const commentText = comments.map((c, i) => `[${i + 1}] ${c}`).join("\n\n");
  const prompt = `Summarize the key discussion points and notable opinions from these comments about "${itemTitle}" in 2-3 sentences. Highlight any consensus, controversy, or insights not in the article itself.

Comments:
${commentText}

Return ONLY the summary text, no JSON or formatting.`;

  try {
    const start = Date.now();
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 512,
          },
        }),
      }
    );
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      logs.push({
        level: "warn",
        message: `Comment summarization failed: HTTP ${res.status}`,
      });
      return null;
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      logs.push({
        level: "warn",
        message: "Comment summarization returned empty response",
      });
      return null;
    }

    const tokenMeta = data?.usageMetadata;
    return {
      summary: text.trim(),
      usage: {
        model: "gemini-2.0-flash",
        provider: "gemini",
        inputTokens: tokenMeta?.promptTokenCount,
        outputTokens: tokenMeta?.candidatesTokenCount,
        totalTokens: tokenMeta?.totalTokenCount,
        latencyMs,
        wasFallback: false,
        status: "success",
      },
    };
  } catch (err) {
    logs.push({
      level: "warn",
      message: `Comment summarization error: ${err instanceof Error ? err.message : String(err)}`,
    });
    return null;
  }
}

// --- Single-item enrichment for DB-based chaining ---

export interface SingleItemEnrichment {
  commentSummary: string;
  commentCount: number;
  commentScore: number;
  aiUsage: AIUsageEntry;
}

/**
 * Enrich a single item with comment data. Returns null if the item
 * isn't eligible (not Reddit/HN, below thresholds, no comments).
 */
export async function enrichSingleItem(
  title: string,
  sourceUrl: string,
  geminiKey: string,
  logs: SummarizerLog[],
  commentsUrl?: string
): Promise<SingleItemEnrichment | null> {
  const isReddit = isRedditUrl(sourceUrl);
  const platform = isReddit ? "Reddit" : "HN";

  const commentData = isReddit
    ? await fetchRedditComments(sourceUrl, logs)
    : await fetchHNComments(sourceUrl, logs, commentsUrl);

  if (!commentData) {
    logs.push({
      level: "info",
      message: `No ${platform} data for "${title}"`,
    });
    return null;
  }

  if (
    commentData.score < MIN_SCORE ||
    commentData.commentCount < MIN_COMMENTS
  ) {
    logs.push({
      level: "info",
      message: `${platform} item below threshold: score=${commentData.score}, comments=${commentData.commentCount} — "${title}"`,
    });
    return null;
  }

  logs.push({
    level: "info",
    message: `Summarizing ${commentData.comments.length} ${platform} comments for "${title}" (score=${commentData.score}, comments=${commentData.commentCount})`,
  });

  const result = await summarizeComments(
    title,
    commentData.comments,
    geminiKey,
    logs
  );

  if (!result) return null;

  return {
    commentSummary: result.summary,
    commentCount: commentData.commentCount,
    commentScore: commentData.score,
    aiUsage: result.usage,
  };
}

// --- Batch enrichment function (used by tests and inline enrichment) ---

interface CommentEnrichmentResult {
  items: DigestItem[];
  aiUsages: AIUsageEntry[];
  logs: SummarizerLog[];
}

function isEligibleSource(
  sourceUrl: string,
  sourceId: string,
  commentsUrl?: string
): boolean {
  return (
    REDDIT_SOURCE_IDS.has(sourceId) ||
    isRedditUrl(sourceUrl) ||
    HN_SOURCE_IDS.has(sourceId) ||
    !!commentsUrl?.startsWith("https://news.ycombinator.com/")
  );
}

export async function enrichWithCommentSummaries(
  items: DigestItem[],
  sourceIdMap: Map<string, string>,
  apiKeys: { gemini?: string }
): Promise<CommentEnrichmentResult> {
  const logs: SummarizerLog[] = [];
  const aiUsages: AIUsageEntry[] = [];

  if (!apiKeys.gemini) {
    logs.push({
      level: "info",
      message: "Skipping comment summaries — no Gemini API key",
    });
    return { items, aiUsages, logs };
  }

  const enrichedItems = [...items];
  let enrichedCount = 0;

  for (let i = 0; i < enrichedItems.length; i++) {
    const item = enrichedItems[i];
    const sourceId = sourceIdMap.get(item.sourceUrl) ?? "";

    if (!isEligibleSource(item.sourceUrl, sourceId, item.commentsUrl)) continue;

    try {
      const result = await enrichSingleItem(
        item.title,
        item.sourceUrl,
        apiKeys.gemini,
        logs,
        item.commentsUrl
      );

      if (result) {
        enrichedItems[i] = {
          ...item,
          commentSummary: result.commentSummary,
          commentCount: result.commentCount,
          commentScore: result.commentScore,
          commentSummarySource: "generated",
        };
        aiUsages.push(result.aiUsage);
        enrichedCount++;
      }
    } catch (err) {
      logs.push({
        level: "warn",
        message: `Failed to enrich "${item.title}" with comments: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  logs.push({
    level: "info",
    message: `Comment enrichment complete: ${enrichedCount} items enriched`,
  });

  return { items: enrichedItems, aiUsages, logs };
}
