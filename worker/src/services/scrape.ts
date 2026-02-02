import { Source } from "../sources";
import { RawItem } from "../types";
import { ITEM_LIMIT, USER_AGENT } from "./constants";

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
  /** CSS selector for article link elements */
  linkSelector: string;
  /** CSS selector for title elements within each link */
  titleSelector: string;
}

const SCRAPE_CONFIGS: Record<string, ScrapeConfig> = {
  "every-to": {
    baseUrl: "https://every.to",
    linkSelector: "a[href]",
    titleSelector: "h3",
  },
};

function isArticlePath(path: string): boolean {
  return !EXCLUDED_PATHS.has(path) && path.split("/").length > 2;
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

  const seen = new Set<string>();
  const items: RawItem[] = [];
  let currentHref: string | null = null;
  let capturingTitle = false;
  let titleText = "";

  const rewriter = new HTMLRewriter()
    .on(config.linkSelector, {
      element(el) {
        currentHref = el.getAttribute("href");
      },
    })
    .on(config.titleSelector, {
      element(el) {
        if (currentHref) {
          capturingTitle = true;
          titleText = "";
        }

        el.onEndTag(() => {
          if (!capturingTitle || !currentHref) return;
          capturingTitle = false;

          const title = titleText.trim();
          const href = currentHref;
          currentHref = null;

          if (!title || !isArticlePath(href) || seen.has(href)) return;
          if (items.length >= ITEM_LIMIT) return;
          seen.add(href);

          items.push({
            id: crypto.randomUUID(),
            sourceId: source.id,
            title,
            link: `${config.baseUrl}${href}`,
            publishedAt: undefined,
          });
        });
      },
      text(chunk) {
        if (capturingTitle) {
          titleText += chunk.text;
        }
      },
    });

  // Consume the response to trigger HTMLRewriter handlers
  await rewriter.transform(response).text();

  return items;
}
