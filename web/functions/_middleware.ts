interface Env {
  API: Fetcher;
}

interface DigestData {
  id: string;
  date: string;
  itemCount: number;
  [key: string]: unknown;
}

// Cache latest digest in-memory (refreshed each cold start, ~once per minute in prod)
let cachedDigest: DigestData | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getLatestDigest(api: Fetcher): Promise<DigestData | null> {
  if (cachedDigest && Date.now() - cacheTime < CACHE_TTL) return cachedDigest;
  try {
    const res = await api.fetch(new Request("https://api/api/today"));
    if (!res.ok) return null;
    cachedDigest = (await res.json()) as DigestData;
    cacheTime = Date.now();
    return cachedDigest;
  } catch {
    return cachedDigest; // stale is better than nothing
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const response = await context.next();

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;

  const data = await getLatestDigest(context.env.API);
  if (!data) return response;

  const formattedDate = new Date(data.date + "T12:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" },
  );

  return new HTMLRewriter()
    .on("title", {
      element(el) {
        el.setInnerContent(`feed-ai — ${formattedDate}`);
      },
    })
    .on("head", {
      element(el) {
        el.append(
          `<script>window.__FEED_DATA__=${JSON.stringify(data)}</script>`,
          { html: true },
        );
      },
    })
    .transform(response);
};
