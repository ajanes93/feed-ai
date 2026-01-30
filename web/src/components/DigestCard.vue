<script setup lang="ts">
import { computed } from "vue";
import type { DigestItem } from "../types";

const props = defineProps<{
  item: DigestItem;
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

const style = computed(() => categoryStyle[props.item.category] || fallbackStyle);

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Recently";
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
  <article
    class="rounded-xl border border-gray-800/50 bg-gray-900/60 p-5 transition-colors hover:border-gray-700/50"
  >
    <!-- Top row: category + time -->
    <div class="mb-3 flex items-center gap-3">
      <span
        :class="[
          'rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase',
          style.bg,
          style.text,
        ]"
      >
        {{ style.label }}
      </span>
      <span
        v-if="item.publishedAt"
        class="text-xs text-gray-600"
      >
        {{ formatDate(item.publishedAt) }}
      </span>
      <span class="ml-auto text-xs text-gray-700">{{ item.sourceName }}</span>
    </div>

    <!-- Title -->
    <a
      :href="item.sourceUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="group block"
    >
      <h2
        class="text-lg leading-snug font-semibold tracking-tight text-white transition-colors group-hover:text-blue-400"
      >
        {{ item.title }}
      </h2>
    </a>

    <!-- Summary -->
    <p class="mt-2 text-sm leading-relaxed text-gray-400">
      {{ item.summary }}
    </p>

    <!-- Why it matters -->
    <div
      v-if="item.whyItMatters"
      class="mt-3 rounded-lg border border-gray-800/40 bg-gray-800/20 px-3.5 py-2.5"
    >
      <p class="text-xs leading-relaxed text-gray-500">
        <span class="font-medium text-gray-400">Why it matters</span>
        &mdash; {{ item.whyItMatters }}
      </p>
    </div>
  </article>
</template>
