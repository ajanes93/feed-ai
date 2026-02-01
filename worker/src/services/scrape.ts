import { Source } from "../sources";
import { RawItem } from "../types";
import { ITEM_LIMIT, USER_AGENT } from "./constants";

// Matches markdown links: [title](url)
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

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
  /** Only include links whose URL starts with this prefix */
  urlPrefix: string;
}

const SCRAPE_CONFIGS: Record<string, ScrapeConfig> = {
  "every-to": {
    urlPrefix: "https://every.to/",
  },
};

function isArticleUrl(url: string, config: ScrapeConfig): boolean {
  if (!url.startsWith(config.urlPrefix)) return false;
  try {
    const path = new URL(url).pathname;
    return !EXCLUDED_PATHS.has(path) && path.split("/").length > 2;
  } catch {
    return false;
  }
}

export async function fetchScrapeSource(source: Source): Promise<RawItem[]> {
  const config = SCRAPE_CONFIGS[source.id];
  if (!config) {
    console.error(`No scrape config for source: ${source.id}`);
    return [];
  }

  const response = await fetch(`https://r.jina.ai/${source.url}`, {
    headers: {
      Accept: "text/markdown",
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    console.error(`Jina scrape failed for ${source.url}: ${response.status}`);
    return [];
  }

  const markdown = await response.text();

  const seen = new Set<string>();
  const items: RawItem[] = [];

  let match;
  while ((match = MARKDOWN_LINK_PATTERN.exec(markdown)) !== null) {
    const [, title, url] = match;
    if (!isArticleUrl(url, config) || seen.has(url)) continue;
    seen.add(url);

    items.push({
      id: crypto.randomUUID(),
      sourceId: source.id,
      title: title.trim(),
      link: url,
      publishedAt: undefined,
    });

    if (items.length >= ITEM_LIMIT) break;
  }

  return items;
}
