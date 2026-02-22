<script setup lang="ts">
import { onMounted, computed, nextTick, ref } from "vue";
import { useHead } from "@unhead/vue";
import { useRouter } from "vue-router";
import { useAiChat, type PromptKey } from "../composables/useAiChat";
import { renderMarkdown } from "../utils/markdown";
import { Button } from "@feed-ai/shared/components/ui/button";
import { Card, CardContent } from "@feed-ai/shared/components/ui/card";
import { ArrowLeft, Sparkles, X } from "lucide-vue-next";

const router = useRouter();

useHead({ title: "AI Assistant — feed-ai" });

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

const prompts = [
  {
    key: "daily" as PromptKey,
    emoji: "☀️",
    label: "Today's briefing",
    description: "Key stories today",
  },
  {
    key: "weekly" as PromptKey,
    emoji: "📅",
    label: "This week",
    description: "Weekly highlights",
  },
  {
    key: "monthly" as PromptKey,
    emoji: "📊",
    label: "Monthly recap",
    description: "Month in review",
  },
  {
    key: "top_ai" as PromptKey,
    emoji: "🤖",
    label: "Top AI news",
    description: "AI developments",
  },
  {
    key: "dev_updates" as PromptKey,
    emoji: "⚡",
    label: "Dev updates",
    description: "Tools & frameworks",
  },
  {
    key: "lincoln" as PromptKey,
    emoji: "⚽",
    label: "Lincoln City",
    description: "Imps news",
  },
];

const availableChips = computed(() =>
  prompts.filter((p) => !usedPrompts.value.has(p.key))
);

const hasMessages = computed(() => messages.value.length > 0);

async function handleQuery(key: PromptKey, label: string) {
  if (loading.value || remaining.value <= 0) return;
  await query(key, label);
  await nextTick();
  scrollContainer.value?.scrollTo({
    top: scrollContainer.value.scrollHeight,
    behavior: "smooth",
  });
}

onMounted(() => {
  fetchRemaining();
});
</script>

<template>
  <div class="bg-background flex h-[100dvh] flex-col">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 py-3">
      <Button
        variant="ghost"
        size="sm"
        class="text-muted-foreground hover:text-foreground gap-1"
        @click="router.back()"
      >
        <ArrowLeft class="h-4 w-4" />
        Feed
      </Button>

      <div class="flex items-center gap-1.5">
        <Sparkles class="h-4 w-4 text-blue-400" />
        <span class="text-foreground text-sm font-medium">AI Assistant</span>
      </div>

      <div class="flex items-center gap-2">
        <Button
          v-if="hasMessages"
          variant="ghost"
          size="icon"
          class="text-muted-foreground hover:text-foreground h-8 w-8"
          title="New conversation"
          @click="reset"
        >
          <X class="h-4 w-4" />
        </Button>
        <span
          class="text-muted-foreground min-w-[2rem] text-right text-xs tabular-nums"
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
          <Sparkles class="h-8 w-8 text-blue-400" />
        </div>

        <h1 class="text-foreground text-xl font-semibold">
          What do you want to know?
        </h1>
        <p class="text-muted-foreground mt-1 text-sm">
          AI-powered summaries of your feed.
        </p>

        <!-- Prompt grid -->
        <div class="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
          <button
            v-for="(chip, i) in prompts"
            :key="chip.key"
            :disabled="loading || remaining <= 0"
            class="border-border/50 bg-card/50 hover:border-border hover:bg-card flex flex-col items-start rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40"
            :style="{ animationDelay: `${60 + i * 50}ms` }"
            @click="handleQuery(chip.key, chip.label)"
          >
            <span class="text-lg">{{ chip.emoji }}</span>
            <span class="text-foreground mt-1.5 text-sm font-medium">{{
              chip.label
            }}</span>
            <span class="text-muted-foreground text-xs">{{
              chip.description
            }}</span>
          </button>
        </div>

        <!-- Error message -->
        <p
          v-if="error"
          class="text-destructive mt-6 text-sm"
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
          <Card
            v-else
            class="border-border/50 bg-card/50 mb-4 py-0"
          >
            <CardContent class="p-4">
              <!-- eslint-disable-next-line vue/no-v-html -- sanitized by DOMPurify -->
              <div
                class="ai-prose text-muted-foreground text-sm leading-relaxed"
                v-html="renderMarkdown(msg.text)"
              />
            </CardContent>
          </Card>
        </template>

        <!-- Loading indicator -->
        <Card
          v-if="loading"
          class="border-border/50 bg-card/50 mb-4 py-0"
        >
          <CardContent class="flex gap-1.5 p-4">
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
          </CardContent>
        </Card>

        <!-- Error message -->
        <p
          v-if="error"
          class="text-destructive mb-4 text-sm"
        >
          {{ error }}
        </p>
      </div>
    </div>

    <!-- Footer chips (after first query) -->
    <div
      v-if="hasMessages && availableChips.length > 0"
      class="border-border border-t px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <p class="text-muted-foreground mb-2 text-xs">Ask something else</p>
      <div class="flex gap-2 overflow-x-auto">
        <Button
          v-for="chip in availableChips"
          :key="chip.key"
          variant="outline"
          size="sm"
          class="border-border/50 bg-card/50 text-foreground hover:bg-card shrink-0 gap-1.5"
          :disabled="loading || remaining <= 0"
          @click="handleQuery(chip.key, chip.label)"
        >
          <span>{{ chip.emoji }}</span>
          {{ chip.label }}
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-prose :deep(h1),
.ai-prose :deep(h2),
.ai-prose :deep(h3) {
  color: var(--color-foreground);
}

.ai-prose :deep(strong) {
  color: var(--color-foreground);
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
