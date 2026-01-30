<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from "vue";
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
let transitionTimeout: ReturnType<typeof setTimeout> | null = null;
const SWIPE_THRESHOLD = 60;
const TRANSITION_DURATION = 300;

onBeforeUnmount(() => {
  if (transitionTimeout) clearTimeout(transitionTimeout);
});

const transitionClasses = computed(() => {
  if (swipeTransition.value === "slide-left") {
    return "-translate-x-4 opacity-90";
  }
  if (swipeTransition.value === "slide-right") {
    return "translate-x-4 opacity-90";
  }
  return "";
});

function onTouchStart(e: TouchEvent) {
  const touch = e.touches[0];
  if (!touch) return;
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}

async function onTouchEnd(e: TouchEvent) {
  const touch = e.changedTouches[0];
  if (transitioning.value || !touch) return;

  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;

  if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;

  transitioning.value = true;

  if (dx > 0 && hasPrevious.value) {
    swipeTransition.value = "slide-right";
    await goToPrevious();
  } else if (dx < 0 && hasNext.value) {
    swipeTransition.value = "slide-left";
    await goToNext();
  }

  transitionTimeout = setTimeout(() => {
    swipeTransition.value = "none";
    transitioning.value = false;
    transitionTimeout = null;
  }, TRANSITION_DURATION);
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

    <!-- Error/Empty state with navigation -->
    <template v-else-if="error">
      <DateHeader
        :date="formattedDate"
        :item-count="0"
        :has-previous="hasPrevious"
        :has-next="hasNext"
        @previous="goToPrevious"
        @next="goToNext"
      />
      <EmptyState :message="error" />
    </template>

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
        :class="['transition-transform duration-300 ease-out', transitionClasses]"
      >
        <DigestFeed :items="digest.items" />
      </div>
    </template>
  </div>
</template>
