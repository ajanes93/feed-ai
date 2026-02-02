import { Source } from "../sources";
import { RawItem } from "../types";
import { ITEM_LIMIT, USER_AGENT } from "./constants";

// Matches <a href="/path">...<h3>Title</h3>...</a> patterns in HTML
const ARTICLE_LINK_PATTERN =
  /<a[^>]+href="(\/[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/g;

// Paths to exclude from scrape results (navigation, non-article links)
const EXCLUDED_PATHS = new Set([
  "/newsletter",
  "/podcast",
  "/store",
  "/courses",
  "/consulting",
  "/columnists",
  "/products",
]);

interface ScrapeConfig {
  /** Base URL for resolving relative links */
  baseUrl: string;
}

const SCRAPE_CONFIGS: Record<string, ScrapeConfig> = {
  "every-to": {
    baseUrl: "https://every.to",
  },
};

function isArticlePath(path: string): boolean {
  return !EXCLUDED_PATHS.has(path) && path.split("/").length > 2;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

export async function fetchScrapeSource(source: Source): Promise<RawItem[]> {
  const config = SCRAPE_CONFIGS[source.id];
  if (!config) {
    console.error(`No scrape config for source: ${source.id}`);
    return [];
  }

  const response = await fetch(source.url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    console.error(`Scrape failed for ${source.url}: ${response.status}`);
    return [];
  }

  const html = await response.text();

  const seen = new Set<string>();
  const items: RawItem[] = [];

  let match;
  while ((match = ARTICLE_LINK_PATTERN.exec(html)) !== null) {
    const [, path, rawTitle] = match;
    if (!isArticlePath(path) || seen.has(path)) continue;
    seen.add(path);

    const title = stripHtmlTags(rawTitle);
    if (!title) continue;

    items.push({
      id: crypto.randomUUID(),
      sourceId: source.id,
      title,
      link: `${config.baseUrl}${path}`,
      publishedAt: undefined,
    });

    if (items.length >= ITEM_LIMIT) break;
  }

  return items;
}
