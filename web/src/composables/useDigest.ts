import { ref, computed } from "vue";
import type { Digest } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

export function useDigest() {
  const digest = ref<Digest | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const availableDates = ref<string[]>([]);
  const currentDateIndex = ref(0);

  async function fetchDigestList() {
    try {
      const res = await fetch(`${API_BASE}/api/digests`);
      if (!res.ok) return;
      const list: Array<{ date: string }> = await res.json();
      availableDates.value = list.map((d) => d.date);
    } catch {
      // silently fail, navigation just won't work
    }
  }

  async function fetchToday() {
    loading.value = true;
    error.value = null;

    try {
      await fetchDigestList();
      const res = await fetch(`${API_BASE}/api/today`);
      if (!res.ok) {
        if (res.status === 404) {
          error.value = "No digest yet today. Check back at 5pm!";
          return;
        }
        throw new Error("Failed to fetch");
      }
      digest.value = await res.json();
      if (digest.value) {
        const idx = availableDates.value.indexOf(digest.value.date);
        if (idx >= 0) currentDateIndex.value = idx;
      }
    } catch (e) {
      error.value = "Failed to load digest";
      console.error(e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchDate(date: string) {
    loading.value = true;
    error.value = null;

    try {
      const res = await fetch(`${API_BASE}/api/digest/${date}`);
      if (!res.ok) throw new Error("Failed to fetch");
      digest.value = await res.json();
    } catch (e) {
      error.value = "Failed to load digest";
      console.error(e);
    } finally {
      loading.value = false;
    }
  }

  async function goToPrevious() {
    const nextIdx = currentDateIndex.value + 1;
    if (nextIdx >= availableDates.value.length) return false;
    currentDateIndex.value = nextIdx;
    await fetchDate(availableDates.value[nextIdx]);
    return true;
  }

  async function goToNext() {
    const nextIdx = currentDateIndex.value - 1;
    if (nextIdx < 0) return false;
    currentDateIndex.value = nextIdx;
    await fetchDate(availableDates.value[nextIdx]);
    return true;
  }

  const hasPrevious = computed(
    () => currentDateIndex.value < availableDates.value.length - 1
  );

  const hasNext = computed(() => currentDateIndex.value > 0);

  const formattedDate = computed(() => {
    if (!digest.value) return "";
    return new Date(digest.value.date + "T12:00:00").toLocaleDateString(
      "en-US",
      {
        weekday: "long",
        month: "long",
        day: "numeric",
      }
    );
  });

  return {
    digest,
    loading,
    error,
    formattedDate,
    hasPrevious,
    hasNext,
    fetchToday,
    fetchDate,
    goToPrevious,
    goToNext,
  };
}
