import { ref } from "vue";

const STORAGE_KEY = "oq_admin_key";

interface AICall {
  id: string;
  model: string;
  provider: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  wasFallback: boolean;
  error: string | null;
  status: string;
  createdAt: string;
}

interface SourceEntry {
  sourceName: string;
  pillar: string;
  articleCount: number;
  lastFetched: string | null;
}

interface DashboardData {
  ai: { recentCalls: AICall[]; totalTokens: number };
  sources: SourceEntry[];
  totalScores: number;
  totalArticles: number;
  totalSubscribers: number;
}

export function useDashboard() {
  const data = ref<DashboardData | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const needsAuth = ref(false);
  const adminKey = ref(sessionStorage.getItem(STORAGE_KEY) || "");

  function setAdminKey(key: string) {
    adminKey.value = key;
    sessionStorage.setItem(STORAGE_KEY, key);
    needsAuth.value = false;
  }

  function clearAdminKey() {
    adminKey.value = "";
    sessionStorage.removeItem(STORAGE_KEY);
    needsAuth.value = true;
  }

  const fetching = ref(false);
  const fetchResult = ref<string | null>(null);
  const fetchSuccess = ref(false);

  async function fetchArticles() {
    if (!adminKey.value) {
      needsAuth.value = true;
      return;
    }

    fetching.value = true;
    fetchResult.value = null;
    fetchSuccess.value = false;

    try {
      const res = await fetch("/api/fetch", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminKey.value}` },
      });

      if (res.status === 401) {
        clearAdminKey();
        throw new Error("Invalid admin key");
      }

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Fetch failed");

      fetchResult.value = `Fetched ${body.fetched} new articles${body.errors?.length ? ` (${body.errors.length} errors)` : ""}`;
      fetchSuccess.value = true;
      await fetchDashboard();
    } catch (err) {
      fetchResult.value = err instanceof Error ? err.message : "Fetch failed";
      fetchSuccess.value = false;
    } finally {
      fetching.value = false;
    }
  }

  const scoring = ref(false);
  const scoreResult = ref<string | null>(null);
  const scoreSuccess = ref(false);
  const scoreAlreadyExists = ref(false);

  async function generateScore() {
    if (!adminKey.value) {
      needsAuth.value = true;
      return;
    }

    scoring.value = true;
    scoreResult.value = null;
    scoreSuccess.value = false;
    scoreAlreadyExists.value = false;

    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminKey.value}` },
      });

      if (res.status === 401) {
        clearAdminKey();
        throw new Error("Invalid admin key");
      }

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Score generation failed");

      if (body.alreadyExists) {
        scoreResult.value = `Score already exists for ${body.date}: ${body.score} (delta: ${body.delta})`;
        scoreAlreadyExists.value = true;
      } else {
        scoreResult.value = `Generated score for ${body.date}: ${body.score} (delta: ${body.delta > 0 ? "+" : ""}${body.delta})`;
      }
      scoreSuccess.value = true;
      await fetchDashboard();
    } catch (err) {
      scoreResult.value =
        err instanceof Error ? err.message : "Score generation failed";
      scoreSuccess.value = false;
    } finally {
      scoring.value = false;
    }
  }

  async function rescoreScore() {
    if (!adminKey.value) {
      needsAuth.value = true;
      return;
    }

    scoring.value = true;
    scoreResult.value = null;
    scoreSuccess.value = false;
    scoreAlreadyExists.value = false;

    try {
      const res = await fetch("/api/rescore", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminKey.value}` },
      });

      if (res.status === 401) {
        clearAdminKey();
        throw new Error("Invalid admin key");
      }

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Rescore failed");

      scoreResult.value = `Regenerated score for ${body.date}: ${body.score} (delta: ${body.delta > 0 ? "+" : ""}${body.delta})`;
      scoreSuccess.value = true;
      await fetchDashboard();
    } catch (err) {
      scoreResult.value = err instanceof Error ? err.message : "Rescore failed";
      scoreSuccess.value = false;
    } finally {
      scoring.value = false;
    }
  }

  async function fetchDashboard() {
    if (!adminKey.value) {
      needsAuth.value = true;
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const res = await fetch("/api/admin/dashboard", {
        headers: { Authorization: `Bearer ${adminKey.value}` },
      });

      if (res.status === 401) {
        clearAdminKey();
        throw new Error("Invalid admin key");
      }

      if (!res.ok) throw new Error("Failed to load dashboard");

      data.value = await res.json();
    } catch (err) {
      // iOS Safari throws TypeError with message "Type error" for network failures
      const msg = err instanceof Error ? err.message : "Network error";
      error.value =
        err instanceof TypeError ? "Network error — tap Refresh to retry" : msg;
    } finally {
      loading.value = false;
    }
  }

  return {
    data,
    loading,
    error,
    needsAuth,
    adminKey,
    fetching,
    fetchResult,
    fetchSuccess,
    scoring,
    scoreResult,
    scoreSuccess,
    scoreAlreadyExists,
    setAdminKey,
    fetchDashboard,
    fetchArticles,
    generateScore,
    rescoreScore,
  };
}
