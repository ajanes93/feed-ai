export type { DigestItem, Digest } from "@feed-ai/shared/types";

export interface RawItem {
  id: string;
  sourceId: string;
  title: string;
  link: string;
  commentsUrl?: string;
  content?: string;
  publishedAt?: number;
}

export interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
  ADMIN_KEY: string;
  SELF: Fetcher;
}

export function countByCategory(
  items: { category: string }[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.category] = (counts[item.category] || 0) + 1;
  }
  return counts;
}
