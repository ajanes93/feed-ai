import { Source } from "../sources";
import { RawItem } from "../types";
import { ITEM_LIMIT, USER_AGENT, stripHtml } from "./constants";

interface HimalayasJob {
  title: string;
  companyName: string;
  excerpt?: string;
  description?: string;
  applicationLink?: string;
  pubDate?: number;
  guid?: string;
}

interface HimalayasResponse {
  jobs?: HimalayasJob[];
}

export async function fetchHimalayas(source: Source): Promise<RawItem[]> {
  const response = await fetch(source.url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    console.error(`HTTP ${response.status} from ${source.name}`);
    return [];
  }

  const data: HimalayasResponse = await response.json();
  const jobs = data.jobs || [];

  return jobs.slice(0, ITEM_LIMIT).map((job) => ({
    id: crypto.randomUUID(),
    sourceId: source.id,
    title: job.companyName
      ? `${job.title} — ${job.companyName}`
      : job.title || "Untitled",
    link: job.applicationLink || "",
    content: stripHtml(job.description || job.excerpt || ""),
    publishedAt: job.pubDate ? job.pubDate * 1000 : undefined,
  }));
}
