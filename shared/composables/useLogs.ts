import { ref, computed } from "vue";

export interface LogEntry {
  id: string;
  level: string;
  category: string;
  message: string;
  details: Record<string, unknown> | null;
  createdAt: number | string;
}

export function useLogs(getAdminKey: () => string, getBaseUrl?: () => string) {
  const logs = ref<LogEntry[]>([]);
  const loading = ref(false);
  const levelFilter = ref<string | null>(null);
  const categoryFilter = ref<string | null>(null);

  const categories = computed(() => {
    const set = new Set(logs.value.map((l) => l.category));
    return [...set].sort();
  });

  async function fetchLogs() {
    const key = getAdminKey();
    if (!key) return;

    loading.value = true;
    try {
      const params = new URLSearchParams();
      if (levelFilter.value) params.set("level", levelFilter.value);
      if (categoryFilter.value) params.set("category", categoryFilter.value);
      params.set("limit", "100");

      const base = getBaseUrl?.() ?? "";
      const res = await fetch(
        `${base}/api/admin/logs?${params.toString()}`,
        { headers: { Authorization: `Bearer ${key}` } },
      );

      if (!res.ok) return;

      const body = await res.json();
      // Normalize: web worker returns { logs: [] }, OQ worker returns []
      logs.value = Array.isArray(body) ? body : (body.logs ?? []);
    } finally {
      loading.value = false;
    }
  }

  function setLevel(level: string | null) {
    levelFilter.value = level;
    fetchLogs();
  }

  function setCategory(category: string | null) {
    categoryFilter.value = category;
    fetchLogs();
  }

  return {
    logs,
    loading,
    levelFilter,
    categoryFilter,
    categories,
    fetchLogs,
    setLevel,
    setCategory,
  };
}
