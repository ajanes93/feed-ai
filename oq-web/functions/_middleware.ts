interface Env {
  API: Fetcher;
}

interface TodayData {
  score: number;
  scoreTechnical: number;
  scoreEconomic: number;
  analysis: string;
  [key: string]: unknown;
}

// Cache today's data in-memory (refreshed each cold start, ~once per minute in prod)
let cachedData: TodayData | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getTodayData(api: Fetcher): Promise<TodayData | null> {
  if (cachedData && Date.now() - cacheTime < CACHE_TTL) return cachedData;
  try {
    const res = await api.fetch(new Request("https://api/api/today"));
    if (!res.ok) return null;
    cachedData = (await res.json()) as TodayData;
    cacheTime = Date.now();
    return cachedData;
  } catch {
    return cachedData; // stale is better than nothing
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const response = await context.next();

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;

  const data = await getTodayData(context.env.API);
  if (!data) return response;

  const ogTitle = `Will AI Replace Software Engineers? Today: ${data.score}%`;
  const ogDesc = `Three AI models read the signals daily. Technical: ${data.scoreTechnical}%. Economic: ${data.scoreEconomic}%. ${data.analysis.slice(0, 100)}`;

  return new HTMLRewriter()
    .on("title", {
      element(el) {
        el.setInnerContent(
          `One Question — ${data.score}% | Will AI replace software engineers?`,
        );
      },
    })
    .on('meta[property="og:title"]', {
      element(el) {
        el.setAttribute("content", ogTitle);
      },
    })
    .on('meta[property="og:description"]', {
      element(el) {
        el.setAttribute("content", ogDesc);
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        el.setAttribute("content", ogDesc);
      },
    })
    .on("head", {
      element(el) {
        el.append(
          `<script>window.__OQ_DATA__=${JSON.stringify(data)}</script>`,
          { html: true },
        );
      },
    })
    .transform(response);
};
