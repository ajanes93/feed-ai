<script setup lang="ts">
import { ref, computed, useTemplateRef } from "vue";
import { onLongPress } from "@vueuse/core";
import { AnimatePresence, motion } from "motion-v";
import type { DigestItem } from "../types";
import { Badge } from "@feed-ai/shared/components/ui/badge";

const props = defineProps<{
  item: DigestItem;
}>();

const showActions = ref(false);
const showComments = ref(false);
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

const categoryVariant: Record<string, string> = {
  ai: "bg-purple-500/15 text-purple-400",
  dev: "bg-blue-500/15 text-blue-400",
  jobs: "bg-emerald-500/15 text-emerald-400",
  sport: "bg-orange-500/15 text-orange-400",
};

const categoryLabel: Record<string, string> = {
  ai: "AI",
  dev: "Dev",
  jobs: "Jobs",
  sport: "Sport",
  misc: "Other",
};

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
    class="border-border/50 bg-card/60 hover:border-border relative rounded-xl border p-5 transition-colors select-none"
    :press="{ scale: 0.98 }"
    :transition="{ type: 'spring', duration: 0.2, bounce: 0.1 }"
    @contextmenu.prevent
  >
    <!-- Top row: category + time -->
    <div class="mb-3 flex items-center gap-3">
      <Badge
        variant="outline"
        :class="[
          'border-transparent text-[11px] font-semibold tracking-wider uppercase',
          categoryVariant[item.category] ||
            'bg-secondary text-secondary-foreground',
        ]"
      >
        {{ categoryLabel[item.category] || item.category }}
      </Badge>
      <span
        v-if="item.publishedAt"
        class="text-muted-foreground text-xs"
      >
        {{ formatDate(item.publishedAt) }}
      </span>
      <span
        class="text-muted-foreground ml-auto flex items-center gap-1.5 text-xs"
      >
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
        class="text-foreground text-lg leading-snug font-semibold tracking-tight transition-colors group-hover:text-blue-400"
      >
        {{ item.title }}
      </h2>
    </a>

    <!-- Summary -->
    <p class="text-muted-foreground mt-2 text-sm leading-relaxed">
      {{ item.summary }}
    </p>

    <!-- Why it matters -->
    <div
      v-if="item.whyItMatters"
      class="border-border/40 bg-accent/20 mt-3 rounded-lg border px-3.5 py-2.5"
    >
      <p class="text-muted-foreground text-xs leading-relaxed">
        <span class="text-foreground/80 font-medium">Why it matters</span>
        &mdash; {{ item.whyItMatters }}
      </p>
    </div>
    <!-- Comments / Discussion section -->
    <div
      v-if="item.commentsUrl || item.commentSummary"
      class="mt-3"
    >
      <div class="text-muted-foreground flex items-center gap-2 text-xs">
        <!-- Comment count expand/collapse button -->
        <button
          v-if="item.commentSummary"
          class="hover:text-foreground/80 flex items-center gap-2 transition-colors"
          @click.stop="showComments = !showComments"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span>
            {{ item.commentCount }} comments
            <template v-if="item.commentScore">
              &middot; {{ item.commentScore }} points
            </template>
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3 w-3 transition-transform"
            :class="{ 'rotate-180': showComments }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        <!-- Discussion link (always visible when commentsUrl exists) -->
        <a
          v-if="item.commentsUrl"
          :href="item.commentsUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-1.5 transition-colors hover:text-orange-400"
          :class="{ 'ml-auto': item.commentSummary }"
        >
          <svg
            v-if="!item.commentSummary"
            xmlns="http://www.w3.org/2000/svg"
            class="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span>View discussion</span>
        </a>
      </div>
      <!-- Expanded comment summary -->
      <div
        v-if="item.commentSummary && showComments"
        class="mt-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3.5 py-2.5"
      >
        <p class="text-muted-foreground text-xs leading-relaxed">
          <span class="font-medium text-indigo-400">Discussion</span>
          &mdash; {{ item.commentSummary }}
        </p>
        <p
          v-if="item.commentSummarySource === 'generated'"
          class="text-muted-foreground/50 mt-1 text-[10px]"
        >
          AI-generated summary
        </p>
      </div>
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
            class="border-border bg-popover/95 mx-6 w-full max-w-xs rounded-2xl border p-1 shadow-2xl backdrop-blur-xl"
            @click.stop
          >
            <p class="text-muted-foreground truncate px-4 py-2 text-sm">
              {{ item.title }}
            </p>
            <button
              class="text-foreground hover:bg-accent flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm"
              @click="shareItem"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="text-muted-foreground h-4 w-4"
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
              class="text-foreground hover:bg-accent flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm"
              @click="openLink"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="text-muted-foreground h-4 w-4"
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
