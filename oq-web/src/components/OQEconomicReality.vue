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
}>();

function trendArrow(val?: number): string {
  if (val === undefined) return "";
  if (val > 0) return `+${val}%`;
  return `${val}%`;
}

const isOpen = ref(false);

const vcRaises = [
  { name: "Cursor", amount: "$400M Series C", date: "Aug 2024" },
  { name: "Poolside", amount: "$500M", date: "Jul 2024" },
  { name: "Magic", amount: "$320M", date: "Aug 2024" },
  { name: "Cognition (Devin)", amount: "$175M", date: "Mar 2024" },
  { name: "Augment", amount: "$227M", date: "2024" },
];
</script>

<template>
  <div class="rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8">
    <div class="mb-4 text-[10px] tracking-widest text-gray-600 uppercase">
      The Economic Reality
    </div>

    <div class="grid grid-cols-3 gap-4 text-center">
      <!-- Indeed Software Index -->
      <div>
        <div
          class="text-2xl font-semibold tracking-tight text-gray-200 sm:text-3xl"
        >
          ~{{ softwareIndex ?? 70 }}
        </div>
        <div
          class="mt-1 flex items-center justify-center gap-1 text-[10px] leading-tight text-gray-600 uppercase"
        >
          Indeed Software Index
          <OQExplainer
            text="Job postings for software engineers vs a Feb 2020 baseline (100). ~70 = 30% below baseline. Compared against general postings to isolate software-specific trends."
          />
        </div>
        <div class="mt-0.5 text-[9px] text-gray-700">vs 100 baseline</div>
        <a
          href="https://fred.stlouisfed.org/series/IHLIDXUSTPSOFTDEVE"
          target="_blank"
          rel="noopener"
          class="mt-0.5 inline-flex items-center gap-0.5 text-[9px] text-gray-700 transition-colors hover:text-orange-500/60"
        >
          FRED
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
          {{ trendArrow(softwareTrend?.change4w) }} 4wk
        </div>
      </div>

      <!-- VC Funding -->
      <div>
        <div
          class="text-2xl font-semibold tracking-tight text-orange-500 sm:text-3xl"
        >
          $4B+
        </div>
        <div class="mt-1 text-[10px] leading-tight text-gray-600 uppercase">
          VC in AI Code Tools
        </div>
        <div class="mt-0.5 text-[9px] text-gray-700">2024-2026</div>
      </div>

      <!-- Fortune 500 -->
      <div>
        <div
          class="text-2xl font-semibold tracking-tight text-gray-200 sm:text-3xl"
        >
          0
        </div>
        <div class="mt-1 text-[10px] leading-tight text-gray-600 uppercase">
          F500 Teams Replaced
        </div>
        <div class="mt-0.5 text-[9px] text-gray-700">As of Feb 2026</div>
      </div>
    </div>

    <p class="mt-5 text-xs leading-relaxed text-gray-500">
      Investors are betting billions that AI will replace engineers. Companies
      haven't done it yet.
    </p>

    <!-- Drill-down -->
    <Collapsible v-model:open="isOpen" class="mt-4">
      <CollapsibleTrigger
        class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] tracking-widest text-gray-700 uppercase transition-colors hover:text-gray-500"
      >
        <span>Drill down</span>
        <ChevronDown
          class="h-3 w-3 transition-transform duration-200"
          :class="{ 'rotate-180': isOpen }"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          class="mt-3 space-y-4 rounded-xl border border-gray-800 bg-gray-800/30 p-4 text-xs leading-relaxed text-gray-400"
        >
          <!-- VC Breakdown -->
          <div>
            <p class="mb-2 text-[10px] tracking-widest text-gray-600 uppercase">
              VC in AI Code Tools breakdown
            </p>
            <div class="space-y-1">
              <div
                v-for="raise in vcRaises"
                :key="raise.name"
                class="flex items-center justify-between"
              >
                <span>{{ raise.name }}</span>
                <span class="font-mono text-gray-500">
                  {{ raise.amount }}
                  <span class="text-gray-600">({{ raise.date }})</span>
                </span>
              </div>
            </div>
          </div>

          <!-- CEPR Study -->
          <div class="border-t border-gray-800 pt-3">
            <p class="mb-1 text-[10px] tracking-widest text-gray-600 uppercase">
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
              rel="noopener"
              class="mt-1 inline-flex items-center gap-0.5 text-gray-600 transition-colors hover:text-orange-500/60"
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
