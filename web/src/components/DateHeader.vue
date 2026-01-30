<script setup lang="ts">
defineProps<{
  date: string;
  itemCount: number;
  hasPrevious: boolean;
  hasNext: boolean;
}>();

defineEmits<{
  previous: [];
  next: [];
}>();
</script>

<template>
  <div
    class="fixed top-0 right-0 left-0 z-10 bg-gradient-to-b from-gray-950 via-gray-950/95 to-transparent px-5 pt-4 pb-10"
  >
    <div class="mx-auto flex max-w-lg items-center justify-between">
      <button
        :disabled="!hasPrevious"
        class="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-800 hover:text-white disabled:invisible"
        @click="$emit('previous')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      <div class="flex flex-col items-center">
        <h2 class="text-sm font-semibold tracking-wide text-white">
          {{ date }}
        </h2>
        <span class="text-xs text-gray-500">{{ itemCount }} stories</span>
      </div>

      <button
        :disabled="!hasNext"
        class="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-800 hover:text-white disabled:invisible"
        @click="$emit('next')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  </div>
</template>
