<script setup lang="ts">
import { ref } from "vue";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@feed-ai/shared/components/ui/collapsible";
import { ExternalLink, ChevronDown } from "lucide-vue-next";
import OQExplainer from "./OQExplainer.vue";

defineProps<{
  softwareIndex?: number;
  softwareDate?: string;
  softwareTrend?: { change1w?: number; change4w?: number };
  note?: string;
}>();

const isOpen = ref(false);
</script>

<template>
  <div class="rounded-2xl border border-border bg-card p-6 sm:p-8">
    <div
      class="mb-4 text-[10px] tracking-widest text-muted-foreground uppercase"
    >
      The Economic Reality
    </div>

    <!-- Indeed Software Index — single dynamic stat -->
    <div class="text-center">
      <div
        class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
      >
        ~{{ softwareIndex ?? 70 }}
      </div>
      <div
        class="mt-1 flex items-center justify-center gap-1 text-[10px] leading-tight text-muted-foreground uppercase"
      >
        Indeed Software Index
        <OQExplainer
          text="Job postings for software engineers vs a Feb 2020 baseline (100). ~70 = 30% below baseline. Compared against general postings to isolate software-specific trends."
        />
      </div>
      <div class="mt-0.5 text-[9px] text-muted-foreground/50">
        vs 100 baseline
      </div>
      <a
        href="https://fred.stlouisfed.org/series/IHLIDXUSTPSOFTDEVE"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-0.5 inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/50 transition-colors hover:text-orange-500/60"
      >
        FRED<span v-if="softwareDate" class="ml-0.5"
          >· Updated {{ softwareDate }}</span
        >
        <ExternalLink class="h-2 w-2" />
      </a>
      <div
        v-if="softwareTrend?.change4w !== undefined"
        data-testid="software-trend"
        class="mt-1 font-mono text-[10px]"
        :class="
          (softwareTrend?.change4w ?? 0) < 0
            ? 'text-red-400'
            : 'text-emerald-400'
        "
      >
        {{ (softwareTrend?.change4w ?? 0) > 0 ? "+" : ""
        }}{{ softwareTrend?.change4w }}% 4wk
      </div>
    </div>

    <!-- Dynamic note from scorer -->
    <p
      v-if="note"
      data-testid="economic-note"
      class="mt-4 rounded-lg bg-orange-500/5 px-3 py-2 text-center text-xs leading-relaxed text-orange-400/80"
    >
      {{ note }}
    </p>

    <!-- Drill-down -->
    <Collapsible v-model:open="isOpen" class="mt-4">
      <CollapsibleTrigger
        class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] tracking-widest text-muted-foreground/50 uppercase transition-colors hover:text-muted-foreground"
      >
        <span>Drill down</span>
        <ChevronDown
          class="h-3 w-3 transition-transform duration-200"
          :class="{ 'rotate-180': isOpen }"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          class="mt-3 space-y-4 rounded-xl border border-border bg-secondary/30 p-4 text-xs leading-relaxed text-muted-foreground"
        >
          <!-- Funding context -->
          <div>
            <p
              class="mb-1 text-[10px] tracking-widest text-muted-foreground/60 uppercase"
            >
              AI Funding Context
            </p>
            <p>
              Funding data flows through our daily RSS pipeline and is factored
              into the Economic Replacement sub-score by each model. Major
              rounds are surfaced as signals on the homepage.
            </p>
          </div>

          <!-- CEPR Study -->
          <div class="border-t border-border pt-3">
            <p
              class="mb-1 text-[10px] tracking-widest text-muted-foreground/60 uppercase"
            >
              CEPR / BIS / EIB Study (Feb 2026)
            </p>
            <p>
              12,000+ European firms studied. Result: +4% productivity, 0 job
              losses, 5.9x training ROI. AI increased output without reducing
              headcount.
            </p>
            <a
              href="https://cepr.org/publications/dp19956"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-1 inline-flex items-center gap-0.5 text-muted-foreground/50 transition-colors hover:text-orange-500/60"
            >
              Source: CEPR
              <ExternalLink class="h-2 w-2" />
            </a>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
