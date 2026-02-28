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

  // Shared helper: POST an admin endpoint, set result/success refs, handle 401.
  // Returns true if the HTTP request succeeded (dashboard refresh should follow).
  // onSuccess can return a plain string (implies success=true) or { message, success }
  // to signal partial failures on an otherwise-200 response.
  async function adminPost(
    url: string,
    loading: { value: boolean },
    result: { value: string | null },
    success: { value: boolean },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (body: any) => string | { message: string; success: boolean },
    fallbackError: string
  ): Promise<boolean> {
    if (!adminKey.value) {
      needsAuth.value = true;
      return false;
    }

    loading.value = true;
    result.value = null;
    success.value = false;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminKey.value}` },
      });

      if (res.status === 401) {
        clearAdminKey();
        throw new Error("Invalid admin key");
      }

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || fallbackError);

      const outcome = onSuccess(body);
      if (typeof outcome === "string") {
        result.value = outcome;
        success.value = true;
      } else {
        result.value = outcome.message;
        success.value = outcome.success;
      }
      return true;
    } catch (err) {
      result.value = err instanceof Error ? err.message : fallbackError;
      success.value = false;
      return false;
    } finally {
      loading.value = false;
    }
  }

  const fetching = ref(false);
  const fetchResult = ref<string | null>(null);
  const fetchSuccess = ref(false);

  async function fetchArticles() {
    const ok = await adminPost(
      "/api/fetch",
      fetching,
      fetchResult,
      fetchSuccess,
      (body) => {
        const errors: { sourceId: string; message: string }[] =
          body.errors ?? [];
        if (errors.length === 0) return `Fetched ${body.fetched} new articles`;
        const details = errors
          .map((e) => `${e.sourceId}: ${e.message}`)
          .join(", ");
        return {
          message: `Fetched ${body.fetched} articles — ${errors.length} error(s): ${details}`,
          success: false,
        };
      },
      "Fetch failed"
    );
    if (ok) await fetchDashboard();
  }

  const scoring = ref(false);
  const scoreResult = ref<string | null>(null);
  const scoreSuccess = ref(false);

  async function generateScore() {
    const ok = await adminPost(
      "/api/score",
      scoring,
      scoreResult,
      scoreSuccess,
      (body) => {
        const prefix = body.alreadyExists
          ? "Score already exists"
          : "Generated score";
        return `${prefix} for ${body.date}: ${body.score} (delta: ${body.delta > 0 ? "+" : ""}${body.delta})`;
      },
      "Score generation failed"
    );
    if (ok) await fetchDashboard();
  }

  const deleting = ref(false);
  const deleteResult = ref<string | null>(null);
  const deleteSuccess = ref(false);

  async function deleteScore() {
    const ok = await adminPost(
      "/api/delete-score",
      deleting,
      deleteResult,
      deleteSuccess,
      (body) =>
        body.deleted ? `Deleted score for ${body.date}` : body.message,
      "Delete failed"
    );
    if (ok) await fetchDashboard();
  }

  const predigesting = ref(false);
  const predigestResult = ref<string | null>(null);
  const predigestSuccess = ref(false);

  async function runPredigest() {
    await adminPost(
      "/api/predigest",
      predigesting,
      predigestResult,
      predigestSuccess,
      (body) =>
        `Pre-digested ${body.articleCount} articles${body.preDigested ? " (summarized)" : ""}`,
      "Predigest failed"
    );
  }

  const dedupingFunding = ref(false);
  const dedupFundingResult = ref<string | null>(null);
  const dedupFundingSuccess = ref(false);

  async function dedupFunding() {
    await adminPost(
      "/api/admin/backfill?type=dedup-funding",
      dedupingFunding,
      dedupFundingResult,
      dedupFundingSuccess,
      (body) =>
        `Removed ${body.deleted} duplicates, ${body.remaining} remaining`,
      "Dedup failed"
    );
  }

  const extractingFunding = ref(false);
  const extractFundingResult = ref<string | null>(null);
  const extractFundingSuccess = ref(false);

  async function extractFunding() {
    await adminPost(
      "/api/admin/extract-funding",
      extractingFunding,
      extractFundingResult,
      extractFundingSuccess,
      (body) =>
        `Extracted ${body.extracted ?? 0} funding events (${body.scanned ?? 0} articles scanned)`,
      "Extract failed"
    );
  }

  const fetchingSanity = ref(false);
  const fetchSanityResult = ref<string | null>(null);
  const fetchSanitySuccess = ref(false);

  async function fetchSanity() {
    await adminPost(
      "/api/fetch-sanity",
      fetchingSanity,
      fetchSanityResult,
      fetchSanitySuccess,
      (body) =>
        `Fetched Sanity Harness data (${body.stored ?? body.rows ?? "done"})`,
      "Fetch failed"
    );
  }

  const fetchingSwebench = ref(false);
  const fetchSwebenchResult = ref<string | null>(null);
  const fetchSwebenchSuccess = ref(false);

  async function fetchSwebench() {
    await adminPost(
      "/api/fetch-swebench",
      fetchingSwebench,
      fetchSwebenchResult,
      fetchSwebenchSuccess,
      (body) =>
        `Fetched SWE-bench data (${body.stored ?? body.rows ?? "done"})`,
      "Fetch failed"
    );
  }

  const purgingScores = ref(false);
  const purgeScoresResult = ref<string | null>(null);
  const purgeScoresSuccess = ref(false);

  async function purgeScores() {
    const ok = await adminPost(
      "/api/admin/purge-scores",
      purgingScores,
      purgeScoresResult,
      purgeScoresSuccess,
      (body) =>
        `Purged ${body.scores} scores, ${body.scoreArticles} score-article links, ${body.modelResponses} model responses, ${body.fundingEvents} funding events, ${body.aiUsage} AI usage records`,
      "Purge failed"
    );
    if (ok) await fetchDashboard();
  }

  const purgingFunding = ref(false);
  const purgeFundingResult = ref<string | null>(null);
  const purgeFundingSuccess = ref(false);

  async function purgeFunding() {
    const ok = await adminPost(
      "/api/admin/purge-funding",
      purgingFunding,
      purgeFundingResult,
      purgeFundingSuccess,
      (body) => `Purged ${body.fundingEvents} funding events`,
      "Purge failed"
    );
    if (ok) await fetchDashboard();
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
    purgingScores,
    purgeScoresResult,
    purgeScoresSuccess,
    purgingFunding,
    purgeFundingResult,
    purgeFundingSuccess,
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
    purgeScores,
    purgeFunding,
  };
}
