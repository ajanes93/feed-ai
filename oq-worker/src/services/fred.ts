// FRED API integration for labour market data (Pillar 2)
// Fetches Indeed Software Dev Postings and general employment indices
// with historical observations for trend computation

export interface FREDSeriesTrend {
  current: number;
  currentDate: string;
  change1w?: number; // % change vs ~1 week ago
  change4w?: number; // % change vs ~4 weeks ago
  previous?: number; // prior observation value
  previousDate?: string;
}

export interface FREDData {
  softwareIndex?: number;
  softwareDate?: string;
  softwareTrend?: FREDSeriesTrend;
  generalIndex?: number;
  generalDate?: string;
  generalTrend?: FREDSeriesTrend;
  fetchedAt: string;
}

// Indeed Posting Data - Software Development
const SOFTWARE_SERIES = "IHLIDXUSTPSOFTDEVE";
// Initial Claims - general labour market health
const GENERAL_SERIES = "ICSA";

// Fetch enough observations to compute 4-week trend
const OBSERVATION_LIMIT = 8;

interface FREDObservation {
  date: string;
  value: string;
}

async function fetchFREDSeries(
  seriesId: string,
  apiKey: string
): Promise<FREDObservation[]> {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${OBSERVATION_LIMIT}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "FeedAI-OQ/1.0" },
  });

  if (!res.ok) {
    throw new Error(`FRED fetch failed for ${seriesId}: HTTP ${res.status}`);
  }

  const data = (await res.json()) as { observations?: FREDObservation[] };
  return (data.observations ?? []).filter((o) => o.value !== ".");
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function buildTrend(
  observations: FREDObservation[]
): FREDSeriesTrend | null {
  if (observations.length === 0) return null;

  const current = parseFloat(observations[0].value);
  if (isNaN(current)) return null;

  const trend: FREDSeriesTrend = {
    current,
    currentDate: observations[0].date,
  };

  // ~1 week ago: index 1 (weekly data) or closest
  if (observations.length >= 2) {
    const prev = parseFloat(observations[1].value);
    if (!isNaN(prev)) {
      trend.previous = prev;
      trend.previousDate = observations[1].date;
      trend.change1w = pctChange(current, prev);
    }
  }

  // ~4 weeks ago: index 4 for weekly data, fall back to last available
  const idx4w = Math.min(4, observations.length - 1);
  if (idx4w >= 2) {
    const prev4w = parseFloat(observations[idx4w].value);
    if (!isNaN(prev4w)) {
      trend.change4w = pctChange(current, prev4w);
    }
  }

  return trend;
}

export async function fetchFREDData(
  apiKey: string,
  log?: { error: (category: string, message: string, details?: Record<string, unknown>) => Promise<void> }
): Promise<FREDData> {
  const [softwareObs, generalObs] = await Promise.all([
    fetchFREDSeries(SOFTWARE_SERIES, apiKey).catch(async (err) => {
      await log?.error("external", `FRED ${SOFTWARE_SERIES} failed`, {
        series: SOFTWARE_SERIES,
        error: err instanceof Error ? err.message : String(err),
      });
      return [] as FREDObservation[];
    }),
    fetchFREDSeries(GENERAL_SERIES, apiKey).catch(async (err) => {
      await log?.error("external", `FRED ${GENERAL_SERIES} failed`, {
        series: GENERAL_SERIES,
        error: err instanceof Error ? err.message : String(err),
      });
      return [] as FREDObservation[];
    }),
  ]);

  const softwareTrend = buildTrend(softwareObs);
  const generalTrend = buildTrend(generalObs);

  return {
    softwareIndex: softwareTrend?.current,
    softwareDate: softwareTrend?.currentDate,
    softwareTrend: softwareTrend ?? undefined,
    generalIndex: generalTrend?.current,
    generalDate: generalTrend?.currentDate,
    generalTrend: generalTrend ?? undefined,
    fetchedAt: new Date().toISOString(),
  };
}
