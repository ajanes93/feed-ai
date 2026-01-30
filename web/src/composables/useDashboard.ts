import { ref } from "vue";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

export interface AIUsageEntry {
  id: string;
  digestId: string | null;
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
  const adminKey = ref(localStorage.getItem("adminKey") || "");

  function saveKey(key: string) {
    adminKey.value = key;
    localStorage.setItem("adminKey", key);
  }

  async function fetchDashboard() {
    if (!adminKey.value) {
      error.value = "Admin key required";
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const res = await fetch(`${API_BASE}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${adminKey.value}` },
      });

      if (res.status === 401) {
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

  return { data, loading, error, adminKey, saveKey, fetchDashboard };
}
