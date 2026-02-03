import { Source } from "../sources";
import { RawItem } from "../types";
import { fetchJinaScrape } from "./scrapers/jina";

/**
 * Fetch items from a scrape source using Jina Reader.
 * All scrape sources use Jina Reader to handle JavaScript rendering.
 */
export async function fetchScrapeSource(source: Source): Promise<RawItem[]> {
  return fetchJinaScrape(source.url, source.id);
}
