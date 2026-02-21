<script setup lang="ts">
import type { DigestItem } from "../types";
import DigestCard from "./DigestCard.vue";

defineProps<{
  items: DigestItem[];
}>();
</script>

<template>
  <div
    v-auto-animate="{ duration: 200, easing: 'ease-out' }"
    class="mx-auto flex max-w-lg flex-col gap-3 px-4"
  >
    <DigestCard
      v-for="item in items"
      :key="item.id"
      :item="item"
    />
    <div
      v-if="items.length === 0"
      class="flex flex-col items-center justify-center py-24 text-center"
    >
      <span class="mb-3 text-4xl">📋</span>
      <p class="text-muted-foreground text-sm">
        No items in this category today
      </p>
    </div>
  </div>
</template>
