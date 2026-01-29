<script setup lang="ts">
defineProps<{
  date: string;
  itemCount: number;
}>();
</script>

<template>
  <div class="fixed top-0 left-0 right-0 z-10 bg-gradient-to-b from-gray-900 to-transparent pb-8 pt-4 px-6">
    <div class="max-w-lg mx-auto flex justify-between items-center">
      <h2 class="text-white font-medium">{{ date }}</h2>
      <span class="text-gray-500 text-sm">{{ itemCount }} items</span>
    </div>
  </div>
</template>
