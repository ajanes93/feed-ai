<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from "vue";
import type { DigestItem } from "../types";

const props = defineProps<{
  items: DigestItem[];
  activeCategory: string;
}>();

const emit = defineEmits<{
  select: [category: string];
}>();

const categories = [
  { key: "all", label: "All" },
  { key: "ai", label: "AI" },
  { key: "dev", label: "Dev" },
  { key: "jobs", label: "Jobs" },
];

const counts = computed(() => {
  const map: Record<string, number> = { all: props.items.length };
  for (const item of props.items) {
    map[item.category] = (map[item.category] || 0) + 1;
  }
  return map;
});

// --- Indicator positioning ---
const containerRef = ref<HTMLElement | null>(null);
const indicatorLeft = ref(0);
const indicatorWidth = ref(0);
const dragging = ref(false);

function getButtonRects() {
  if (!containerRef.value) return [];
  const containerRect = containerRef.value.getBoundingClientRect();
  const buttons = containerRef.value.querySelectorAll("button");
  return Array.from(buttons).map((btn) => {
    const r = btn.getBoundingClientRect();
    return { left: r.left - containerRect.left, width: r.width, centerX: r.left + r.width / 2 };
  });
}

function updateIndicator() {
  const rects = getButtonRects();
  const idx = categories.findIndex((c) => c.key === props.activeCategory);
  if (rects[idx]) {
    indicatorLeft.value = rects[idx].left;
    indicatorWidth.value = rects[idx].width;
  }
}

onMounted(() => nextTick(updateIndicator));
watch(() => props.activeCategory, () => nextTick(updateIndicator));
watch(() => props.items.length, () => nextTick(updateIndicator));

// --- Draggable indicator ---
let dragPointerId = -1;

function onPointerDown(e: PointerEvent) {
  // Only start drag if touching near the active indicator
  const rects = getButtonRects();
  const idx = categories.findIndex((c) => c.key === props.activeCategory);
  if (!rects[idx] || !containerRef.value) return;

  dragPointerId = e.pointerId;
  dragging.value = true;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value || e.pointerId !== dragPointerId || !containerRef.value) return;

  const containerRect = containerRef.value.getBoundingClientRect();
  const localX = e.clientX - containerRect.left;
  const rects = getButtonRects();

  // Find nearest button and interpolate indicator position
  let closestIdx = 0;
  let closestDist = Infinity;
  for (let i = 0; i < rects.length; i++) {
    const center = rects[i].left + rects[i].width / 2;
    const dist = Math.abs(localX - center);
    if (dist < closestDist) {
      closestDist = dist;
      closestIdx = i;
    }
  }

  // Clamp indicator within pill bar bounds
  const clampedLeft = Math.max(
    rects[0].left,
    Math.min(localX - rects[closestIdx].width / 2, rects[rects.length - 1].left),
  );
  indicatorLeft.value = clampedLeft;
  indicatorWidth.value = rects[closestIdx].width;
}

function onPointerUp(e: PointerEvent) {
  if (!dragging.value || e.pointerId !== dragPointerId || !containerRef.value) return;
  dragging.value = false;

  const containerRect = containerRef.value.getBoundingClientRect();
  const localX = e.clientX - containerRect.left;
  const rects = getButtonRects();

  // Snap to nearest button
  let closestIdx = 0;
  let closestDist = Infinity;
  for (let i = 0; i < rects.length; i++) {
    const center = rects[i].left + rects[i].width / 2;
    const dist = Math.abs(localX - center);
    if (dist < closestDist) {
      closestDist = dist;
      closestIdx = i;
    }
  }

  emit("select", categories[closestIdx].key);
}

function onClick(key: string) {
  if (dragging.value) return;
  emit("select", key);
}
</script>

<template>
  <div
    ref="containerRef"
    class="relative flex justify-center gap-1.5 touch-none"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <!-- Draggable indicator -->
    <div
      class="absolute top-0 h-full rounded-full bg-white shadow-sm"
      :class="dragging ? '' : 'transition-all duration-250 ease-[cubic-bezier(0.25,1,0.5,1)]'"
      :style="{ left: `${indicatorLeft}px`, width: `${indicatorWidth}px` }"
    />
    <button
      v-for="cat in categories"
      :key="cat.key"
      :class="[
        'relative z-10 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-200',
        activeCategory === cat.key
          ? 'text-gray-950'
          : 'text-gray-400 hover:text-gray-300',
      ]"
      @click="onClick(cat.key)"
    >
      {{ cat.label }}
      <span
        v-if="counts[cat.key]"
        :class="[
          'ml-0.5 transition-colors duration-200',
          activeCategory === cat.key ? 'text-gray-500' : 'text-gray-600',
        ]"
      >
        {{ counts[cat.key] }}
      </span>
    </button>
  </div>
</template>
