<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useDigest } from "./composables/useDigest";
import { useSwipeNavigation } from "./composables/useSwipeNavigation";
import DigestFeed from "./components/DigestFeed.vue";
import DateHeader from "./components/DateHeader.vue";
import EmptyState from "./components/EmptyState.vue";
import CategoryFilter from "./components/CategoryFilter.vue";

const activeCategory = ref("all");

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

const {
  swipeStyle,
  pullDistance,
  refreshing,
  pullThreshold,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
} = useSwipeNavigation({
  hasPrevious,
  hasNext,
  onSwipeRight: goToPrevious,
  onSwipeLeft: goToNext,
  onPullRefresh: fetchToday,
});

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
        :style="{
          opacity: Math.min(1, pullDistance / pullThreshold),
          transform: `rotate(${pullDistance * 3}deg)`,
        }"
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
