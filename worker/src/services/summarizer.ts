import Anthropic from '@anthropic-ai/sdk';
import { RawItem, DigestItem } from '../types';

export async function generateDigest(
  items: RawItem[],
  apiKey: string,
  digestId: string
): Promise<DigestItem[]> {
  const client = new Anthropic({ apiKey });

  const itemList = items
    .map((item, i) => `${i + 1}. [${item.sourceId}] ${item.title}\n   ${item.content?.slice(0, 200) || 'No description'}\n   URL: ${item.link}`)
    .join('\n\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are curating a daily digest for a senior software engineer interested in AI, Vue.js, and tech jobs.

Here are today's ${items.length} items from various sources:

${itemList}

Select the 8-10 most important/interesting items. Prioritize:
- Major AI announcements or breakthroughs
- Relevant job opportunities (Vue, TypeScript, senior/lead, remote)
- Significant open source releases
- Industry news that affects developers

For each selected item, provide:
- title: A clear, concise title (rewrite if needed)
- summary: 2-3 sentence summary of why this matters
- why_it_matters: 1 sentence on personal relevance (optional, only if genuinely relevant)
- category: One of "ai", "jobs", "dev", "news"
- source_name: Original source name
- source_url: Original URL

Return ONLY a JSON array, no other text:
[
  {
    "title": "...",
    "summary": "...",
    "why_it_matters": "...",
    "category": "...",
    "source_name": "...",
    "source_url": "..."
  }
]`
    }]
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  const parsed = JSON.parse(content.text);

  return parsed.map((item: any, index: number) => ({
    id: `${digestId}-${index}`,
    digestId,
    category: item.category,
    title: item.title,
    summary: item.summary,
    whyItMatters: item.why_it_matters || null,
    sourceName: item.source_name,
    sourceUrl: item.source_url,
    position: index
  }));
}
