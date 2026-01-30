<script setup lang="ts">
import type { DigestItem } from "../types";
import DigestCard from "./DigestCard.vue";

defineProps<{
  items: DigestItem[];
}>();
</script>

<template>
  <div class="h-screen overflow-y-scroll pt-16 pb-8">
    <div class="mx-auto flex max-w-lg flex-col gap-3 px-4">
      <DigestCard
        v-for="item in items"
        :key="item.id"
        :item="item"
      />
    </div>
  </div>
</template>
