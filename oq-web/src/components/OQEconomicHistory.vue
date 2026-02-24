<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Card, CardContent } from "@feed-ai/shared/components/ui/card";

interface FredPoint {
  date: string;
  softwareIndex: number | null;
  generalIndex: number | null;
}

interface ScorePoint {
  date: string;
  score: number;
  scoreEconomic: number;
  delta: number;
}

const fredData = ref<FredPoint[]>([]);
const scoreData = ref<ScorePoint[]>([]);
const loading = ref(true);
const days = ref(90);

async function fetchData() {
  loading.value = true;
  try {
    const res = await fetch(`/api/economic-history?d=${days.value}`);
    if (!res.ok) return;
    const data = await res.json();
    fredData.value = data.fredData;
    scoreData.value = data.scoreData;
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);

// SVG chart dimensions
const W = 600;
const H = 200;
const PAD = { top: 10, right: 40, bottom: 20, left: 40 };
const chartW = W - PAD.left - PAD.right;
const chartH = H - PAD.top - PAD.bottom;

const softwareSeries = computed(() =>
  fredData.value
    .filter((d) => d.softwareIndex !== null)
    .map((d) => ({ date: d.date, value: d.softwareIndex! }))
);

function buildPath(
  series: { date: string; value: number }[],
  minDate: string,
  maxDate: string,
  minVal: number,
  maxVal: number
): string {
  if (series.length < 2) return "";
  const dateRange =
    new Date(maxDate).getTime() - new Date(minDate).getTime() || 1;
  const valRange = maxVal - minVal || 1;

  return series
    .map((p, i) => {
      const x =
        PAD.left +
        ((new Date(p.date).getTime() - new Date(minDate).getTime()) /
          dateRange) *
          chartW;
      const y = PAD.top + (1 - (p.value - minVal) / valRange) * chartH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Range-based padding — data fills ~80% of chart height */
function rangeAxis(vals: number[]): { min: number; max: number } {
  if (vals.length === 0) return { min: 0, max: 100 };
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const range = hi - lo || 1;
  const pad = range * 0.15;
  return {
    min: Math.floor((lo - pad) * 10) / 10,
    max: Math.ceil((hi + pad) * 10) / 10,
  };
}

const softwareYAxis = computed(() =>
  rangeAxis(softwareSeries.value.map((d) => d.value))
);

const softwarePath = computed(() => {
  const s = softwareSeries.value;
  if (s.length < 2) return "";
  const dates = s.map((d) => d.date);
  const { min, max } = softwareYAxis.value;
  return buildPath(s, dates[0], dates[dates.length - 1], min, max);
});

// Score trend line (right Y axis)
const scoreSeries = computed(() =>
  scoreData.value.map((d) => ({ date: d.date, value: d.score }))
);

const scoreYAxis = computed(() =>
  rangeAxis(scoreSeries.value.map((d) => d.value))
);

const scorePath = computed(() => {
  const s = scoreSeries.value;
  if (s.length < 2) return "";
  const dates = s.map((d) => d.date);
  const { min, max } = scoreYAxis.value;
  return buildPath(s, dates[0], dates[dates.length - 1], min, max);
});

// Score change dots positioned on the score line
const scoreDots = computed(() => {
  const s = scoreSeries.value;
  if (s.length < 2) return [];
  const dates = s.map((d) => d.date);
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];
  const { min: minVal, max: maxVal } = scoreYAxis.value;
  const dateRange =
    new Date(maxDate).getTime() - new Date(minDate).getTime() || 1;
  const valRange = maxVal - minVal || 1;

  return scoreData.value
    .filter((d) => d.delta !== 0)
    .map((d) => {
      const x =
        PAD.left +
        ((new Date(d.date).getTime() - new Date(minDate).getTime()) /
          dateRange) *
          chartW;
      const y = PAD.top + (1 - (d.score - minVal) / valRange) * chartH;
      return {
        x: Math.max(PAD.left, Math.min(x, PAD.left + chartW)),
        y,
        date: d.date,
        delta: d.delta,
        score: d.score,
      };
    })
    .filter((d) => d.x >= PAD.left && d.x <= PAD.left + chartW);
});

const xLabels = computed(() => {
  const s = softwareSeries.value;
  if (s.length < 2) return [];
  const first = s[0].date;
  const last = s[s.length - 1].date;
  const mid = s[Math.floor(s.length / 2)]?.date;
  return [
    { x: PAD.left, label: formatShortDate(first) },
    { x: PAD.left + chartW / 2, label: formatShortDate(mid) },
    { x: PAD.left + chartW, label: formatShortDate(last) },
  ];
});

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
</script>

<template>
  <div data-testid="economic-history">
    <div v-if="loading" class="flex justify-center py-10">
      <div
        class="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-orange-500"
      />
    </div>

    <template v-else-if="softwareSeries.length >= 2">
      <Card class="border-border bg-card py-0">
        <CardContent class="p-5">
          <div class="mb-3 flex items-center justify-between">
            <div
              class="text-[10px] tracking-widest text-muted-foreground uppercase"
            >
              Indeed Software Index — {{ days }}d
            </div>
            <div class="flex gap-1">
              <button
                v-for="d in [30, 60, 90]"
                :key="d"
                class="rounded px-2 py-0.5 text-[9px] transition-colors"
                :class="
                  days === d
                    ? 'bg-orange-500/15 text-orange-500'
                    : 'text-muted-foreground/50 hover:text-muted-foreground'
                "
                @click="
                  days = d;
                  fetchData();
                "
              >
                {{ d }}d
              </button>
            </div>
          </div>

          <!-- SVG Chart -->
          <svg
            :viewBox="`0 0 ${W} ${H}`"
            class="w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <!-- Y axis labels -->
            <text
              :x="PAD.left - 4"
              :y="PAD.top + 4"
              text-anchor="end"
              class="fill-muted-foreground/40 text-[8px]"
            >
              {{ softwareYAxis.max }}
            </text>
            <text
              :x="PAD.left - 4"
              :y="PAD.top + chartH"
              text-anchor="end"
              class="fill-muted-foreground/40 text-[8px]"
            >
              {{ softwareYAxis.min }}
            </text>

            <!-- Grid line at 100 baseline -->
            <line
              v-if="softwareYAxis.min < 100 && softwareYAxis.max > 100"
              :x1="PAD.left"
              :y1="
                PAD.top +
                (1 -
                  (100 - softwareYAxis.min) /
                    (softwareYAxis.max - softwareYAxis.min)) *
                  chartH
              "
              :x2="PAD.left + chartW"
              :y2="
                PAD.top +
                (1 -
                  (100 - softwareYAxis.min) /
                    (softwareYAxis.max - softwareYAxis.min)) *
                  chartH
              "
              stroke="currentColor"
              stroke-dasharray="4 4"
              class="text-muted-foreground/20"
            />

            <!-- Software index line -->
            <path
              :d="softwarePath"
              fill="none"
              stroke="rgb(240, 94, 35)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />

            <!-- Score trend line (right axis) -->
            <path
              v-if="scorePath"
              :d="scorePath"
              fill="none"
              stroke="rgb(96, 165, 250)"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-dasharray="4 3"
            />

            <!-- Right Y axis labels (score) -->
            <text
              :x="PAD.left + chartW + 4"
              :y="PAD.top + 4"
              text-anchor="start"
              class="fill-blue-400/50 text-[8px]"
            >
              {{ scoreYAxis.max }}
            </text>
            <text
              :x="PAD.left + chartW + 4"
              :y="PAD.top + chartH"
              text-anchor="start"
              class="fill-blue-400/50 text-[8px]"
            >
              {{ scoreYAxis.min }}
            </text>

            <!-- Score change markers (on score line) -->
            <circle
              v-for="dot in scoreDots"
              :key="dot.date"
              :cx="dot.x"
              :cy="dot.y"
              :r="3"
              :fill="dot.delta > 0 ? 'rgb(248, 113, 113)' : 'rgb(52, 211, 153)'"
              class="opacity-70"
            >
              <title>
                {{ dot.date }}: score {{ dot.score }} ({{
                  dot.delta > 0 ? "+" : ""
                }}{{ dot.delta }})
              </title>
            </circle>

            <!-- X axis labels -->
            <text
              v-for="label in xLabels"
              :key="label.label"
              :x="label.x"
              :y="H - 2"
              text-anchor="middle"
              class="fill-muted-foreground/40 text-[8px]"
            >
              {{ label.label }}
            </text>
          </svg>

          <!-- Legend -->
          <div
            class="mt-2 flex flex-wrap items-center justify-center gap-4 text-[9px] text-muted-foreground/50"
          >
            <div class="flex items-center gap-1">
              <span class="inline-block h-0.5 w-3 rounded bg-orange-500" />
              Software index
            </div>
            <div class="flex items-center gap-1">
              <span
                class="inline-block h-0.5 w-3 rounded border-t border-dashed border-blue-400"
              />
              OQ score
            </div>
            <div class="flex items-center gap-1">
              <span
                class="inline-block h-1.5 w-1.5 rounded-full bg-red-400 opacity-70"
              />
              Score up
            </div>
            <div class="flex items-center gap-1">
              <span
                class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 opacity-70"
              />
              Score down
            </div>
            <div class="flex items-center gap-1">
              <span
                class="inline-block h-px w-3 border-t border-dashed border-muted-foreground/20"
              />
              100 baseline
            </div>
          </div>
        </CardContent>
      </Card>
    </template>

    <div v-else class="py-6 text-center text-xs text-muted-foreground/50">
      Not enough historical data yet.
    </div>
  </div>
</template>
