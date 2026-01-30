<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useDigest } from "./composables/useDigest";
import DigestFeed from "./components/DigestFeed.vue";
import DateHeader from "./components/DateHeader.vue";
import EmptyState from "./components/EmptyState.vue";

const {
  digest,
  loading,
  error,
  formattedDate,
  hasPrevious,
  hasNext,
  fetchToday,
  goToPrevious,
  goToNext,
} = useDigest();

const swipeTransition = ref<"none" | "slide-left" | "slide-right">("none");
const transitioning = ref(false);

let touchStartX = 0;
let touchStartY = 0;
const SWIPE_THRESHOLD = 60;

function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}

async function onTouchEnd(e: TouchEvent) {
  if (transitioning.value) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;

  if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;

  transitioning.value = true;

  if (dx > 0 && hasPrevious.value) {
    swipeTransition.value = "slide-right";
    await goToPrevious();
  } else if (dx < 0 && hasNext.value) {
    swipeTransition.value = "slide-left";
    await goToNext();
  }

  setTimeout(() => {
    swipeTransition.value = "none";
    transitioning.value = false;
  }, 300);
}

onMounted(() => {
  fetchToday();
});
</script>

<template>
  <div
    class="min-h-screen bg-gray-950"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
  >
    <!-- Loading state -->
    <div
      v-if="loading"
      class="flex h-screen items-center justify-center"
    >
      <div class="flex flex-col items-center gap-3">
        <div
          class="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-white"
        />
        <span class="text-sm text-gray-500">Loading digest...</span>
      </div>
    </div>

    <!-- Error/Empty state -->
    <EmptyState
      v-else-if="error"
      :message="error"
    />

    <!-- Digest content -->
    <template v-else-if="digest">
      <DateHeader
        :date="formattedDate"
        :item-count="digest.itemCount"
        :has-previous="hasPrevious"
        :has-next="hasNext"
        @previous="goToPrevious"
        @next="goToNext"
      />
      <div
        :class="[
          'transition-transform duration-300 ease-out',
          swipeTransition === 'slide-left'
            ? '-translate-x-4 opacity-90'
            : swipeTransition === 'slide-right'
              ? 'translate-x-4 opacity-90'
              : '',
        ]"
      >
        <DigestFeed :items="digest.items" />
      </div>
    </template>
  </div>
</template>
