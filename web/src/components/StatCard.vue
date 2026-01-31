<script setup lang="ts">
import { motion } from "motion-v";

defineProps<{
  value: string | number;
  label: string;
  highlight?: boolean;
  index?: number;
}>();
</script>

<template>
  <motion.div
    class="rounded-xl border border-gray-800 bg-gray-900 p-4"
    :initial="{ opacity: 0, y: 12 }"
    :animate="{ opacity: 1, y: 0 }"
    :transition="{ duration: 0.35, delay: (index ?? 0) * 0.05 }"
  >
    <div
      class="text-2xl font-bold"
      :class="highlight ? 'text-amber-400' : 'text-white'"
    >
      {{ value }}
    </div>
    <div class="text-xs text-gray-400">{{ label }}</div>
  </motion.div>
</template>
