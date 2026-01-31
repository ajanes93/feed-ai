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

// Sliding indicator
const containerRef = ref<HTMLElement | null>(null);
const indicatorStyle = ref({ left: "0px", width: "0px" });

function updateIndicator() {
  if (!containerRef.value) return;
  const activeIdx = categories.findIndex((c) => c.key === props.activeCategory);
  const buttons = containerRef.value.querySelectorAll("button");
  const btn = buttons[activeIdx];
  if (!btn) return;
  const containerRect = containerRef.value.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  indicatorStyle.value = {
    left: `${btnRect.left - containerRect.left}px`,
    width: `${btnRect.width}px`,
  };
}

onMounted(() => nextTick(updateIndicator));
watch(() => props.activeCategory, () => nextTick(updateIndicator));
watch(() => props.items.length, () => nextTick(updateIndicator));

// Swipe/drag on pill bar to switch categories
let dragStartX = 0;
let dragStartCategory = 0;

function onPointerDown(e: PointerEvent) {
  dragStartX = e.clientX;
  dragStartCategory = categories.findIndex((c) => c.key === props.activeCategory);
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onPointerUp(e: PointerEvent) {
  const dx = e.clientX - dragStartX;
  const threshold = 30;
  if (Math.abs(dx) < threshold) return; // too short, was a tap

  const dir = dx < 0 ? -1 : 1; // drag right = next category
  const newIdx = Math.max(0, Math.min(categories.length - 1, dragStartCategory + dir));
  if (newIdx !== dragStartCategory) {
    emit("select", categories[newIdx].key);
  }
}
</script>

<template>
  <div
    ref="containerRef"
    class="relative flex touch-pan-y justify-center gap-1.5"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <!-- Sliding active indicator -->
    <div
      class="absolute top-0 h-full rounded-full bg-white shadow-sm transition-all duration-250 ease-[cubic-bezier(0.25,1,0.5,1)]"
      :style="indicatorStyle"
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
      @click="emit('select', cat.key)"
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
