<script setup lang="ts">
defineProps<{
  date: string;
  itemCount: number;
}>();
</script>

<template>
  <div
    class="fixed top-0 right-0 left-0 z-10 bg-gradient-to-b from-gray-900 to-transparent px-6 pt-4 pb-8"
  >
    <div class="mx-auto flex max-w-lg items-center justify-between">
      <h2 class="font-medium text-white">{{ date }}</h2>
      <span class="text-sm text-gray-500">{{ itemCount }} items</span>
    </div>
  </div>
</template>
