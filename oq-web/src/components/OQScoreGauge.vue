<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { Card, CardContent } from "@feed-ai/shared/components/ui/card";
import OQExplainer from "./OQExplainer.vue";

const props = defineProps<{
  score: number;
  scoreTechnical: number;
  scoreEconomic: number;
}>();

const animatedScore = ref(0);
const showBar = ref(false);

onMounted(() => {
  const start = performance.now();
  const tick = (now: number) => {
    const progress = Math.min((now - start) / 1800, 1);
    animatedScore.value = Math.round(
      (1 - Math.pow(1 - progress, 3)) * props.score
    );
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setTimeout(() => (showBar.value = true), 300);
});

const barWidth = computed(() => (showBar.value ? `${props.score}%` : "0%"));
</script>

<template>
  <div>
    <!-- Main gauge -->
    <div class="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
      <div
        class="text-center font-mono text-6xl font-medium text-orange-500 sm:min-w-[120px]"
      >
        {{ animatedScore }}<span class="text-2xl text-muted-foreground">%</span>
      </div>
      <div class="flex w-full flex-1 flex-col gap-2">
        <div class="h-3 overflow-hidden rounded-full bg-secondary">
          <div
            class="relative h-full rounded-full transition-all duration-[2000ms] ease-out"
            style="background: linear-gradient(90deg, #f05e23, #ff8c42)"
            :style="{ width: barWidth }"
          >
            <div
              class="absolute top-1/2 right-0 h-[18px] w-[18px] -translate-y-1/2 rounded-full bg-white shadow-[0_0_12px_#f05e23,0_0_4px_rgba(0,0,0,0.3)]"
            />
          </div>
        </div>
        <div
          class="flex justify-between text-[10px] tracking-widest text-muted-foreground uppercase"
        >
          <span>Safe for now</span>
          <span>Getting close</span>
          <span>Fully replaced</span>
        </div>
      </div>
    </div>

    <!-- Sub-scores -->
    <div class="mt-6 grid grid-cols-2 gap-3">
      <Card class="border-border bg-secondary/30 py-0">
        <CardContent class="p-3">
          <div class="font-mono text-lg font-medium text-foreground">
            {{ scoreTechnical
            }}<span class="text-xs text-muted-foreground">%</span>
          </div>
          <div
            class="flex items-center gap-1 text-[11px] text-muted-foreground"
          >
            Technical Feasibility
            <OQExplainer
              text="Can AI do the work? Based on benchmarks and capabilities (SWE-bench, SanityHarness)."
            />
          </div>
        </CardContent>
      </Card>
      <Card class="border-border bg-secondary/30 py-0">
        <CardContent class="p-3">
          <div class="font-mono text-lg font-medium text-foreground">
            {{ scoreEconomic
            }}<span class="text-xs text-muted-foreground">%</span>
          </div>
          <div
            class="flex items-center gap-1 text-[11px] text-muted-foreground"
          >
            Economic Replacement
            <OQExplainer
              text="Will companies actually replace engineers? Based on jobs, funding, and headcount data."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
