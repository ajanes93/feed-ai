<script setup lang="ts">
defineProps<{
  message: string;
}>();
</script>

<template>
  <div
    class="flex h-[100dvh] flex-col items-center justify-center px-6 text-center"
  >
    <span
      v-motion
      class="mb-4 text-6xl"
      :initial="{ y: 0 }"
      :enter="{ y: [-8, 0, -8], transition: { duration: 2500, repeat: Infinity, ease: 'easeInOut' } }"
    >
      📭
    </span>
    <p
      v-motion
      class="text-lg text-gray-400"
      :initial="{ opacity: 0, y: 6 }"
      :enter="{ opacity: 1, y: 0, transition: { delay: 200, duration: 500 } }"
    >
      {{ message }}
    </p>
  </div>
</template>
