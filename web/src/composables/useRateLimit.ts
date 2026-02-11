import { computed } from "vue";
import { useSessionStorage } from "@vueuse/core";

const LIMIT = 5;
const WINDOW_MS = 86400000; // 24 hours

function pruned(timestamps: number[]): number[] {
  const cutoff = Date.now() - WINDOW_MS;
  return timestamps.filter((t) => t > cutoff);
}

const timestamps = useSessionStorage<number[]>("feed-ai-rate-timestamps", []);

export function useRateLimit() {
  function check(): { ok: boolean; waitSeconds: number } {
    timestamps.value = pruned(timestamps.value);
    if (timestamps.value.length >= LIMIT) {
      const oldest = timestamps.value[0];
      const waitMs = oldest + WINDOW_MS - Date.now();
      return { ok: false, waitSeconds: Math.ceil(waitMs / 1000) };
    }
    return { ok: true, waitSeconds: 0 };
  }

  function record() {
    timestamps.value = [...pruned(timestamps.value), Date.now()];
  }

  const remaining = computed(() => {
    return Math.max(0, LIMIT - pruned(timestamps.value).length);
  });

  return { check, record, remaining };
}
