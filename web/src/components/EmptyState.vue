<script setup lang="ts">
defineProps<{
  message: string;
}>();
</script>

<template>
  <div
    class="flex h-screen flex-col items-center justify-center px-6 text-center"
  >
    <span class="mb-4 text-6xl">📭</span>
    <p class="text-lg text-gray-400">{{ message }}</p>
  </div>
</template>
