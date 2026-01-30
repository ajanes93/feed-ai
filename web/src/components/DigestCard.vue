<script setup lang="ts">
import type { DigestItem } from "../types";

defineProps<{
  item: DigestItem;
  current: number;
  total: number;
}>();

const categoryStyle: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  ai: { label: "AI", bg: "bg-purple-500/15", text: "text-purple-400" },
  jobs: { label: "Jobs", bg: "bg-emerald-500/15", text: "text-emerald-400" },
  dev: { label: "Dev", bg: "bg-blue-500/15", text: "text-blue-400" },
  news: { label: "News", bg: "bg-amber-500/15", text: "text-amber-400" },
  competitors: { label: "Watch", bg: "bg-red-500/15", text: "text-red-400" },
};

const fallbackStyle = {
  label: "Other",
  bg: "bg-gray-500/15",
  text: "text-gray-400",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${diffH}h ago`;
  if (diffH < 48) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
</script>

<template>
  <div class="flex h-screen snap-start snap-always flex-col px-5 pt-14 pb-5">
    <div class="mx-auto flex w-full max-w-lg flex-1 flex-col">
      <!-- Card content area -->
      <div class="flex flex-1 flex-col justify-center">
        <!-- Category pill + time -->
        <div class="mb-4 flex items-center gap-3">
          <span
            :class="[
              'rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase',
              (categoryStyle[item.category] || fallbackStyle).bg,
              (categoryStyle[item.category] || fallbackStyle).text,
            ]"
          >
            {{ (categoryStyle[item.category] || fallbackStyle).label }}
          </span>
          <span
            v-if="item.publishedAt"
            class="text-xs text-gray-600"
          >
            {{ formatDate(item.publishedAt) }}
          </span>
        </div>

        <!-- Title -->
        <a
          :href="item.sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="group block"
        >
          <h2
            class="text-2xl leading-snug font-bold tracking-tight text-white transition-colors group-hover:text-blue-400"
          >
            {{ item.title }}
          </h2>
        </a>

        <!-- Divider -->
        <div class="my-4 h-px w-12 bg-gray-800" />

        <!-- Summary -->
        <p class="text-base leading-relaxed text-gray-300">
          {{ item.summary }}
        </p>

        <!-- Why it matters -->
        <div
          v-if="item.whyItMatters"
          class="mt-4 rounded-lg border border-gray-800/60 bg-gray-900/50 px-4 py-3"
        >
          <p class="text-sm leading-relaxed text-gray-400">
            <span class="font-medium text-gray-300">Why it matters:</span>
            {{ item.whyItMatters }}
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="flex items-center justify-between border-t border-gray-800/40 pt-4"
      >
        <a
          :href="item.sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-gray-500 transition-colors hover:text-white"
        >
          {{ item.sourceName }}
          <span class="text-gray-700">&rarr;</span>
        </a>

        <!-- Progress dots -->
        <div class="flex items-center gap-1">
          <template
            v-for="n in total"
            :key="n"
          >
            <div
              :class="[
                'rounded-full transition-all',
                n === current
                  ? 'h-1.5 w-4 bg-white'
                  : 'h-1.5 w-1.5 bg-gray-800',
              ]"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
