import { ref } from "vue";

const STORAGE_KEY = "admin_key";

export interface AIUsageEntry {
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
  createdAt: number;
}

export interface SourceHealthEntry {
  sourceId: string;
  sourceName: string;
  category: string;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastError: string | null;
  itemCount: number;
  consecutiveFailures: number;
  stale: boolean;
}

export interface ErrorLogEntry {
  id: string;
  level: string;
  category: string;
  message: string;
  details: Record<string, unknown> | null;
  sourceId: string | null;
  createdAt: number;
}

export interface DashboardData {
  ai: {
    recentCalls: AIUsageEntry[];
    totalTokens: number;
    rateLimitCount: number;
    fallbackCount: number;
  };
  sources: SourceHealthEntry[];
  errors: ErrorLogEntry[];
  totalDigests: number;
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

  async function fetchSources() {
    if (!adminKey.value) {
      needsAuth.value = true;
      return;
    }

    fetching.value = true;
    fetchResult.value = null;
    fetchSuccess.value = false;

    try {
      const res = await fetch(`/api/fetch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminKey.value}` },
      });

      if (res.status === 401) {
        clearAdminKey();
        throw new Error("Invalid admin key");
      }

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Fetch failed");
      }

      fetchResult.value = `Fetched ${body.totalItems} items from ${body.sourcesOk}/${body.sourcesTotal} sources`;
      fetchSuccess.value = true;
      await fetchDashboard();
    } catch (err) {
      fetchResult.value = err instanceof Error ? err.message : "Fetch failed";
      fetchSuccess.value = false;
    } finally {
      fetching.value = false;
    }
  }

  const enriching = ref(false);
  const enrichResult = ref<string | null>(null);
  const enrichSuccess = ref(false);

  async function enrichComments() {
    if (!adminKey.value) {
      needsAuth.value = true;
      return;
    }

    enriching.value = true;
    enrichResult.value = null;
    enrichSuccess.value = false;

    try {
      const res = await fetch(`/api/enrich-comments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminKey.value}` },
      });

      if (res.status === 401) {
        clearAdminKey();
        throw new Error("Invalid admin key");
      }

      const body = await res.json();
      if (!res.ok) {
        throw new Error("Enrichment failed");
      }

      enrichResult.value = `Enriched: ${body.enriched}, Skipped: ${body.skipped}, Remaining: ${body.remaining}`;
      enrichSuccess.value = true;
    } catch (err) {
      enrichResult.value =
        err instanceof Error ? err.message : "Enrichment failed";
      enrichSuccess.value = false;
    } finally {
      enriching.value = false;
    }
  }

  const rebuilding = ref(false);
  const rebuildResult = ref<string | null>(null);
  const rebuildSuccess = ref(false);

  async function rebuildDigest() {
    if (!adminKey.value) {
      needsAuth.value = true;
      return;
    }

    rebuilding.value = true;
    rebuildResult.value = null;
    rebuildSuccess.value = false;

    try {
      const res = await fetch(`/api/rebuild`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminKey.value}` },
      });

      if (res.status === 401) {
        clearAdminKey();
        throw new Error("Invalid admin key");
      }

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || "Rebuild failed");
      }

      rebuildResult.value = text;
      rebuildSuccess.value = true;
      await fetchDashboard();
    } catch (err) {
      rebuildResult.value =
        err instanceof Error ? err.message : "Rebuild failed";
      rebuildSuccess.value = false;
    } finally {
      rebuilding.value = false;
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
      const res = await fetch(`/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${adminKey.value}` },
      });

      if (res.status === 401) {
        clearAdminKey();
        throw new Error("Invalid admin key");
      }

      if (!res.ok) {
        throw new Error("Failed to load dashboard");
      }

      data.value = await res.json();
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Network error";
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
    rebuilding,
    rebuildResult,
    rebuildSuccess,
    enriching,
    enrichResult,
    enrichSuccess,
    setAdminKey,
    fetchDashboard,
    fetchSources,
    rebuildDigest,
    enrichComments,
  };
}
