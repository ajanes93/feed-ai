export interface DigestItem {
  id: string;
  digestId?: string;
  category: string;
  title: string;
  summary: string;
  whyItMatters?: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt?: string;
  position: number;
  commentSummary?: string;
  commentCount?: number;
  commentScore?: number;
  commentSummarySource?: "native" | "generated";
}

export interface Digest {
  id: string;
  date: string;
  itemCount: number;
  items: DigestItem[];
}
