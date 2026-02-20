import { ref, computed } from "vue";
import type {
  OQHistoryEntry,
  OQSignal,
  OQPillarScores,
  OQModelScore,
  OQModelAgreement,
} from "@feed-ai/shared/oq-types";

interface TodayResponse {
  date: string;
  score: number;
  scoreTechnical: number;
  scoreEconomic: number;
  delta: number;
  analysis: string;
  signals: OQSignal[];
  pillarScores: OQPillarScores;
  modelScores: OQModelScore[];
  modelAgreement: OQModelAgreement;
  modelSpread: number;
  capabilityGap?: string;
  isSeed?: boolean;
}

export function useOneQuestion() {
  const today = ref<TodayResponse | null>(null);
  const history = ref<OQHistoryEntry[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const subscribeStatus = ref<"idle" | "loading" | "success" | "error">("idle");

  async function fetchToday() {
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
    const d = new Date(today.value.date + "T12:00:00");
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
    if (!today.value) return "neutral";
    if (today.value.delta > 0) return "up";
    if (today.value.delta < 0) return "down";
    return "neutral";
  });

  return {
    today,
    history,
    loading,
    error,
    subscribeStatus,
    fetchToday,
    fetchHistory,
    subscribe,
    formattedDate,
    deltaFormatted,
    deltaDirection,
  };
}
