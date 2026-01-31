<script setup lang="ts">
import type { DigestItem } from "../types";
import DigestCard from "./DigestCard.vue";

defineProps<{
  items: DigestItem[];
  category?: string;
}>();
</script>

<template>
  <div
    data-scroll-container
    class="h-[100dvh] overflow-y-scroll overscroll-contain pt-28 pb-[calc(2rem+env(safe-area-inset-bottom))]"
  >
    <TransitionGroup
      name="card"
      tag="div"
      class="mx-auto flex max-w-lg flex-col gap-3 px-4"
    >
      <DigestCard
        v-for="item in items"
        :key="item.id"
        :item="item"
      />
    </TransitionGroup>
  </div>
</template>

<style scoped>
.card-enter-active {
  transition:
    opacity 0.25s ease-out,
    transform 0.25s ease-out;
}

.card-leave-active {
  transition:
    opacity 0.15s ease-in,
    transform 0.15s ease-in;
  position: absolute;
  width: 100%;
}

.card-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.card-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.card-move {
  transition: transform 0.25s ease-out;
}
</style>
