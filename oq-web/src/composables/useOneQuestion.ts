import { ref, computed } from "vue";
import type {
  OQHistoryEntry,
  OQSignal,
  OQPillarScores,
  OQModelScore,
  OQModelAgreement,
} from "@feed-ai/shared/oq-types";

interface SanityHarnessData {
  topPassRate: number;
  topAgent: string;
  topModel: string;
  medianPassRate: number;
  languageBreakdown: string;
}

interface FREDTrend {
  current: number;
  currentDate: string;
  change1w?: number;
  change4w?: number;
}

interface FREDDataResponse {
  softwareIndex?: number;
  softwareDate?: string;
  softwareTrend?: FREDTrend;
  generalIndex?: number;
  generalDate?: string;
  generalTrend?: FREDTrend;
}

export interface MethodologyResponse {
  whatWouldChange: {
    to50: string[];
    to70: string[];
    below20: string[];
  };
  capabilityGap: {
    verified: string;
    verifiedSource?: string;
    pro: string;
    proSource?: string;
    proPrivate?: string;
    proPrivateSource?: string;
    description: string;
  };
  sanityHarness: SanityHarnessData | null;
  fredData: FREDDataResponse;
  pillars: { name: string; weight: number; key: string }[];
  formula: {
    models: string[];
    weights: Record<string, number>;
    dampening: number;
    dailyCap: number;
    scoreRange: [number, number];
    decayTarget: number;
  };
  startingScore: number;
  currentPromptHash: string;
}

interface ExternalDataSnapshot {
  sanityHarness?: SanityHarnessData & {
    entries?: {
      agent: string;
      model: string;
      overall: number;
      languages: Record<string, number>;
    }[];
  };
  sweBench?: {
    topVerified: number;
    topVerifiedModel: string;
    topBashOnly: number;
    topBashOnlyModel: string;
    topPro?: number;
    topProModel?: string;
    topProPrivate?: number;
    topProPrivateModel?: string;
  };
  softwareIndex?: number;
  softwareDate?: string;
  softwareTrend?: FREDTrend;
  generalIndex?: number;
  generalDate?: string;
  generalTrend?: FREDTrend;
}

export interface TodayResponse {
  date: string;
  score: number;
  scoreTechnical: number;
  scoreEconomic: number;
  delta: number;
  deltaExplanation?: string;
  analysis: string;
  signals: OQSignal[];
  pillarScores: OQPillarScores;
  modelScores: OQModelScore[];
  modelAgreement: OQModelAgreement;
  modelSpread: number;
  capabilityGap?: string;
  externalData?: ExternalDataSnapshot;
  isSeed?: boolean;
}

export function useOneQuestion() {
  const today = ref<TodayResponse | null>(null);
  const history = ref<OQHistoryEntry[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const methodology = ref<MethodologyResponse | null>(null);
  const subscribeStatus = ref<"idle" | "loading" | "success" | "error">("idle");

  async function fetchToday() {
    // Use SSR-injected data if available (from Pages Function middleware)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.__OQ_DATA__) {
      today.value = w.__OQ_DATA__ as TodayResponse;
      delete w.__OQ_DATA__;
      return;
    }

    loading.value = true;
    error.value = null;
    try {
      const res = await fetch("/api/today");
      if (!res.ok) throw new Error("Failed to load score");
      today.value = await res.json();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load score";
    } finally {
      loading.value = false;
    }
  }

  async function fetchHistory(days = 30) {
    try {
      const res = await fetch(`/api/history?d=${days}`);
      if (!res.ok) return;
      history.value = await res.json();
    } catch {
      // Non-critical
    }
  }

  async function fetchMethodology() {
    try {
      const res = await fetch("/api/methodology");
      if (!res.ok) return;
      methodology.value = await res.json();
    } catch {
      // Non-critical
    }
  }

  async function subscribe(email: string): Promise<boolean> {
    subscribeStatus.value = "loading";
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        subscribeStatus.value = "error";
        return false;
      }
      subscribeStatus.value = "success";
      return true;
    } catch {
      subscribeStatus.value = "error";
      return false;
    }
  }

  const formattedDate = computed(() => {
    if (!today.value) return "";
    const d = new Date(today.value.date + "T00:00:00");
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  });

  const deltaFormatted = computed(() => {
    if (!today.value) return "";
    const d = today.value.delta;
    if (d === 0) return "No change";
    return `${d > 0 ? "+" : ""}${d} from yesterday`;
  });

  const deltaDirection = computed(() => {
    if (!today.value || today.value.delta === 0) return "neutral";
    return today.value.delta > 0 ? "up" : "down";
  });

  return {
    today,
    history,
    methodology,
    loading,
    error,
    subscribeStatus,
    fetchToday,
    fetchHistory,
    fetchMethodology,
    subscribe,
    formattedDate,
    deltaFormatted,
    deltaDirection,
  };
}
