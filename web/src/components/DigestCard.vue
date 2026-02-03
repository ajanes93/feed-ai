<script setup lang="ts">
import { ref, computed, useTemplateRef } from "vue";
import { onLongPress } from "@vueuse/core";
import { AnimatePresence, motion } from "motion-v";
import type { DigestItem } from "../types";

const props = defineProps<{
  item: DigestItem;
}>();

const showActions = ref(false);
const cardRef = useTemplateRef("card");

onLongPress(
  cardRef,
  () => {
    showActions.value = true;
  },
  { delay: 500 }
);

async function shareItem() {
  showActions.value = false;
  try {
    if (navigator.share) {
      await navigator.share({
        title: props.item.title,
        url: props.item.sourceUrl,
      });
    } else {
      await navigator.clipboard.writeText(props.item.sourceUrl);
    }
  } catch {
    // User cancelled share dialog or clipboard permission denied
  }
}

function openLink() {
  showActions.value = false;
  window.open(props.item.sourceUrl, "_blank", "noopener,noreferrer");
}

const categoryStyle: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  ai: { label: "AI", bg: "bg-purple-500/15", text: "text-purple-400" },
  dev: { label: "Dev", bg: "bg-blue-500/15", text: "text-blue-400" },
  jobs: { label: "Jobs", bg: "bg-emerald-500/15", text: "text-emerald-400" },
  sport: { label: "Sport", bg: "bg-orange-500/15", text: "text-orange-400" },
};

const fallbackStyle = {
  label: "Other",
  bg: "bg-gray-500/15",
  text: "text-gray-400",
};

const style = computed(
  () => categoryStyle[props.item.category] || fallbackStyle
);

const faviconUrl = computed(() => {
  try {
    const domain = new URL(props.item.sourceUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Recently";

  const hoursAgo = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60));

  if (hoursAgo < 1) return "Just now";
  if (hoursAgo < 24) return `${hoursAgo}h ago`;
  if (hoursAgo < 48) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
</script>

<template>
  <motion.article
    ref="card"
    class="relative rounded-xl border border-gray-800/50 bg-gray-900/60 p-5 transition-colors select-none hover:border-gray-700/50"
    :press="{ scale: 0.98 }"
    :transition="{ type: 'spring', duration: 0.2, bounce: 0.1 }"
    @contextmenu.prevent
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
        class="text-xs text-gray-500"
      >
        {{ formatDate(item.publishedAt) }}
      </span>
      <span class="ml-auto flex items-center gap-1.5 text-xs text-gray-500">
        <img
          v-if="faviconUrl"
          :src="faviconUrl"
          alt=""
          class="h-4 w-4 rounded-sm"
          loading="lazy"
        />
        {{ item.sourceName }}
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
        class="text-lg leading-snug font-semibold tracking-tight text-white transition-colors group-hover:text-blue-400"
      >
        {{ item.title }}
      </h2>
    </a>

    <!-- Summary -->
    <p class="mt-2 text-sm leading-relaxed text-gray-300">
      {{ item.summary }}
    </p>

    <!-- Why it matters -->
    <div
      v-if="item.whyItMatters"
      class="mt-3 rounded-lg border border-gray-800/40 bg-gray-800/20 px-3.5 py-2.5"
    >
      <p class="text-xs leading-relaxed text-gray-400">
        <span class="font-medium text-gray-300">Why it matters</span>
        &mdash; {{ item.whyItMatters }}
      </p>
    </div>
    <!-- Long-press actions popover -->
    <Teleport to="body">
      <AnimatePresence>
        <motion.div
          v-if="showActions"
          key="modal-backdrop"
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :exit="{ opacity: 0 }"
          :transition="{ duration: 0.2 }"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          @click="showActions = false"
        >
          <motion.div
            key="modal-content"
            :initial="{ opacity: 0, scale: 0.9, y: 10 }"
            :animate="{ opacity: 1, scale: 1, y: 0 }"
            :exit="{ opacity: 0, scale: 0.95, y: 5 }"
            :transition="{ type: 'spring', duration: 0.25, bounce: 0.15 }"
            class="mx-6 w-full max-w-xs rounded-2xl border border-gray-700 bg-gray-900/95 p-1 shadow-2xl backdrop-blur-xl"
            @click.stop
          >
            <p class="truncate px-4 py-2 text-sm text-gray-400">
              {{ item.title }}
            </p>
            <button
              class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-white hover:bg-gray-800"
              @click="shareItem"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              Share
            </button>
            <button
              class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-white hover:bg-gray-800"
              @click="openLink"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              Open original
            </button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </Teleport>
  </motion.article>
</template>
