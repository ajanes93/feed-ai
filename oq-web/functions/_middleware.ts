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

async function getTodayData(api: Fetcher): Promise<TodayData | null> {
  try {
    const res = await api.fetch(new Request("https://api/api/today"));
    if (!res.ok) return null;
    return (await res.json()) as TodayData;
  } catch {
    return null;
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const response = await context.next();

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;

  const data = await getTodayData(context.env.API);
  if (!data) return response;

  const ogTitle = `Will AI Replace Software Engineers? Today: ${data.score}%`;
  const analysisSnippet = data.analysis.slice(0, 140).replace(/[^.!?]*$/, "").trim() || data.analysis.slice(0, 100).trim() + "...";
  const ogDesc = `Three AI models read the signals daily. Technical: ${data.scoreTechnical}%. Economic: ${data.scoreEconomic}%. ${analysisSnippet}`;

  const rewritten = new HTMLRewriter()
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
    .transform(response);

  // Prevent browser/CDN from caching stale HTML with old scores
  const fresh = new Response(rewritten.body, rewritten);
  fresh.headers.set("Cache-Control", "no-store");
  return fresh;
};
