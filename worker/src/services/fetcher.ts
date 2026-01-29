import { Source } from "../sources";
import { RawItem } from "../types";

function extractTag(xml: string, tag: string): string {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`)
  );
  if (match) return match[1].trim();

  const simple = xml.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)
  );
  return simple ? simple[1].trim() : "";
}

function parseItems(xml: string): Array<{
  title: string;
  link: string;
  content: string;
  pubDate: string;
}> {
  const items: Array<{
    title: string;
    link: string;
    content: string;
    pubDate: string;
  }> = [];

  // Match both <item> (RSS) and <entry> (Atom) elements
  const itemRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, "title");

    // RSS uses <link>, Atom uses <link href="..."/>
    let link = extractTag(block, "link");
    if (!link) {
      const hrefMatch = block.match(
        /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/
      );
      if (hrefMatch) link = hrefMatch[1];
    }

    const content =
      extractTag(block, "description") ||
      extractTag(block, "content") ||
      extractTag(block, "summary") ||
      "";

    const pubDate =
      extractTag(block, "pubDate") ||
      extractTag(block, "published") ||
      extractTag(block, "updated") ||
      "";

    items.push({ title, link, content, pubDate });
  }

  return items;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchSource(source: Source): Promise<RawItem[]> {
  try {
    const response = await fetch(source.url, {
      headers: { "User-Agent": "feed-ai/1.0" },
    });

    if (!response.ok) {
      console.error(`HTTP ${response.status} from ${source.name}`);
      return [];
    }

    const xml = await response.text();
    const items = parseItems(xml);

    return items.slice(0, 20).map((item) => ({
      id: crypto.randomUUID(),
      sourceId: source.id,
      title: stripHtml(item.title) || "Untitled",
      link: item.link || "",
      content: stripHtml(item.content),
      publishedAt: item.pubDate
        ? new Date(item.pubDate).getTime()
        : undefined,
    }));
  } catch (error) {
    console.error(`Failed to fetch ${source.name}:`, error);
    return [];
  }
}

export async function fetchAllSources(
  sources: Source[]
): Promise<RawItem[]> {
  const results = await Promise.allSettled(
    sources.map((source) => fetchSource(source))
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<RawItem[]> =>
        r.status === "fulfilled"
    )
    .flatMap((r) => r.value);
}
