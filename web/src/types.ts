export interface DigestItem {
  id: string;
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
