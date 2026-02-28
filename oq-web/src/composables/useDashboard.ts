import { ref, computed } from "vue";

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
  todayScoreExists: boolean;
}

export function useDashboard() {
  const data = ref<DashboardData | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const needsAuth = ref(false);
  const adminKey = ref(
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(STORAGE_KEY) || ""
      : ""
  );

  const todayScoreExists = computed(
    () => data.value?.todayScoreExists ?? false
  );

  function setAdminKey(key: string) {
    adminKey.value = key;
    if (typeof sessionStorage !== "undefined")
      sessionStorage.setItem(STORAGE_KEY, key);
    needsAuth.value = false;
  }

  function clearAdminKey() {
    adminKey.value = "";
    if (typeof sessionStorage !== "undefined")
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

  async function generateScore() {
    if (!adminKey.value) {
      needsAuth.value = true;
      return;
    }

    scoring.value = true;
    scoreResult.value = null;
    scoreSuccess.value = false;

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

  const deleting = ref(false);
  const deleteResult = ref<string | null>(null);
  const deleteSuccess = ref(false);

  async function deleteScore() {
    if (!adminKey.value) {
      needsAuth.value = true;
      return;
    }

    deleting.value = true;
    deleteResult.value = null;
    deleteSuccess.value = false;

    try {
      const res = await fetch("/api/delete-score", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminKey.value}` },
      });

      if (res.status === 401) {
        clearAdminKey();
        throw new Error("Invalid admin key");
      }

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Delete failed");

      deleteResult.value = body.deleted
        ? `Deleted score for ${body.date}`
        : body.message;
      deleteSuccess.value = true;
      await fetchDashboard();
    } catch (err) {
      deleteResult.value = err instanceof Error ? err.message : "Delete failed";
      deleteSuccess.value = false;
    } finally {
      deleting.value = false;
    }
  }

  const predigesting = ref(false);
  const predigestResult = ref<string | null>(null);
  const predigestSuccess = ref(false);

  async function runPredigest() {
    if (!adminKey.value) {
      needsAuth.value = true;
      return;
    }

    predigesting.value = true;
    predigestResult.value = null;
    predigestSuccess.value = false;

    try {
      const res = await fetch("/api/predigest", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminKey.value}` },
      });

      if (res.status === 401) {
        clearAdminKey();
        throw new Error("Invalid admin key");
      }

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Predigest failed");

      predigestResult.value = `Pre-digested ${body.articleCount} articles${body.preDigested ? " (summarized)" : ""}`;
      predigestSuccess.value = true;
    } catch (err) {
      predigestResult.value =
        err instanceof Error ? err.message : "Predigest failed";
      predigestSuccess.value = false;
    } finally {
      predigesting.value = false;
    }
  }

  const dedupingFunding = ref(false);
  const dedupFundingResult = ref<string | null>(null);
  const dedupFundingSuccess = ref(false);

  async function dedupFunding() {
    if (!adminKey.value) {
      needsAuth.value = true;
      return;
    }

    dedupingFunding.value = true;
    dedupFundingResult.value = null;
    dedupFundingSuccess.value = false;

    try {
      const res = await fetch("/api/admin/backfill?type=dedup-funding", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminKey.value}` },
      });

      if (res.status === 401) {
        clearAdminKey();
        throw new Error("Invalid admin key");
      }

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Dedup failed");

      dedupFundingResult.value = `Removed ${body.deleted} duplicates, ${body.remaining} remaining`;
      dedupFundingSuccess.value = true;
    } catch (err) {
      dedupFundingResult.value =
        err instanceof Error ? err.message : "Dedup failed";
      dedupFundingSuccess.value = false;
    } finally {
      dedupingFunding.value = false;
    }
  }

  const extractingFunding = ref(false);
  const extractFundingResult = ref<string | null>(null);
  const extractFundingSuccess = ref(false);

  async function extractFunding() {
    if (!adminKey.value) {
      needsAuth.value = true;
      return;
    }

    extractingFunding.value = true;
    extractFundingResult.value = null;
    extractFundingSuccess.value = false;

    try {
      const res = await fetch("/api/admin/extract-funding", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminKey.value}` },
      });

      if (res.status === 401) {
        clearAdminKey();
        throw new Error("Invalid admin key");
      }

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Extract failed");

      extractFundingResult.value = `Extracted ${body.extracted ?? 0} funding events (${body.scanned ?? 0} articles scanned)`;
      extractFundingSuccess.value = true;
    } catch (err) {
      extractFundingResult.value =
        err instanceof Error ? err.message : "Extract failed";
      extractFundingSuccess.value = false;
    } finally {
      extractingFunding.value = false;
    }
  }

  const fetchingSanity = ref(false);
  const fetchSanityResult = ref<string | null>(null);
  const fetchSanitySuccess = ref(false);

  async function fetchSanity() {
    if (!adminKey.value) {
      needsAuth.value = true;
      return;
    }

    fetchingSanity.value = true;
    fetchSanityResult.value = null;
    fetchSanitySuccess.value = false;

    try {
      const res = await fetch("/api/fetch-sanity", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminKey.value}` },
      });

      if (res.status === 401) {
        clearAdminKey();
        throw new Error("Invalid admin key");
      }

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Fetch failed");

      fetchSanityResult.value = `Fetched Sanity Harness data (${body.stored ?? body.rows ?? "done"})`;
      fetchSanitySuccess.value = true;
    } catch (err) {
      fetchSanityResult.value =
        err instanceof Error ? err.message : "Fetch failed";
      fetchSanitySuccess.value = false;
    } finally {
      fetchingSanity.value = false;
    }
  }

  const fetchingSwebench = ref(false);
  const fetchSwebenchResult = ref<string | null>(null);
  const fetchSwebenchSuccess = ref(false);

  async function fetchSwebench() {
    if (!adminKey.value) {
      needsAuth.value = true;
      return;
    }

    fetchingSwebench.value = true;
    fetchSwebenchResult.value = null;
    fetchSwebenchSuccess.value = false;

    try {
      const res = await fetch("/api/fetch-swebench", {
        method: "POST",
        headers: { Authorization: `Bearer ${adminKey.value}` },
      });

      if (res.status === 401) {
        clearAdminKey();
        throw new Error("Invalid admin key");
      }

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Fetch failed");

      fetchSwebenchResult.value = `Fetched SWE-bench data (${body.stored ?? body.rows ?? "done"})`;
      fetchSwebenchSuccess.value = true;
    } catch (err) {
      fetchSwebenchResult.value =
        err instanceof Error ? err.message : "Fetch failed";
      fetchSwebenchSuccess.value = false;
    } finally {
      fetchingSwebench.value = false;
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
    todayScoreExists,
    deleting,
    deleteResult,
    deleteSuccess,
    predigesting,
    predigestResult,
    predigestSuccess,
    dedupingFunding,
    dedupFundingResult,
    dedupFundingSuccess,
    extractingFunding,
    extractFundingResult,
    extractFundingSuccess,
    fetchingSanity,
    fetchSanityResult,
    fetchSanitySuccess,
    fetchingSwebench,
    fetchSwebenchResult,
    fetchSwebenchSuccess,
    setAdminKey,
    clearAdminKey,
    fetchDashboard,
    fetchArticles,
    generateScore,
    deleteScore,
    runPredigest,
    dedupFunding,
    extractFunding,
    fetchSanity,
    fetchSwebench,
  };
}
