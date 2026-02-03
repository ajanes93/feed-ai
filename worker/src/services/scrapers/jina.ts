import { RawItem } from "../../types";
import { ITEM_LIMIT, USER_AGENT } from "../constants";

const JINA_BASE = "https://r.jina.ai";

export interface JinaScraperConfig {
  /** Pattern to match links - defaults to markdown heading link pattern */
  linkPattern?: RegExp;
}

// Matches: ### [Title](URL) or ## [Title](URL) or [### Title](URL)
const DEFAULT_LINK_PATTERN =
  /(?:###?\s*\[([^\]]+)\]|\[###?\s*([^\]]+)\])\(([^)]+)\)/g;

/**
 * Scrape a URL using Jina Reader and parse markdown links
 */
export async function fetchJinaScrape(
  url: string,
  sourceId: string,
  config: JinaScraperConfig = {}
): Promise<RawItem[]> {
  const { linkPattern = DEFAULT_LINK_PATTERN } = config;

  const response = await fetch(`${JINA_BASE}/${url}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/plain",
    },
  });

  if (!response.ok) {
    console.error(`Jina scrape failed for ${url}: ${response.status}`);
    return [];
  }

  const markdown = await response.text();

  if (!markdown || markdown.length < 100) {
    console.warn(`Jina returned minimal content for ${url}`);
    return [];
  }

  const items: RawItem[] = [];
  const seen = new Set<string>();

  // Create a fresh regex instance to reset lastIndex
  const pattern = new RegExp(linkPattern.source, linkPattern.flags);

  let match;
  while ((match = pattern.exec(markdown)) !== null) {
    if (items.length >= ITEM_LIMIT) break;

    // Group 1: title from ### [Title] format
    // Group 2: title from [### Title] format
    // Group 3: URL in both cases
    const title = (match[1] || match[2]).trim();
    const link = match[3].trim();

    // Skip empty or invalid
    if (!title || !link) continue;

    // Skip duplicates
    if (seen.has(link)) continue;
    seen.add(link);

    // Skip navigation/non-article links
    if (isNavigationLink(link)) continue;

    items.push({
      id: crypto.randomUUID(),
      sourceId,
      title,
      link,
    });
  }

  if (items.length === 0) {
    console.warn(`No articles found in Jina output for ${url}`);
  }

  return items;
}

function isNavigationLink(link: string): boolean {
  const navPatterns = [
    // Common navigation pages
    /\/(login|signup|subscribe|search|about|faq|help|contact|team|jobs|store|podcast|courses|privacy|terms|newsletter|columnists|products|consulting)/i,
    // Query parameters for sorting
    /\?sort=/,
    // Anchor links
    /^#/,
    // Image files
    /\.(png|jpg|jpeg|gif|svg|ico)$/i,
  ];

  // Check simple patterns first (faster than URL parsing)
  if (navPatterns.some((p) => p.test(link))) {
    return true;
  }

  // Single-segment paths (e.g., /blog, /podcast) are typically navigation
  try {
    const url = new URL(link);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    return pathSegments.length === 1;
  } catch {
    return false;
  }
}
