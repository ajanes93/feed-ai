import Anthropic from "@anthropic-ai/sdk";
import { RawItem, DigestItem } from "../types";

interface ClaudeDigestItem {
  title: string;
  summary: string;
  why_it_matters?: string;
  category: string;
  source_name: string;
  source_url: string;
}

export async function generateDigest(
  items: RawItem[],
  apiKey: string,
  digestId: string
): Promise<DigestItem[]> {
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey });

  const itemList = items
    .map(
      (item, i) =>
        `${i + 1}. [${item.sourceId}] ${item.title}\n   ${item.content?.slice(0, 200) || "No description"}\n   URL: ${item.link}`
    )
    .join("\n\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
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
]`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  let parsed: ClaudeDigestItem[];
  try {
    // Handle cases where Claude wraps JSON in markdown code blocks
    const text = content.text.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
    parsed = JSON.parse(text);
  } catch {
    console.error("Failed to parse Claude response:", content.text);
    throw new Error("Failed to parse digest response as JSON");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array from Claude");
  }

  return parsed.map((item, index) => ({
    id: `${digestId}-${index}`,
    digestId,
    category: item.category,
    title: item.title,
    summary: item.summary,
    whyItMatters: item.why_it_matters || null,
    sourceName: item.source_name,
    sourceUrl: item.source_url,
    position: index,
  }));
}
