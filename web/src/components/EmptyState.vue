<script setup lang="ts">
defineProps<{
  message: string;
}>();
</script>

<template>
  <div class="h-screen flex flex-col items-center justify-center px-6 text-center">
    <span class="text-6xl mb-4">📭</span>
    <p class="text-gray-400 text-lg">{{ message }}</p>
  </div>
</template>
