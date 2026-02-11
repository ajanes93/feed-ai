<script setup lang="ts">
import { onMounted, computed, nextTick, ref } from "vue";
import { useRouter } from "vue-router";
import { useAiChat, type PromptKey } from "../composables/useAiChat";
import { renderMarkdown } from "../utils/markdown";

const router = useRouter();
const {
  messages,
  loading,
  error,
  remaining,
  query,
  reset,
  fetchRemaining,
  usedPrompts,
} = useAiChat();

const scrollContainer = ref<HTMLElement | null>(null);

interface PromptChip {
  key: PromptKey;
  emoji: string;
  label: string;
  description: string;
}

const prompts: PromptChip[] = [
  {
    key: "daily",
    emoji: "☀️",
    label: "Today's briefing",
    description: "Key stories today",
  },
  {
    key: "weekly",
    emoji: "📅",
    label: "This week",
    description: "Weekly highlights",
  },
  {
    key: "monthly",
    emoji: "📊",
    label: "Monthly recap",
    description: "Month in review",
  },
  {
    key: "top_ai",
    emoji: "🤖",
    label: "Top AI news",
    description: "AI developments",
  },
  {
    key: "dev_updates",
    emoji: "⚡",
    label: "Dev updates",
    description: "Tools & frameworks",
  },
  {
    key: "lincoln",
    emoji: "⚽",
    label: "Lincoln City",
    description: "Imps news",
  },
];

const availableChips = computed(() =>
  prompts.filter((p) => !usedPrompts.value.has(p.key))
);

const hasMessages = computed(() => messages.value.length > 0);

async function handleQuery(key: PromptKey) {
  if (loading.value || remaining.value <= 0) return;
  await query(key);
  await nextTick();
  scrollContainer.value?.scrollTo({
    top: scrollContainer.value.scrollHeight,
    behavior: "smooth",
  });
}

function handleReset() {
  reset();
}

function goBack() {
  router.back();
}

onMounted(() => {
  fetchRemaining();
});
</script>

<template>
  <div class="flex h-[100dvh] flex-col bg-[#0f1923]">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 py-3">
      <button
        class="flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-white"
        @click="goBack"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Feed
      </button>

      <div class="flex items-center gap-1.5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 text-blue-400"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M12 2l2.09 6.26L20.18 9l-5.09 3.74L17.18 19 12 15.27 6.82 19l2.09-6.26L3.82 9l6.09-.74z"
          />
        </svg>
        <span class="text-sm font-medium text-white">AI Assistant</span>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="hasMessages"
          class="text-gray-500 transition-colors hover:text-white"
          title="New conversation"
          @click="handleReset"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <span
          class="min-w-[2rem] text-right text-xs text-gray-500 tabular-nums"
        >
          {{ remaining }}/5
        </span>
      </div>
    </header>

    <!-- Content area -->
    <div
      ref="scrollContainer"
      class="flex-1 overflow-y-scroll"
    >
      <!-- Welcome state -->
      <div
        v-if="!hasMessages"
        class="flex flex-col items-center px-6 pt-16"
      >
        <div
          class="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-8 w-8 text-blue-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M12 2l2.09 6.26L20.18 9l-5.09 3.74L17.18 19 12 15.27 6.82 19l2.09-6.26L3.82 9l6.09-.74z"
            />
          </svg>
        </div>

        <h1 class="text-xl font-semibold text-white">
          What do you want to know?
        </h1>
        <p class="mt-1 text-sm text-[#8b95a3]">
          AI-powered summaries of your feed.
        </p>

        <!-- Prompt grid -->
        <div class="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
          <button
            v-for="(chip, i) in prompts"
            :key="chip.key"
            :disabled="loading || remaining <= 0"
            class="flex flex-col items-start rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-white/[0.15] hover:bg-white/[0.04] disabled:pointer-events-none disabled:opacity-40"
            :style="{ animationDelay: `${60 + i * 50}ms` }"
            @click="handleQuery(chip.key)"
          >
            <span class="text-lg">{{ chip.emoji }}</span>
            <span class="mt-1.5 text-sm font-medium text-[#e2e8f0]">{{
              chip.label
            }}</span>
            <span class="text-xs text-[#8b95a3]">{{ chip.description }}</span>
          </button>
        </div>

        <!-- Error message -->
        <p
          v-if="error"
          class="mt-6 text-sm text-red-400"
        >
          {{ error }}
        </p>
      </div>

      <!-- Messages -->
      <div
        v-else
        class="mx-auto max-w-[640px] px-4 pb-4"
      >
        <template
          v-for="msg in messages"
          :key="msg.id"
        >
          <!-- User pill -->
          <div
            v-if="msg.role === 'user'"
            class="mb-3 flex justify-end"
          >
            <span
              class="rounded-[20px] bg-blue-500/15 px-4 py-2 text-sm font-medium text-blue-300"
            >
              {{ msg.text }}
            </span>
          </div>

          <!-- Assistant card -->
          <div
            v-else
            class="mb-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
          >
            <div
              class="ai-prose text-sm leading-relaxed text-[#c9d1dc]"
              v-html="renderMarkdown(msg.text)"
            />
          </div>
        </template>

        <!-- Loading indicator -->
        <div
          v-if="loading"
          class="mb-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
        >
          <div class="flex gap-1.5">
            <div
              class="h-2 w-2 animate-bounce rounded-full bg-blue-400/60"
              style="animation-delay: 0s"
            />
            <div
              class="h-2 w-2 animate-bounce rounded-full bg-blue-400/60"
              style="animation-delay: 0.15s"
            />
            <div
              class="h-2 w-2 animate-bounce rounded-full bg-blue-400/60"
              style="animation-delay: 0.3s"
            />
          </div>
        </div>

        <!-- Error message -->
        <p
          v-if="error"
          class="mb-4 text-sm text-red-400"
        >
          {{ error }}
        </p>
      </div>
    </div>

    <!-- Footer chips (after first query) -->
    <div
      v-if="hasMessages && availableChips.length > 0"
      class="border-t border-white/[0.07] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <p class="mb-2 text-xs text-[#8b95a3]">Ask something else</p>
      <div class="flex gap-2 overflow-x-auto">
        <button
          v-for="chip in availableChips"
          :key="chip.key"
          :disabled="loading || remaining <= 0"
          class="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-xs text-[#e2e8f0] transition-all hover:border-white/[0.15] hover:bg-white/[0.04] disabled:pointer-events-none disabled:opacity-40"
          @click="handleQuery(chip.key)"
        >
          <span>{{ chip.emoji }}</span>
          {{ chip.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-prose :deep(h1),
.ai-prose :deep(h2),
.ai-prose :deep(h3) {
  color: #e2e8f0;
}

.ai-prose :deep(strong) {
  color: #e2e8f0;
  font-weight: 500;
}

.ai-prose :deep(ul) {
  margin: 0.5rem 0;
  padding-left: 1rem;
}

.ai-prose :deep(li) {
  margin: 0.25rem 0;
}

.ai-prose :deep(a) {
  color: #60a5fa;
  text-decoration: underline;
}

.ai-prose :deep(p) {
  margin: 0.5rem 0;
}
</style>
