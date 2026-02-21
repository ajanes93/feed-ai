interface Env {
  API: Fetcher;
}

// Cache today's score in-memory (refreshed each cold start, ~once per minute in prod)
let cachedScore: { score: number; analysis: string } | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getScore(api: Fetcher): Promise<typeof cachedScore> {
  if (cachedScore && Date.now() - cacheTime < CACHE_TTL) return cachedScore;
  try {
    const res = await api.fetch(new Request("https://api/api/today"));
    if (!res.ok) return null;
    const { score, analysis } = (await res.json()) as {
      score: number;
      analysis: string;
    };
    cachedScore = { score, analysis };
    cacheTime = Date.now();
    return cachedScore;
  } catch {
    return cachedScore; // stale is better than nothing
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const response = await context.next();

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;

  const data = await getScore(context.env.API);
  if (!data) return response;

  const ogTitle = `Will AI Replace Software Engineers? Today: ${data.score}%`;
  const ogDesc = `Three AI models read the signals daily. The Capability Gap: ~79% on benchmarks, ~46% on real code. ${data.analysis.slice(0, 140)}`;

  return new HTMLRewriter()
    .on("title", {
      element(el) {
        el.setInnerContent(
          `One Question — ${data.score}% | Will AI replace software engineers?`
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
    .transform(response);
};
