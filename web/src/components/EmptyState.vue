<script setup lang="ts">
import { motion } from "motion-v";

defineProps<{
  message: string;
}>();
</script>

<template>
  <div
    class="flex h-[100dvh] flex-col items-center justify-center px-6 text-center"
  >
    <motion.span
      class="mb-4 text-6xl"
      :animate="{ y: [0, -8, 0] }"
      :transition="{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }"
    >
      📭
    </motion.span>
    <motion.p
      class="text-lg text-gray-400"
      :initial="{ opacity: 0, y: 6 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ delay: 0.2, duration: 0.5 }"
    >
      {{ message }}
    </motion.p>
  </div>
</template>
