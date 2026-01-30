import Anthropic from "@anthropic-ai/sdk";
import { RawItem, DigestItem } from "../types";
import { CATEGORY_LIMITS } from "../sources";

interface DigestItemRaw {
  title: string;
  summary: string;
  why_it_matters?: string;
  category: string;
  source_name: string;
  source_url: string;
}

function buildPrompt(items: RawItem[]): string {
  const itemList = items
    .map(
      (item, i) =>
        `${i + 1}. [${item.sourceId}] ${item.title}\n   ${item.content?.slice(0, 200) || "No description"}\n   URL: ${item.link}`
    )
    .join("\n\n");

  return `You are curating a daily digest for a senior software engineer interested in AI, Vue.js, and tech jobs.

Today's date is ${new Date().toISOString().split("T")[0]}.

Here are ${items.length} recent items from various sources:

${itemList}

Select up to ${CATEGORY_LIMITS.ai} AI items, ${CATEGORY_LIMITS.dev} Dev items, and ${CATEGORY_LIMITS.jobs} Jobs items (${Object.values(CATEGORY_LIMITS).reduce((a, b) => a + b, 0)} max total). Prefer items published today or yesterday. Prioritize:
- Major AI announcements or breakthroughs
- Relevant job opportunities (Vue, TypeScript, senior/lead, remote)
- Significant open source releases
- Industry news that affects developers

For each selected item, provide:
- title: A clear, concise title (rewrite if needed)
- summary: 2-3 sentence summary of why this matters
- why_it_matters: 1 sentence on personal relevance (optional, only if genuinely relevant)
- category: One of "ai", "jobs", "dev"
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
]`;
}

function extractJson(text: string): string {
  return text.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
}

async function callGemini(
  prompt: string,
  apiKey: string
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");
  return text;
}

async function callClaude(
  prompt: string,
  apiKey: string
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  if (!response.content || response.content.length === 0) {
    throw new Error("Empty Claude response");
  }
  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected Claude response type");
  }
  return content.text;
}

export async function generateDigest(
  items: RawItem[],
  apiKeys: { gemini?: string; anthropic?: string },
  digestId: string
): Promise<DigestItem[]> {
  const prompt = buildPrompt(items);
  let responseText: string;

  // Try Gemini first (free tier), fall back to Claude
  if (apiKeys.gemini) {
    try {
      console.log("Calling Gemini...");
      responseText = await callGemini(prompt, apiKeys.gemini);
    } catch (err) {
      console.error("Gemini failed, falling back to Claude:", err);
      if (!apiKeys.anthropic) throw err;
      responseText = await callClaude(prompt, apiKeys.anthropic);
    }
  } else if (apiKeys.anthropic) {
    console.log("Calling Claude...");
    responseText = await callClaude(prompt, apiKeys.anthropic);
  } else {
    throw new Error("No AI API key configured (GEMINI_API_KEY or ANTHROPIC_API_KEY)");
  }

  let parsed: DigestItemRaw[];
  try {
    parsed = JSON.parse(extractJson(responseText));
  } catch {
    console.error("Failed to parse AI response:", responseText);
    throw new Error("Failed to parse digest response as JSON");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Expected non-empty JSON array from AI");
  }

  // Validate required fields
  parsed = parsed.filter((item) => {
    const valid =
      typeof item.title === "string" &&
      typeof item.summary === "string" &&
      typeof item.category === "string" &&
      typeof item.source_name === "string" &&
      typeof item.source_url === "string";
    if (!valid) console.warn("Dropping malformed digest item:", item);
    return valid;
  });

  // Enforce per-category limits
  const categoryCounts: Record<string, number> = {};
  parsed = parsed.filter((item) => {
    const cat = item.category;
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    const limit = CATEGORY_LIMITS[cat as keyof typeof CATEGORY_LIMITS];
    return !limit || categoryCounts[cat] <= limit;
  });

  // Build URL → publishedAt lookup from raw items
  const pubDateByUrl = new Map(
    items
      .filter((raw) => raw.publishedAt && raw.link)
      .map((raw) => [raw.link, new Date(raw.publishedAt!).toISOString()])
  );

  return parsed.map((item, index) => ({
    id: `${digestId}-${index}`,
    digestId,
    category: item.category,
    title: item.title,
    summary: item.summary,
    whyItMatters: item.why_it_matters,
    sourceName: item.source_name,
    sourceUrl: item.source_url,
    publishedAt: pubDateByUrl.get(item.source_url),
    position: index,
  }));
}
