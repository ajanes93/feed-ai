import { Source } from "../sources";
import { RawItem } from "../types";
import { ITEM_LIMIT, USER_AGENT, stripHtml } from "./constants";

interface ArbeitnowJob {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  location?: string;
  created_at?: number;
}

interface ArbeitnowResponse {
  data?: ArbeitnowJob[];
}

const RELEVANT_KEYWORDS =
  /\b(vue|vuejs|vue\.js|nuxt|frontend|front.end|typescript)\b/i;

function isRelevant(job: ArbeitnowJob): boolean {
  if (!job.remote) return false;
  const title = job.title || "";
  const tags = (job.tags || []).join(" ");
  return RELEVANT_KEYWORDS.test(title) || RELEVANT_KEYWORDS.test(tags);
}

export async function fetchArbeitnow(source: Source): Promise<RawItem[]> {
  const response = await fetch(source.url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    console.error(`HTTP ${response.status} from ${source.name}`);
    return [];
  }

  const data: ArbeitnowResponse = await response.json();
  const jobs = data.data || [];

  return jobs
    .filter(isRelevant)
    .slice(0, ITEM_LIMIT)
    .map((job) => ({
      id: crypto.randomUUID(),
      sourceId: source.id,
      title: job.company_name
        ? `${job.title || "Untitled"} — ${job.company_name}`
        : job.title || "Untitled",
      link: job.url || "",
      content: stripHtml(job.description || ""),
      publishedAt: job.created_at ? job.created_at * 1000 : undefined,
    }));
}
