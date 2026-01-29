<script setup lang="ts">
import type { DigestItem } from "../types";

defineProps<{
  item: DigestItem;
  current: number;
  total: number;
}>();

const categoryEmoji: Record<string, string> = {
  ai: "🤖",
  jobs: "💼",
  dev: "⚡",
  news: "📰",
  competitors: "👀",
};

const categoryColor: Record<string, string> = {
  ai: "text-purple-400",
  jobs: "text-green-400",
  dev: "text-blue-400",
  news: "text-orange-400",
  competitors: "text-red-400",
};
</script>

<template>
  <div class="flex h-screen snap-start snap-always flex-col px-6 pt-16 pb-6">
    <div class="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center">
      <!-- Category badge -->
      <span
        :class="[
          'text-xs font-semibold tracking-wide uppercase',
          categoryColor[item.category] || 'text-gray-400',
        ]"
      >
        {{ categoryEmoji[item.category] || "📌" }}
        {{ item.category }}
      </span>

      <!-- Title -->
      <a
        :href="item.sourceUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-2 block text-xl leading-tight font-bold text-white transition-colors hover:text-blue-300"
      >
        {{ item.title }}
      </a>

      <!-- Summary -->
      <p class="mt-3 text-base leading-relaxed text-gray-300">
        {{ item.summary }}
      </p>

      <!-- Why it matters -->
      <p
        v-if="item.whyItMatters"
        class="mt-3 text-sm text-blue-400 italic"
      >
        → {{ item.whyItMatters }}
      </p>
    </div>

    <!-- Footer: source + position -->
    <div class="mx-auto flex w-full max-w-lg items-center justify-between">
      <a
        :href="item.sourceUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm text-gray-500 transition-colors hover:text-gray-300"
      >
        {{ item.sourceName }} ↗
      </a>
      <span class="text-xs text-gray-600">{{ current }} / {{ total }}</span>
    </div>

    <!-- Scroll hint (first card only) -->
    <div
      v-if="current === 1"
      class="mt-3 flex justify-center"
    >
      <div class="animate-bounce text-gray-600">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  </div>
</template>
