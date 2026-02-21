<script setup lang="ts">
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
        <div class="mt-1 text-[10px] leading-tight text-gray-600 uppercase">
          Indeed Software Index
        </div>
        <div class="mt-0.5 text-[9px] text-gray-700">vs 100 baseline</div>
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
        <div class="mt-0.5 text-[9px] text-gray-700">Cursor, Devin, etc.</div>
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
        <div class="mt-0.5 text-[9px] text-gray-700">At scale</div>
      </div>
    </div>

    <p class="mt-5 text-xs leading-relaxed text-gray-500">
      Investors are betting billions that AI will replace engineers. Companies
      haven't done it yet.
    </p>
  </div>
</template>
