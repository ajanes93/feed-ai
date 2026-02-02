import { Source } from "../sources";
import { RawItem } from "../types";
import { USER_AGENT } from "./constants";
import { ScrapeHandler } from "./scrapers/types";
import { everyToScraper } from "./scrapers/every-to";

const SCRAPERS: Record<string, ScrapeHandler> = {
  "every-to": everyToScraper,
};

export async function fetchScrapeSource(source: Source): Promise<RawItem[]> {
  const scraper = SCRAPERS[source.id];
  if (!scraper) {
    console.error(`No scraper registered for source: ${source.id}`);
    return [];
  }

  const response = await fetch(source.url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    console.error(`Scrape failed for ${source.url}: ${response.status}`);
    return [];
  }

  return scraper.parse(response, source.id);
}
