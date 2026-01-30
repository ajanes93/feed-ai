<script setup lang="ts">
defineProps<{
  value: string | number;
  label: string;
  highlight?: boolean;
}>();
</script>

<template>
  <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
    <div
      class="text-2xl font-bold"
      :class="highlight ? 'text-amber-400' : 'text-white'"
    >
      {{ value }}
    </div>
    <div class="text-xs text-gray-400">{{ label }}</div>
  </div>
</template>
