export type { DigestItem, Digest } from "@feed-ai/shared/types";

export interface RawItem {
  id: string;
  sourceId: string;
  title: string;
  link: string;
  content?: string;
  publishedAt?: number;
}

export interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
  ADMIN_KEY: string;
}
