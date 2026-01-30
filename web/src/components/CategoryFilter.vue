<script setup lang="ts">
import { computed } from "vue";
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
</script>

<template>
  <div class="flex gap-2">
    <button
      v-for="cat in categories"
      :key="cat.key"
      :class="[
        'rounded-full px-3 py-1 text-xs font-medium transition-colors',
        activeCategory === cat.key
          ? 'bg-white text-gray-950'
          : 'border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300',
      ]"
      @click="emit('select', cat.key)"
    >
      {{ cat.label }}
      <span
        v-if="counts[cat.key]"
        class="ml-1 text-gray-600"
      >
        {{ counts[cat.key] }}
      </span>
    </button>
  </div>
</template>
