import { XMLParser } from "fast-xml-parser";
import { Source } from "../sources";
import { RawItem } from "../types";
import { fetchBlueskySource } from "./bluesky";
import { fetchScrapeSource } from "./scrape";
import { fetchHNHiring } from "./hn-hiring";
import {
  stripHtml,
  parsePublishedDate,
  ITEM_LIMIT,
  USER_AGENT,
} from "./constants";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

interface FeedItem {
  title?: string;
  link?: string | { "@_href"?: string };
  description?: string;
  "content:encoded"?: string;
  content?: string;
  summary?: string;
  pubDate?: string;
  published?: string;
  updated?: string;
}

function extractLink(link: FeedItem["link"]): string {
  if (typeof link === "string") return link;
  return link?.["@_href"] || "";
}

function extractItems(parsed: Record<string, unknown>): FeedItem[] {
  const rss = parsed.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  const feed = parsed.feed as Record<string, unknown> | undefined;

  const items = channel?.item ?? feed?.entry;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

async function fetchRssFeed(source: Source): Promise<RawItem[]> {
  const response = await fetch(source.url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    console.error(`HTTP ${response.status} from ${source.name}`);
    return [];
  }

  const xml = await response.text();
  const parsed = xmlParser.parse(xml);
  const items = extractItems(parsed);

  return items.slice(0, ITEM_LIMIT).map((item) => ({
    id: crypto.randomUUID(),
    sourceId: source.id,
    title: stripHtml(String(item.title || "Untitled")),
    link: extractLink(item.link),
    content: stripHtml(
      String(
        item["content:encoded"] ||
          item.content ||
          item.description ||
          item.summary ||
          ""
      )
    ),
    publishedAt: parsePublishedDate(
      item.pubDate || item.published || item.updated
    ),
  }));
}

interface JobicyJob {
  id: number;
  jobTitle: string;
  url: string;
  jobDescription?: string;
  pubDate?: string;
}

interface JobicyResponse {
  jobs?: JobicyJob[];
}

async function fetchJsonApi(source: Source): Promise<RawItem[]> {
  const response = await fetch(source.url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    console.error(`HTTP ${response.status} from ${source.name}`);
    return [];
  }

  const data: JobicyResponse = await response.json();
  const jobs = data.jobs || [];

  return jobs.slice(0, ITEM_LIMIT).map((job) => ({
    id: crypto.randomUUID(),
    sourceId: source.id,
    title: job.jobTitle || "Untitled",
    link: job.url || "",
    content: stripHtml(job.jobDescription || ""),
    publishedAt: parsePublishedDate(job.pubDate),
  }));
}

export async function fetchSource(source: Source): Promise<RawItem[]> {
  try {
    switch (source.type) {
      case "api":
        return await fetchJsonApi(source);
      case "bluesky":
        return await fetchBlueskySource(source);
      case "scrape":
        return await fetchScrapeSource(source);
      default:
        // rss, reddit, hn, github — all XML feeds
        // hn-hiring is a special case dispatched by source ID
        if (source.id === "hn-hiring") {
          return await fetchHNHiring(source);
        }
        return await fetchRssFeed(source);
    }
  } catch (error) {
    console.error(`Failed to fetch ${source.name}:`, error);
    return [];
  }
}

export interface SourceFetchResult {
  sourceId: string;
  success: boolean;
  itemCount: number;
  error?: string;
}

export async function fetchAllSources(
  sources: Source[]
): Promise<{ items: RawItem[]; health: SourceFetchResult[] }> {
  const health: SourceFetchResult[] = [];

  const results = await Promise.allSettled(
    sources.map(async (source) => {
      try {
        const items = await fetchSource(source);
        health.push({
          sourceId: source.id,
          success: true,
          itemCount: items.length,
        });
        return items;
      } catch (err) {
        health.push({
          sourceId: source.id,
          success: false,
          itemCount: 0,
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }
    })
  );

  const allItems = results
    .filter(
      (r): r is PromiseFulfilledResult<RawItem[]> => r.status === "fulfilled"
    )
    .flatMap((r) => r.value);

  // Filter to items published within the last 48 hours (items with no date are kept)
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const recent = allItems.filter(
    (item) => !item.publishedAt || item.publishedAt >= cutoff
  );

  console.log(
    `Filtered ${allItems.length} items to ${recent.length} recent items (last 48h)`
  );

  return { items: recent, health };
}
