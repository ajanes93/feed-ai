import { ref } from "vue";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";
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

  async function fetchDashboard() {
    if (!adminKey.value) {
      needsAuth.value = true;
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const res = await fetch(`${API_BASE}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${adminKey.value}` },
      });

      if (res.status === 401) {
        clearAdminKey();
        error.value = "Invalid admin key";
        return;
      }

      if (!res.ok) {
        error.value = "Failed to load dashboard";
        return;
      }

      data.value = await res.json();
    } catch {
      error.value = "Network error";
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
    setAdminKey,
    fetchDashboard,
  };
}
