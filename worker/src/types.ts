export interface RawItem {
  id: string;
  sourceId: string;
  title: string;
  link: string;
  content?: string;
  publishedAt?: number;
}

export interface DigestItem {
  id: string;
  digestId: string;
  category: string;
  title: string;
  summary: string;
  whyItMatters?: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt?: string;
  position: number;
}

export interface Digest {
  id: string;
  date: string;
  itemCount: number;
  items: DigestItem[];
}

export interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  ADMIN_KEY: string;
}
