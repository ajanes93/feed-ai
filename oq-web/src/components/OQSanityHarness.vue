<script setup lang="ts">
import { computed } from "vue";
import { ExternalLink } from "lucide-vue-next";
import OQExplainer from "./OQExplainer.vue";

const props = defineProps<{
  topPassRate: number;
  topAgent: string;
  topModel: string;
  medianPassRate: number;
  languageBreakdown: string;
  note?: string;
  lastUpdated?: string;
  topPassRateDelta?: number;
  medianPassRateDelta?: number;
  previousDate?: string;
}>();

function formatDelta(delta: number | undefined): string {
  if (delta === undefined || delta === 0) return "";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}%`;
}

function deltaColor(delta: number | undefined): string {
  if (delta === undefined || delta === 0) return "";
  return delta > 0 ? "text-emerald-400" : "text-red-400";
}

function formatUpdatedDate(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

const langs = computed(() =>
  props.languageBreakdown
    .split(",")
    .map((s) => {
      const m = s.trim().match(/^(\w+):\s*([\d.]+)%?$/);
      return m ? { lang: m[1], pct: parseFloat(m[2]) } : null;
    })
    .filter((x): x is { lang: string; pct: number } => x !== null)
    .sort((a, b) => b.pct - a.pct)
);

function langColor(pct: number) {
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 50) return "text-yellow-400";
  return "text-red-400";
}

function langBg(pct: number) {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-yellow-500";
  return "bg-red-500";
}
</script>

<template>
  <div class="rounded-2xl border border-border bg-card p-6 sm:p-8">
    <div
      class="mb-4 flex items-center gap-1.5 text-[10px] tracking-widest text-muted-foreground uppercase"
    >
      AI Agent Reality Check
      <OQExplainer
        text="Independent benchmark testing AI coding agents across multiple languages. Created by Can Boluk."
      />
    </div>

    <!-- Top vs Median -->
    <div class="flex items-center justify-center gap-8 sm:gap-12">
      <div class="text-center">
        <div
          class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
        >
          {{ topPassRate }}<span class="text-lg text-muted-foreground">%</span>
          <span
            v-if="topPassRateDelta !== undefined && topPassRateDelta !== 0"
            class="ml-1 text-sm font-normal"
            :class="deltaColor(topPassRateDelta)"
          >
            {{ formatDelta(topPassRateDelta) }}
          </span>
        </div>
        <div
          class="mt-1 text-[10px] tracking-widest text-muted-foreground uppercase"
        >
          Top Agent
        </div>
        <div class="mt-0.5 text-[9px] text-muted-foreground/50">
          {{ topAgent }} + {{ topModel }}
        </div>
      </div>

      <div class="text-center">
        <div
          class="text-3xl font-semibold tracking-tight text-orange-500 sm:text-4xl"
        >
          ~{{ medianPassRate }}<span class="text-lg text-orange-500/50">%</span>
          <span
            v-if="
              medianPassRateDelta !== undefined && medianPassRateDelta !== 0
            "
            class="ml-1 text-sm font-normal"
            :class="deltaColor(medianPassRateDelta)"
          >
            {{ formatDelta(medianPassRateDelta) }}
          </span>
        </div>
        <div
          class="mt-1 text-[10px] tracking-widest text-muted-foreground uppercase"
        >
          Median Agent
        </div>
        <div class="mt-0.5 text-[9px] text-muted-foreground/50">
          Across all agents
        </div>
      </div>
    </div>

    <!-- Language spread -->
    <div v-if="languageBreakdown" class="mt-5 border-t border-border pt-4">
      <div
        class="mb-2 text-[10px] tracking-widest text-muted-foreground uppercase"
      >
        Language spread (top agent)
      </div>
      <div class="flex flex-wrap gap-2">
        <div
          v-for="lang in langs"
          :key="lang.lang"
          data-testid="lang-chip"
          class="flex items-center gap-1.5 rounded-lg bg-secondary/50 px-2.5 py-1.5"
        >
          <span class="h-1.5 w-1.5 rounded-full" :class="langBg(lang.pct)" />
          <span class="text-xs font-medium capitalize text-muted-foreground">
            {{ lang.lang }}
          </span>
          <span
            data-testid="lang-pct"
            class="font-mono text-xs"
            :class="langColor(lang.pct)"
          >
            {{ lang.pct }}%
          </span>
        </div>
      </div>
    </div>

    <p
      v-if="note"
      data-testid="sanity-harness-note"
      class="mt-3 rounded-lg bg-orange-500/5 px-3 py-2 text-center text-xs leading-relaxed text-orange-400/80"
    >
      {{ note }}
    </p>

    <div class="mt-4 flex items-baseline justify-between">
      <a
        href="https://sanityboard.lr7.dev"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex shrink-0 items-center gap-0.5 text-[9px] text-muted-foreground/50 transition-colors hover:text-orange-500/60"
      >
        Source: SanityHarness<span v-if="lastUpdated" class="ml-0.5"
          >· Updated {{ formatUpdatedDate(lastUpdated) }}</span
        >
        <ExternalLink class="h-2 w-2" />
      </a>
    </div>
  </div>
</template>
