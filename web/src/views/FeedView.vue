<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDigest } from "../composables/useDigest";
import { useSwipeNavigation } from "../composables/useSwipeNavigation";
import DigestFeed from "../components/DigestFeed.vue";
import DateHeader from "../components/DateHeader.vue";
import EmptyState from "../components/EmptyState.vue";
import CategoryFilter from "../components/CategoryFilter.vue";

const route = useRoute();
const router = useRouter();

const CATEGORIES = ["all", "ai", "dev", "jobs"];
const activeCategory = ref(
  (route.query.category as string) || "all",
);

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
  fetchDate,
  goToPrevious,
  goToNext,
} = useDigest();

// Sync URL when digest changes
watch(
  () => digest.value?.date,
  (date) => {
    if (!date) return;
    const currentDate = route.params.date as string | undefined;
    if (currentDate !== date) {
      router.replace({
        name: "digest",
        params: { date },
        query: activeCategory.value !== "all" ? { category: activeCategory.value } : {},
      });
    }
  },
);

// Sync URL when category changes
watch(activeCategory, (cat) => {
  const query = cat !== "all" ? { category: cat } : {};
  router.replace({ ...route, query });
});

function setCategory(cat: string) {
  activeCategory.value = cat;
}

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
  categories: CATEGORIES,
  activeCategory,
  onSwipeRight: goToPrevious,
  onSwipeLeft: goToNext,
  onPullRefresh: fetchToday,
  onCategoryChange: setCategory,
});

onMounted(async () => {
  const dateParam = route.params.date as string | undefined;
  if (dateParam) {
    await fetchDate(dateParam);
  } else {
    await fetchToday();
  }
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
      class="fixed top-0 right-0 left-0 z-20 flex items-center justify-center"
      :style="{
        transform: `translateY(${pullDistance - 40}px)`,
        transition: 'transform 100ms ease-out',
      }"
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
      class="h-[100dvh] overflow-hidden pt-24"
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
      >
        <template #filters>
          <CategoryFilter
            :items="digest.items"
            :active-category="activeCategory"
            @select="setCategory"
          />
        </template>
      </DateHeader>
      <div :style="swipeStyle">
        <DigestFeed
          :items="filteredItems"
          :category="activeCategory"
        />
      </div>
    </template>
  </div>
</template>
