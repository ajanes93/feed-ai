<script setup lang="ts">
import type { DigestItem } from "../types";

defineProps<{
  item: DigestItem;
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
  <div
    class="flex h-screen snap-start snap-always flex-col justify-center px-6 py-12"
  >
    <div class="mx-auto max-w-lg">
      <!-- Category badge -->
      <span
        :class="[
          'text-sm font-medium',
          categoryColor[item.category] || 'text-gray-400',
        ]"
      >
        {{ categoryEmoji[item.category] || "📌" }}
        {{ item.category.toUpperCase() }}
      </span>

      <!-- Title -->
      <h1 class="mt-3 text-2xl leading-tight font-bold text-white">
        {{ item.title }}
      </h1>

      <!-- Summary -->
      <p class="mt-4 text-lg leading-relaxed text-gray-300">
        {{ item.summary }}
      </p>

      <!-- Why it matters -->
      <p
        v-if="item.whyItMatters"
        class="mt-4 text-base text-blue-400 italic"
      >
        → {{ item.whyItMatters }}
      </p>

      <!-- Source link -->
      <a
        :href="item.sourceUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-6 inline-flex items-center gap-2 text-gray-500 transition-colors hover:text-gray-300"
      >
        <span>{{ item.sourceName }}</span>
        <span>↗</span>
      </a>
    </div>
  </div>
</template>
