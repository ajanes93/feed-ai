<script setup lang="ts">
import type { DigestItem } from "../types";
import DigestCard from "./DigestCard.vue";

defineProps<{
  items: DigestItem[];
}>();
</script>

<template>
  <div
    data-scroll-container
    class="h-[100dvh] overflow-y-scroll pt-22 pb-[calc(2rem+env(safe-area-inset-bottom))]"
  >
    <TransitionGroup
      name="card"
      tag="div"
      class="mx-auto flex max-w-lg flex-col gap-3 px-4"
    >
      <DigestCard
        v-for="(item, idx) in items"
        :key="item.id"
        v-motion
        :item="item"
        :initial="{ opacity: 0, y: 8 }"
        :enter="{ opacity: 1, y: 0, transition: { delay: idx * 50, duration: 300 } }"
      />
    </TransitionGroup>
  </div>
</template>

<style scoped>
.card-enter-active {
  transition: all 0.3s ease-out;
}

.card-leave-active {
  transition: all 0.2s ease-in;
}

.card-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.card-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.card-move {
  transition: transform 0.3s ease-out;
}
</style>
