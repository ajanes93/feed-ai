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

// Swipe on pill bar to switch categories
let touchStartX = 0;
let didSwipe = false;

function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0]?.clientX ?? 0;
  didSwipe = false;
}

function onTouchEnd(e: TouchEvent) {
  const endX = e.changedTouches[0]?.clientX ?? 0;
  const dx = endX - touchStartX;
  if (Math.abs(dx) < 30) return; // tap, not swipe

  didSwipe = true;
  const currentIdx = categories.findIndex((c) => c.key === props.activeCategory);
  const dir = dx > 0 ? -1 : 1; // swipe left = next, swipe right = prev
  const newIdx = Math.max(0, Math.min(categories.length - 1, currentIdx + dir));
  if (newIdx !== currentIdx) {
    emit("select", categories[newIdx].key);
  }
}

function onClick(e: Event, key: string) {
  if (didSwipe) {
    e.preventDefault();
    didSwipe = false;
    return;
  }
  emit("select", key);
}
</script>

<template>
  <div
    ref="containerRef"
    class="relative flex justify-center gap-1.5"
    @touchstart.passive="onTouchStart"
    @touchend="onTouchEnd"
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
      @click="onClick($event, cat.key)"
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
