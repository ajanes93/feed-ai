<script setup lang="ts">
import { computed } from "vue";
import type { OQHistoryEntry } from "@feed-ai/shared/oq-types";
import { Card, CardContent } from "@feed-ai/shared/components/ui/card";

const props = defineProps<{
  history: OQHistoryEntry[];
}>();

const SVG_WIDTH = 656;
const SVG_HEIGHT = 200;
const PADDING = 20;

const chartData = computed(() => {
  const entries = [...props.history].reverse();
  if (entries.length < 2) return null;

  const scores = entries.map((e) => e.score);
  const minScore = Math.max(0, Math.min(...scores) - 10);
  const maxScore = Math.min(100, Math.max(...scores) + 10);
  const range = maxScore - minScore || 1;

  const points = entries.map((entry, i) => ({
    x: PADDING + (i / (entries.length - 1)) * (SVG_WIDTH - PADDING * 2),
    y:
      SVG_HEIGHT -
      PADDING -
      ((entry.score - minScore) / range) * (SVG_HEIGHT - PADDING * 2),
    entry,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");

  const areaPath = `${linePath} L${points[points.length - 1].x},${SVG_HEIGHT} L${points[0].x},${SVG_HEIGHT} Z`;

  const labelCount = Math.min(5, entries.length);
  const labels = Array.from({ length: labelCount }, (_, i) => {
    const idx =
      i === labelCount - 1
        ? entries.length - 1
        : Math.floor((i / (labelCount - 1)) * (entries.length - 1));
    const date = new Date(entries[idx].date + "T12:00:00Z");
    return {
      x: points[idx].x,
      text:
        i === labelCount - 1
          ? "Today"
          : date.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            }),
    };
  });

  return { linePath, areaPath, lastPoint: points[points.length - 1], labels };
});

const gridLines = computed(() => {
  const lines = [];
  for (let i = 1; i <= 4; i++) {
    lines.push(PADDING + (i / 5) * (SVG_HEIGHT - PADDING * 2));
  }
  return lines;
});
</script>

<template>
  <Card class="border-border bg-card">
    <CardContent class="p-5 sm:p-8">
      <div v-if="chartData" class="relative">
        <svg
          class="w-full"
          :viewBox="`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="oqChartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="rgba(240, 94, 35, 0.2)" />
              <stop offset="100%" stop-color="rgba(240, 94, 35, 0)" />
            </linearGradient>
          </defs>

          <!-- Grid -->
          <line
            v-for="y in gridLines"
            :key="y"
            :x1="PADDING"
            :y1="y"
            :x2="SVG_WIDTH - PADDING"
            :y2="y"
            class="stroke-border"
            stroke-dasharray="2 4"
          />

          <!-- Area -->
          <path :d="chartData.areaPath" fill="url(#oqChartGradient)" />

          <!-- Line -->
          <path
            :d="chartData.linePath"
            fill="none"
            stroke="#f05e23"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <!-- End dot -->
          <circle
            :cx="chartData.lastPoint.x"
            :cy="chartData.lastPoint.y"
            r="5"
            fill="#f05e23"
            class="stroke-background"
            stroke-width="3"
          />
        </svg>

        <!-- Labels -->
        <div
          class="mt-3 flex justify-between font-mono text-[10px] text-muted-foreground"
        >
          <span v-for="label in chartData.labels" :key="label.text">
            {{ label.text }}
          </span>
        </div>
      </div>

      <div v-else class="py-8 text-center text-sm text-muted-foreground">
        Chart available after 2+ days of data.
      </div>
    </CardContent>
  </Card>
</template>
