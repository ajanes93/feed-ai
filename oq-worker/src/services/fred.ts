// FRED API integration for labour market data (Pillar 2)
// Fetches Indeed Software Dev Postings and general employment indices

export interface FREDData {
  softwareIndex?: number;
  softwareDate?: string;
  generalIndex?: number;
  generalDate?: string;
  fetchedAt: string;
}

// Indeed Posting Data - Software Development
const SOFTWARE_SERIES = "IHLIDXUSTPSOFTDEVE";
// Initial Claims - general labour market health
const GENERAL_SERIES = "ICSA";

async function fetchFREDSeries(
  seriesId: string,
  apiKey: string
): Promise<{ value: number; date: string } | null> {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "FeedAI-OQ/1.0" },
  });

  if (!res.ok) {
    throw new Error(`FRED fetch failed for ${seriesId}: HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    observations?: { date: string; value: string }[];
  };
  const obs = data.observations?.[0];
  if (!obs || obs.value === ".") return null;

  return {
    value: parseFloat(obs.value),
    date: obs.date,
  };
}

export async function fetchFREDData(apiKey: string): Promise<FREDData> {
  const [software, general] = await Promise.all([
    fetchFREDSeries(SOFTWARE_SERIES, apiKey).catch(() => null),
    fetchFREDSeries(GENERAL_SERIES, apiKey).catch(() => null),
  ]);

  return {
    softwareIndex: software?.value,
    softwareDate: software?.date,
    generalIndex: general?.value,
    generalDate: general?.date,
    fetchedAt: new Date().toISOString(),
  };
}
