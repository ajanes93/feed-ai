<script setup lang="ts">
import { motion } from "motion-v";

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
  <div class="px-5 pt-4 pb-2">
    <div class="mx-auto flex max-w-lg items-center justify-between">
      <motion.button
        :disabled="!hasPrevious"
        aria-label="Previous digest"
        class="text-muted-foreground hover:bg-accent hover:text-foreground flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:invisible"
        :press="{ scale: 0.85 }"
        @click="$emit('previous')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </motion.button>

      <div class="flex flex-col items-center">
        <h2 class="text-foreground text-sm font-semibold tracking-wide">
          {{ date }}
        </h2>
        <span class="text-muted-foreground text-xs"
          >{{ itemCount }} stories</span
        >
      </div>

      <motion.button
        :disabled="!hasNext"
        aria-label="Next digest"
        class="text-muted-foreground hover:bg-accent hover:text-foreground flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:invisible"
        :press="{ scale: 0.85 }"
        @click="$emit('next')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </motion.button>
    </div>
  </div>
</template>
