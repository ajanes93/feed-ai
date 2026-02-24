import { XMLParser } from "fast-xml-parser";
import { Source } from "../sources";
import { RawItem } from "../types";
import {
  ITEM_LIMIT,
  USER_AGENT,
  stripHtml,
  parsePublishedDate,
} from "./constants";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

interface VueJobItem {
  title?: string;
  link?: string;
  description?: string;
  "content:encoded"?: string;
  pubDate?: string;
}

export async function fetchVueJobs(source: Source): Promise<RawItem[]> {
  const response = await fetch(source.url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    console.error(`HTTP ${response.status} from ${source.name}`);
    return [];
  }

  const xml = await response.text();
  const parsed = xmlParser.parse(xml);

  const channel = (parsed.rss as Record<string, unknown>)?.channel as
    | Record<string, unknown>
    | undefined;
  const rawItems = channel?.item;
  if (!rawItems) return [];
  const items: VueJobItem[] = Array.isArray(rawItems) ? rawItems : [rawItems];

  // VueJobs is already a Vue-specific source — no additional keyword filtering needed
  return items.slice(0, ITEM_LIMIT).map((item) => ({
    id: crypto.randomUUID(),
    sourceId: source.id,
    title: stripHtml(String(item.title || "Untitled")),
    link: typeof item.link === "string" ? item.link : "",
    content: stripHtml(
      String(item["content:encoded"] || item.description || "")
    ),
    publishedAt: parsePublishedDate(item.pubDate),
  }));
}
