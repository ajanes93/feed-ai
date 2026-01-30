<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useDigest } from "./composables/useDigest";
import DigestFeed from "./components/DigestFeed.vue";
import DateHeader from "./components/DateHeader.vue";
import EmptyState from "./components/EmptyState.vue";
import CategoryFilter from "./components/CategoryFilter.vue";

const activeCategory = ref("all");
const pullDistance = ref(0);
const refreshing = ref(false);
const PULL_THRESHOLD = 80;

const filteredItems = computed(() => {
  if (!digest.value) return [];
  if (activeCategory.value === "all") return digest.value.items;
  return digest.value.items.filter((i) => i.category === activeCategory.value);
});

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

const swipeOffset = ref(0);
const swipeAnimating = ref(false);
const transitioning = ref(false);

let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let lastTouchX = 0;
let lastTouchTime = 0;
let isHorizontalSwipe: boolean | null = null;
const SWIPE_THRESHOLD = 40;
const VELOCITY_THRESHOLD = 0.3;
const SPRING_DURATION = 400;

const swipeStyle = computed(() => {
  if (swipeOffset.value === 0 && !swipeAnimating.value) return {};
  const opacity = Math.max(0.4, 1 - Math.abs(swipeOffset.value) / 500);
  return {
    transform: `translateX(${swipeOffset.value}px)`,
    opacity: String(opacity),
    transition: swipeAnimating.value
      ? `transform ${SPRING_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity ${SPRING_DURATION}ms ease-out`
      : "none",
  };
});

function onTouchStart(e: TouchEvent) {
  const touch = e.touches[0];
  if (!touch || transitioning.value) return;
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchStartTime = Date.now();
  lastTouchX = touch.clientX;
  lastTouchTime = touchStartTime;
  isHorizontalSwipe = null;
  swipeAnimating.value = false;
  swipeOffset.value = 0;
}

function onTouchMove(e: TouchEvent) {
  const touch = e.touches[0];
  if (!touch || transitioning.value) return;

  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;

  // Determine swipe direction on first significant movement
  if (isHorizontalSwipe === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
    isHorizontalSwipe = Math.abs(dx) > Math.abs(dy);
  }

  if (!isHorizontalSwipe) {
    // Check for pull-to-refresh (vertical pull down when at top)
    if (dy > 0 && !refreshing.value) {
      const scrollEl = document.querySelector(".overflow-y-scroll");
      if (scrollEl && scrollEl.scrollTop === 0) {
        pullDistance.value = Math.min(120, dy * 0.4);
      }
    }
    return;
  }

  // Apply resistance at edges (no valid navigation in this direction)
  const canGo = dx > 0 ? hasPrevious.value : hasNext.value;
  const resistance = canGo ? 1 : 0.2;
  swipeOffset.value = dx * resistance;

  lastTouchX = touch.clientX;
  lastTouchTime = Date.now();
}

async function onTouchEnd(e: TouchEvent) {
  const touch = e.changedTouches[0];
  if (!touch || transitioning.value || !isHorizontalSwipe) {
    swipeOffset.value = 0;
    return;
  }

  const dx = touch.clientX - touchStartX;
  const dt = Math.max(1, Date.now() - lastTouchTime);
  const velocity = (touch.clientX - lastTouchX) / dt;

  const shouldNavigate =
    Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(velocity) > VELOCITY_THRESHOLD;

  if (shouldNavigate) {
    const goingRight = dx > 0;
    const canGo = goingRight ? hasPrevious.value : hasNext.value;

    if (canGo) {
      transitioning.value = true;
      // Animate off-screen in swipe direction
      swipeAnimating.value = true;
      swipeOffset.value = goingRight ? window.innerWidth : -window.innerWidth;

      await new Promise((r) => setTimeout(r, SPRING_DURATION / 2));

      if (goingRight) {
        await goToPrevious();
      } else {
        await goToNext();
      }

      // Slide in from opposite side
      swipeAnimating.value = false;
      swipeOffset.value = goingRight ? -window.innerWidth / 3 : window.innerWidth / 3;

      // Force reflow, then animate to center
      await new Promise((r) => requestAnimationFrame(r));
      swipeAnimating.value = true;
      swipeOffset.value = 0;

      setTimeout(() => {
        swipeAnimating.value = false;
        transitioning.value = false;
      }, SPRING_DURATION);
      return;
    }
  }

  // Spring back to center
  swipeAnimating.value = true;
  swipeOffset.value = 0;
  setTimeout(() => {
    swipeAnimating.value = false;
  }, SPRING_DURATION);

  // Handle pull-to-refresh
  if (pullDistance.value >= PULL_THRESHOLD && !refreshing.value) {
    refreshing.value = true;
    pullDistance.value = 40;
    await fetchToday();
    refreshing.value = false;
  }
  pullDistance.value = 0;
}

onMounted(() => {
  fetchToday();
});
</script>

<template>
  <div
    class="min-h-[100dvh] bg-gray-950"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <!-- Pull-to-refresh indicator -->
    <div
      v-if="pullDistance > 0"
      class="fixed top-0 right-0 left-0 z-20 flex items-center justify-center transition-transform duration-200"
      :style="{ transform: `translateY(${pullDistance - 40}px)` }"
    >
      <div
        :class="[
          'h-8 w-8 rounded-full border-2 border-gray-600 border-t-white',
          refreshing ? 'animate-spin' : '',
        ]"
        :style="{ opacity: Math.min(1, pullDistance / PULL_THRESHOLD), transform: `rotate(${pullDistance * 3}deg)` }"
      />
    </div>

    <!-- Loading skeleton -->
    <div
      v-if="loading"
      class="h-[100dvh] overflow-hidden pt-22"
    >
      <div class="mx-auto flex max-w-lg flex-col gap-3 px-4">
        <div
          v-for="n in 5"
          :key="n"
          class="animate-pulse rounded-xl border border-gray-800/50 bg-gray-900/60 p-5"
        >
          <div class="mb-3 flex items-center gap-3">
            <div class="h-5 w-10 rounded-full bg-gray-800" />
            <div class="h-4 w-12 rounded bg-gray-800" />
            <div class="ml-auto h-4 w-20 rounded bg-gray-800" />
          </div>
          <div class="h-5 w-3/4 rounded bg-gray-800" />
          <div class="mt-3 h-4 w-full rounded bg-gray-800/60" />
          <div class="mt-1.5 h-4 w-5/6 rounded bg-gray-800/60" />
        </div>
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
        :item-count="filteredItems.length"
        :has-previous="hasPrevious"
        :has-next="hasNext"
        @previous="goToPrevious"
        @next="goToNext"
      />
      <div class="fixed top-12 right-0 left-0 z-10 px-5 pb-2">
        <div class="mx-auto max-w-lg">
          <CategoryFilter
            :items="digest.items"
            :active-category="activeCategory"
            @select="activeCategory = $event"
          />
        </div>
      </div>
      <div :style="swipeStyle">
        <DigestFeed :items="filteredItems" />
      </div>
    </template>
  </div>
</template>
