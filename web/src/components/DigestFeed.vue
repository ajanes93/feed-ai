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
  </div>
</template>
