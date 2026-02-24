<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@feed-ai/shared/components/ui/collapsible";
import { ExternalLink, ChevronDown } from "lucide-vue-next";
import OQExplainer from "./OQExplainer.vue";

const props = defineProps<{
  softwareIndex?: number;
  softwareDate?: string;
  softwareTrend?: { change1w?: number; change4w?: number };
  softwareIndexDelta?: number;
  generalIndex?: number;
  generalTrend?: { change1w?: number; change4w?: number };
  note?: string;
  labourNote?: string;
  totalRaised?: string;
  fundingCount?: number;
  topRound?: { company: string; amount: string; round?: string };
  fundingEvents?: {
    company: string;
    amount?: string;
    round?: string;
    sourceUrl?: string;
    date?: string;
    relevance?: string;
  }[];
}>();

function formatDelta(delta: number | undefined): string {
  if (delta === undefined || delta === 0) return "";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}`;
}

function deltaColor(delta: number | undefined): string {
  if (delta === undefined || delta === 0) return "";
  return delta > 0 ? "text-emerald-400" : "text-red-400";
}

/** Software falling faster than general = meaningful divergence signal */
const hasDivergence = computed(() => {
  const sw = props.softwareTrend?.change4w;
  const gen = props.generalTrend?.change4w;
  if (sw === undefined || gen === undefined) return false;
  // Software declining more than general (both negative, software more negative)
  return sw < gen && sw < 0;
});

const isOpen = ref(false);
</script>

<template>
  <div class="rounded-2xl border border-border bg-card p-6 sm:p-8">
    <div
      class="mb-4 text-[10px] tracking-widest text-muted-foreground uppercase"
    >
      The Economic Reality
    </div>

    <!-- Dual-stat layout -->
    <div class="flex items-start justify-center gap-6 sm:gap-10">
      <!-- Left column: Indeed Software Index -->
      <div class="text-center">
        <div
          class="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
        >
          ~{{ softwareIndex ?? 70 }}
          <span
            v-if="softwareIndexDelta !== undefined && softwareIndexDelta !== 0"
            data-testid="fred-delta"
            class="ml-1 text-sm font-normal"
            :class="deltaColor(softwareIndexDelta)"
          >
            {{ formatDelta(softwareIndexDelta) }}
          </span>
        </div>
        <div
          class="mt-1 flex max-w-[140px] items-center justify-center gap-1 text-[10px] leading-tight text-muted-foreground uppercase"
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

      <!-- Right column: Funding headline -->
      <div v-if="totalRaised && totalRaised !== '$0'" class="text-center">
        <div
          class="text-3xl font-semibold tracking-tight text-orange-500 sm:text-4xl"
          data-testid="funding-total"
        >
          {{ totalRaised }}
        </div>
        <div
          class="mt-1 max-w-[140px] text-[10px] leading-tight text-muted-foreground uppercase"
        >
          AI Funding
        </div>
        <div
          v-if="fundingCount"
          class="mt-0.5 text-[9px] text-muted-foreground/50"
          data-testid="funding-count"
        >
          across {{ fundingCount }} round{{ fundingCount !== 1 ? "s" : "" }}
        </div>
        <div
          v-if="topRound"
          class="mt-1 text-[9px] text-muted-foreground/50"
          data-testid="top-round"
        >
          Top: {{ topRound.company }} · {{ topRound.amount
          }}<span v-if="topRound.round"> · {{ topRound.round }}</span>
        </div>
      </div>
    </div>

    <!-- General employment sub-row -->
    <div
      v-if="generalIndex !== undefined"
      data-testid="general-index"
      class="mt-3 flex items-center justify-center gap-2 text-[10px] text-muted-foreground"
    >
      <span>Initial Claims (ICSA):</span>
      <span class="font-mono text-foreground/70">{{
        generalIndex.toLocaleString()
      }}</span>
      <span
        v-if="generalTrend?.change4w !== undefined"
        class="font-mono"
        :class="
          (generalTrend?.change4w ?? 0) < 0
            ? 'text-emerald-400'
            : 'text-red-400'
        "
      >
        {{ (generalTrend?.change4w ?? 0) > 0 ? "+" : ""
        }}{{ generalTrend?.change4w }}% 4wk
      </span>
    </div>

    <!-- Divergence callout -->
    <div
      v-if="hasDivergence"
      data-testid="divergence-callout"
      class="mt-2 rounded-lg bg-red-500/5 px-3 py-1.5 text-center text-[10px] font-medium text-red-400/80"
    >
      Software postings {{ softwareTrend?.change4w }}% vs general
      {{ generalTrend?.change4w }}% — software-specific decline
    </div>

    <!-- Dynamic note from scorer -->
    <p
      v-if="note"
      data-testid="economic-note"
      class="mt-4 rounded-lg bg-orange-500/5 px-3 py-2 text-center text-xs leading-relaxed text-orange-400/80"
    >
      {{ note }}
    </p>

    <!-- Labour note from scorer -->
    <p
      v-if="labourNote"
      data-testid="labour-note"
      class="mt-2 rounded-lg bg-orange-500/5 px-3 py-2 text-center text-xs leading-relaxed text-orange-400/80"
    >
      {{ labourNote }}
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
          <!-- Software vs General divergence -->
          <div
            v-if="
              softwareTrend?.change4w !== undefined &&
              generalTrend?.change4w !== undefined
            "
            data-testid="drill-down-divergence"
          >
            <p
              class="mb-1 text-[10px] tracking-widest text-muted-foreground/60 uppercase"
            >
              Software vs General
            </p>
            <p>
              Software postings
              <span
                class="font-mono"
                :class="
                  (softwareTrend?.change4w ?? 0) < 0
                    ? 'text-red-400'
                    : 'text-emerald-400'
                "
                >{{ (softwareTrend?.change4w ?? 0) > 0 ? "+" : ""
                }}{{ softwareTrend?.change4w }}%</span
              >
              vs general
              <span
                class="font-mono"
                :class="
                  (generalTrend?.change4w ?? 0) < 0
                    ? 'text-emerald-400'
                    : 'text-red-400'
                "
                >{{ (generalTrend?.change4w ?? 0) > 0 ? "+" : ""
                }}{{ generalTrend?.change4w }}%</span
              >
              (4-week change). When software falls faster than general, it
              signals AI-specific displacement rather than broad economic
              conditions.
            </p>
          </div>

          <!-- Funding events -->
          <div
            :class="{
              'border-t border-border pt-3':
                softwareTrend?.change4w !== undefined &&
                generalTrend?.change4w !== undefined,
            }"
          >
            <p
              class="mb-1 text-[10px] tracking-widest text-muted-foreground/60 uppercase"
            >
              Recent AI Funding
            </p>
            <div
              v-if="fundingEvents && fundingEvents.length > 0"
              class="space-y-2"
            >
              <div
                v-for="(event, i) in fundingEvents"
                :key="i"
                class="flex flex-wrap items-center gap-1.5"
                data-testid="funding-event"
              >
                <span class="font-medium text-foreground/80">{{
                  event.company
                }}</span>
                <span
                  v-if="event.amount"
                  class="rounded-md bg-orange-500/10 px-1.5 py-0.5 font-mono text-[10px] text-orange-400"
                  >{{ event.amount }}</span
                >
                <span v-if="event.round" class="text-muted-foreground/60">{{
                  event.round
                }}</span>
                <span
                  v-if="event.relevance"
                  class="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground/50"
                  >{{ event.relevance }}</span
                >
                <a
                  v-if="event.sourceUrl"
                  :href="event.sourceUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center text-muted-foreground/40 transition-colors hover:text-orange-500/60"
                >
                  <ExternalLink class="h-2.5 w-2.5" />
                </a>
              </div>
            </div>
            <p v-else class="text-muted-foreground/50">
              No recent funding events tracked.
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
