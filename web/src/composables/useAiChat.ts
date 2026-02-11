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

const PROMPT_LABELS: Record<PromptKey, string> = {
  daily: "Today's briefing",
  weekly: "This week",
  monthly: "Monthly recap",
  top_ai: "Top AI news",
  dev_updates: "Dev updates",
  lincoln: "Lincoln City",
};

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

  async function query(key: PromptKey) {
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

    // Add user message
    messages.value = [
      ...messages.value,
      {
        id: crypto.randomUUID(),
        role: "user",
        text: PROMPT_LABELS[key],
        promptKey: key,
      },
    ];

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
        // Remove the user message on error
        messages.value = messages.value.slice(0, -1);
        return;
      }

      record();
      if (typeof data.remaining === "number") {
        serverRemaining.value = data.remaining;
      }

      messages.value = [
        ...messages.value,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: data.text ?? "",
        },
      ];
    } catch {
      error.value = "Network error. Please try again.";
      messages.value = messages.value.slice(0, -1);
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    messages.value = [];
    error.value = null;
  }

  // Used prompt keys (for filtering follow-up chips)
  const usedPrompts = computed(
    () =>
      new Set(
        messages.value
          .filter((m) => m.promptKey)
          .map((m) => m.promptKey as PromptKey)
      )
  );

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
