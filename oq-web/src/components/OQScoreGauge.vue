<script setup lang="ts">
import { ref, onMounted, computed } from "vue";

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
        {{ animatedScore }}<span class="text-2xl text-gray-600">%</span>
      </div>
      <div class="flex w-full flex-1 flex-col gap-2">
        <div class="h-3 overflow-hidden rounded-full bg-gray-800">
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
          class="flex justify-between text-[10px] tracking-widest text-gray-600 uppercase"
        >
          <span>Safe for now</span>
          <span>Getting close</span>
          <span>Fully replaced</span>
        </div>
      </div>
    </div>

    <!-- Sub-scores -->
    <div class="mt-6 grid grid-cols-2 gap-3">
      <div class="rounded-xl border border-gray-800 bg-gray-800/30 p-3">
        <div class="font-mono text-lg font-medium text-gray-200">
          {{ scoreTechnical }}<span class="text-xs text-gray-600">%</span>
        </div>
        <div class="text-[11px] text-gray-500">Technical Feasibility</div>
      </div>
      <div class="rounded-xl border border-gray-800 bg-gray-800/30 p-3">
        <div class="font-mono text-lg font-medium text-gray-200">
          {{ scoreEconomic }}<span class="text-xs text-gray-600">%</span>
        </div>
        <div class="text-[11px] text-gray-500">Economic Replacement</div>
      </div>
    </div>
  </div>
</template>
