import { computed } from "vue";
import { useSessionStorage } from "@vueuse/core";

const LIMIT = 5;
const WINDOW_MS = 86400000; // 24 hours

const timestamps = useSessionStorage<number[]>("feed-ai-rate-timestamps", []);

export function useRateLimit() {
  function prune() {
    const cutoff = Date.now() - WINDOW_MS;
    timestamps.value = timestamps.value.filter((t) => t > cutoff);
  }

  function check(): { ok: boolean; waitSeconds: number } {
    prune();
    if (timestamps.value.length >= LIMIT) {
      const oldest = timestamps.value[0];
      const waitMs = oldest + WINDOW_MS - Date.now();
      return { ok: false, waitSeconds: Math.ceil(waitMs / 1000) };
    }
    return { ok: true, waitSeconds: 0 };
  }

  function record() {
    prune();
    timestamps.value.push(Date.now());
  }

  const remaining = computed(() => {
    const cutoff = Date.now() - WINDOW_MS;
    const valid = timestamps.value.filter((t) => t > cutoff);
    return Math.max(0, LIMIT - valid.length);
  });

  return { check, record, remaining };
}
