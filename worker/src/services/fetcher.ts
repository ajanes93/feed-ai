import Parser from 'rss-parser';
import { Source } from '../sources';
import { RawItem } from '../types';

const parser = new Parser();

export async function fetchSource(source: Source): Promise<RawItem[]> {
  try {
    const feed = await parser.parseURL(source.url);

    return feed.items.slice(0, 20).map((item, index) => ({
      id: `${source.id}-${Date.now()}-${index}`,
      sourceId: source.id,
      title: item.title || 'Untitled',
      link: item.link || '',
      content: item.contentSnippet || item.content || '',
      publishedAt: item.pubDate ? new Date(item.pubDate).getTime() : undefined
    }));
  } catch (error) {
    console.error(`Failed to fetch ${source.name}:`, error);
    return [];
  }
}

export async function fetchAllSources(sources: Source[]): Promise<RawItem[]> {
  const results = await Promise.allSettled(
    sources.map(source => fetchSource(source))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<RawItem[]> => r.status === 'fulfilled')
    .flatMap(r => r.value);
}
