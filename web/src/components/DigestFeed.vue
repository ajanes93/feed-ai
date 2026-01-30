<script setup lang="ts">
import type { DigestItem } from "../types";
import DigestCard from "./DigestCard.vue";

defineProps<{
  items: DigestItem[];
}>();
</script>

<template>
  <div
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
        :item="item"
        :style="{ animationDelay: `${idx * 50}ms` }"
        class="card-enter"
      />
    </TransitionGroup>
  </div>
</template>

<style scoped>
.card-enter {
  animation: cardFadeSlide 0.3s ease-out both;
}

@keyframes cardFadeSlide {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

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
