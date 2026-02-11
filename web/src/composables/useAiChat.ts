import { ref, computed } from "vue";
import { useDeviceFingerprint } from "./useDeviceFingerprint";
import { useRateLimit } from "./useRateLimit";

export type PromptKey =
  | "daily"
  | "weekly"
  | "monthly"
  | "top_ai"
  | "dev_updates"
  | "lincoln";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  promptKey?: PromptKey;
}

export function useAiChat() {
  const messages = ref<ChatMessage[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const serverRemaining = ref<number | null>(null);

  const { fingerprint } = useDeviceFingerprint();
  const { check, record, remaining: clientRemaining } = useRateLimit();

  const remaining = computed(() =>
    serverRemaining.value !== null
      ? serverRemaining.value
      : clientRemaining.value
  );

  async function fetchRemaining() {
    if (!fingerprint.value) return;
    try {
      const res = await fetch("/api/ai/remaining", {
        headers: { "X-Device-Fingerprint": fingerprint.value },
      });
      if (res.ok) {
        const data: { remaining: number } = await res.json();
        serverRemaining.value = data.remaining;
      }
    } catch {
      // Silently fail — client-side fallback
    }
  }

  async function query(key: PromptKey, label: string) {
    if (loading.value) return;
    if (!fingerprint.value) {
      error.value = "Initializing…";
      return;
    }

    const rateCheck = check();
    if (!rateCheck.ok) {
      error.value = `Rate limit reached. Try again in ${Math.ceil(rateCheck.waitSeconds / 60)} minutes.`;
      return;
    }

    error.value = null;
    loading.value = true;

    messages.value.push({
      id: crypto.randomUUID(),
      role: "user",
      text: label,
      promptKey: key,
    });

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Fingerprint": fingerprint.value,
        },
        body: JSON.stringify({ prompt: key }),
      });

      const data: { text?: string; error?: string; remaining?: number } =
        await res.json();

      if (!res.ok) {
        error.value = data.error ?? "Something went wrong.";
        messages.value.pop();
        return;
      }

      record();
      if (typeof data.remaining === "number") {
        serverRemaining.value = data.remaining;
      }

      messages.value.push({
        id: crypto.randomUUID(),
        role: "assistant",
        text: data.text ?? "",
      });
    } catch {
      error.value = "Network error. Please try again.";
      messages.value.pop();
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    messages.value = [];
    error.value = null;
  }

  const usedPrompts = computed(() => {
    const used = new Set<PromptKey>();
    for (const msg of messages.value) {
      if (msg.promptKey) used.add(msg.promptKey);
    }
    return used;
  });

  return {
    messages,
    loading,
    error,
    remaining,
    query,
    reset,
    fetchRemaining,
    usedPrompts,
  };
}
