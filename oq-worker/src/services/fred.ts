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

// Fetch enough observations to compute 4-week trend (daily or weekly data)
const OBSERVATION_LIMIT = 35;

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

// Find the observation closest to `targetDays` ago from the current date
function findByDateOffset(
  observations: FREDObservation[],
  currentDate: string,
  targetDays: number
): FREDObservation | null {
  const currentMs = new Date(currentDate).getTime();
  const targetMs = currentMs - targetDays * 86400000;
  let best: FREDObservation | null = null;
  let bestDiff = Infinity;

  for (let i = 1; i < observations.length; i++) {
    const obsMs = new Date(observations[i].date).getTime();
    const diff = Math.abs(obsMs - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = observations[i];
    }
  }

  return best;
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

  // Previous observation (most recent before current)
  if (observations.length >= 2) {
    const prev = parseFloat(observations[1].value);
    if (!isNaN(prev)) {
      trend.previous = prev;
      trend.previousDate = observations[1].date;
    }
  }

  // ~1 week ago: find observation closest to 7 days before current
  const obs1w = findByDateOffset(observations, observations[0].date, 7);
  if (obs1w) {
    const val = parseFloat(obs1w.value);
    if (!isNaN(val)) {
      trend.change1w = pctChange(current, val);
    }
  }

  // ~4 weeks ago: find observation closest to 28 days before current
  const obs4w = findByDateOffset(observations, observations[0].date, 28);
  if (obs4w) {
    const val = parseFloat(obs4w.value);
    if (!isNaN(val)) {
      trend.change4w = pctChange(current, val);
    }
  }

  return trend;
}

export async function fetchFREDData(
  apiKey: string,
  log?: {
    error: (
      category: string,
      message: string,
      details?: Record<string, unknown>
    ) => Promise<void>;
  }
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
