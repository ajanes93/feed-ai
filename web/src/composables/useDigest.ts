import { ref, computed } from "vue";
import type { Digest } from "../types";
import { todayDate } from "@feed-ai/shared/utils";

export function useDigest() {
  const digest = ref<Digest | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const availableDates = ref<string[]>([]);
  const currentDateIndex = ref(0);
  // True when viewing today with no digest (empty state after swipe forward)
  const viewingToday = ref(false);

  async function fetchDigestList() {
    try {
      const res = await fetch(`/api/digests`);
      if (!res.ok) return;
      const list: Array<{ date: string }> = await res.json();
      availableDates.value = list.map((d) => d.date);
    } catch {
      // silently fail, navigation just won't work
    }
  }

  async function fetchDigest(
    url: string,
    notFoundMessage?: string,
    keepCurrent = false
  ) {
    if (!keepCurrent) {
      digest.value = null;
    }
    loading.value = true;
    error.value = null;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        error.value =
          res.status === 404 && notFoundMessage
            ? notFoundMessage
            : "Failed to load digest";
        digest.value = null;
        return;
      }
      digest.value = await res.json();
      if (digest.value) {
        const idx = availableDates.value.indexOf(digest.value.date);
        if (idx >= 0) currentDateIndex.value = idx;
      }
    } catch (e) {
      error.value = "Failed to load digest";
      digest.value = null;
      console.error(e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchToday() {
    await fetchDigestList();
    const today = todayDate();
    if (availableDates.value.includes(today)) {
      viewingToday.value = false;
      await fetchDigest(`/api/digest/${today}`);
    } else {
      showTodayEmpty();
    }
  }

  async function fetchDate(date: string, keepCurrent = false) {
    if (availableDates.value.length === 0) await fetchDigestList();
    viewingToday.value = false;
    await fetchDigest(`/api/digest/${date}`, undefined, keepCurrent);
  }

  function showTodayEmpty() {
    viewingToday.value = true;
    digest.value = null;
    loading.value = false;
    error.value = "No digest yet today. Check back at 5pm!";
    currentDateIndex.value = 0;
  }

  async function goToPrevious() {
    if (viewingToday.value) {
      if (availableDates.value.length === 0) return false;
      currentDateIndex.value = 0;
      await fetchDate(availableDates.value[0], true);
      return true;
    }
    const nextIdx = currentDateIndex.value + 1;
    if (nextIdx >= availableDates.value.length) return false;
    currentDateIndex.value = nextIdx;
    await fetchDate(availableDates.value[nextIdx], true);
    return true;
  }

  async function goToNext() {
    if (viewingToday.value) return false;

    const isNewestDigest = currentDateIndex.value === 0;
    const todayHasNoDigest = !availableDates.value.includes(todayDate());

    if (isNewestDigest && todayHasNoDigest) {
      showTodayEmpty();
      return true;
    }

    const nextIdx = currentDateIndex.value - 1;
    if (nextIdx < 0) return false;
    currentDateIndex.value = nextIdx;
    await fetchDate(availableDates.value[nextIdx], true);
    return true;
  }

  const hasPrevious = computed(() => {
    if (viewingToday.value) return availableDates.value.length > 0;
    return currentDateIndex.value < availableDates.value.length - 1;
  });

  const hasNext = computed(() => {
    if (viewingToday.value) return false;
    const isNewestDigest = currentDateIndex.value === 0;
    const todayHasNoDigest = !availableDates.value.includes(todayDate());
    return isNewestDigest ? todayHasNoDigest : currentDateIndex.value > 0;
  });

  const formattedDate = computed(() => {
    const date = digest.value
      ? new Date(digest.value.date + "T12:00:00")
      : new Date();
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
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
