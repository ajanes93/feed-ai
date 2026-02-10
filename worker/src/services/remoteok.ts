import { Source } from "../sources";
import { RawItem } from "../types";
import { ITEM_LIMIT, USER_AGENT, stripHtml } from "./constants";

interface RemoteOKJob {
  slug?: string;
  position?: string;
  company?: string;
  description?: string;
  tags?: string[];
  url?: string;
  epoch?: number;
}

const RELEVANT_TAGS = new Set([
  "vue",
  "vuejs",
  "vue.js",
  "nuxt",
  "frontend",
  "front end",
  "front-end",
  "typescript",
  "javascript",
]);

function isRelevant(job: RemoteOKJob): boolean {
  const tags = (job.tags || []).map((t) => t.toLowerCase());
  return tags.some((t) => RELEVANT_TAGS.has(t));
}

export async function fetchRemoteOK(source: Source): Promise<RawItem[]> {
  const response = await fetch(source.url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    console.error(`HTTP ${response.status} from ${source.name}`);
    return [];
  }

  const data: unknown[] = await response.json();
  // First element is a legal notice object — skip it
  const jobs = data.slice(1) as RemoteOKJob[];

  return jobs
    .filter(isRelevant)
    .slice(0, ITEM_LIMIT)
    .map((job) => ({
      id: crypto.randomUUID(),
      sourceId: source.id,
      title: job.company
        ? `${job.position || "Untitled"} — ${job.company}`
        : job.position || "Untitled",
      link: job.url || "",
      content: stripHtml(job.description || ""),
      publishedAt: job.epoch ? job.epoch * 1000 : undefined,
    }));
}
