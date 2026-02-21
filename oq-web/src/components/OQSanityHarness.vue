<script setup lang="ts">
defineProps<{
  topPassRate: number;
  topAgent: string;
  topModel: string;
  medianPassRate: number;
  languageBreakdown: string;
}>();

function parseLangs(breakdown: string): { lang: string; pct: number }[] {
  return breakdown
    .split(",")
    .map((s) => {
      const m = s.trim().match(/^(\w+):\s*([\d.]+)%?$/);
      return m ? { lang: m[1], pct: parseFloat(m[2]) } : null;
    })
    .filter((x): x is { lang: string; pct: number } => x !== null)
    .sort((a, b) => b.pct - a.pct);
}

function langColor(pct: number): string {
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 50) return "text-yellow-400";
  return "text-red-400";
}

function langBg(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-yellow-500";
  return "bg-red-500";
}
</script>

<template>
  <div class="rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8">
    <div class="mb-4 text-[10px] tracking-widest text-gray-600 uppercase">
      AI Agent Reality Check
    </div>

    <!-- Top vs Median -->
    <div class="flex items-center justify-center gap-8 sm:gap-12">
      <div class="text-center">
        <div
          class="text-3xl font-semibold tracking-tight text-gray-200 sm:text-4xl"
        >
          {{ topPassRate }}<span class="text-lg text-gray-600">%</span>
        </div>
        <div class="mt-1 text-[10px] tracking-widest text-gray-600 uppercase">
          Top Agent
        </div>
        <div class="mt-0.5 text-[9px] text-gray-700">
          {{ topAgent }} + {{ topModel }}
        </div>
      </div>

      <div class="text-center">
        <div
          class="text-3xl font-semibold tracking-tight text-orange-500 sm:text-4xl"
        >
          ~{{ medianPassRate }}<span class="text-lg text-orange-500/50">%</span>
        </div>
        <div class="mt-1 text-[10px] tracking-widest text-gray-600 uppercase">
          Median Agent
        </div>
        <div class="mt-0.5 text-[9px] text-gray-700">Across all agents</div>
      </div>
    </div>

    <!-- Language spread -->
    <div v-if="languageBreakdown" class="mt-5 border-t border-gray-800 pt-4">
      <div class="mb-2 text-[10px] tracking-widest text-gray-600 uppercase">
        Language spread (top agent)
      </div>
      <div class="flex flex-wrap gap-2">
        <div
          v-for="lang in parseLangs(languageBreakdown)"
          :key="lang.lang"
          class="flex items-center gap-1.5 rounded-lg bg-gray-800/50 px-2.5 py-1.5"
        >
          <span class="h-1.5 w-1.5 rounded-full" :class="langBg(lang.pct)" />
          <span class="text-xs font-medium capitalize text-gray-400">
            {{ lang.lang }}
          </span>
          <span class="font-mono text-xs" :class="langColor(lang.pct)">
            {{ lang.pct }}%
          </span>
        </div>
      </div>
    </div>

    <p class="mt-4 text-xs leading-relaxed text-gray-500">
      AI agents ace some languages but fail others. A generalist replacement
      would need all of them.
    </p>
  </div>
</template>
