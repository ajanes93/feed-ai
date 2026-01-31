<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Swiper, SwiperSlide } from "swiper/vue";
import type Swiper_T from "swiper";
import "swiper/css";
import { useDigest } from "../composables/useDigest";
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

// --- Swiper digest navigation ---
let swiperInstance: Swiper_T | null = null;
const swiperTransitioning = ref(false);

function onSwiperInit(swiper: Swiper_T) {
  swiperInstance = swiper;
}

async function onSlideChange(swiper: Swiper_T) {
  if (swiperTransitioning.value) return;
  const diff = swiper.activeIndex - 1;
  if (diff === 0) return;

  const catIdx = CATEGORIES.indexOf(activeCategory.value);
  const swipedLeft = diff > 0;
  const swipedRight = diff < 0;

  // Try category change first
  if (swipedLeft && catIdx < CATEGORIES.length - 1) {
    activeCategory.value = CATEGORIES[catIdx + 1];
    swiper.slideTo(1, 0);
    return;
  }
  if (swipedRight && catIdx > 0) {
    activeCategory.value = CATEGORIES[catIdx - 1];
    swiper.slideTo(1, 0);
    return;
  }

  // At category boundary — navigate digests
  swiperTransitioning.value = true;
  try {
    if (swipedRight && hasPrevious.value) {
      await goToPrevious();
      activeCategory.value = CATEGORIES[CATEGORIES.length - 1];
    } else if (swipedLeft && hasNext.value) {
      await goToNext();
      activeCategory.value = CATEGORIES[0];
    }
  } finally {
    swiper.slideTo(1, 0);
    swiperTransitioning.value = false;
  }
}

// Navigate via header arrows (digest only)
async function navPrevious() {
  await goToPrevious();
  activeCategory.value = CATEGORIES[0];
  swiperInstance?.slideTo(1, 0);
}
async function navNext() {
  await goToNext();
  activeCategory.value = CATEGORIES[0];
  swiperInstance?.slideTo(1, 0);
}

// --- Category ---

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

// --- Pull to refresh ---
const pullDistance = ref(0);
const refreshing = ref(false);
const pullText = computed(() => {
  if (refreshing.value) return "Refreshing…";
  return pullDistance.value >= PULL_THRESHOLD ? "Release to refresh" : "Pull to refresh";
});
const touchStartY = ref(0);
const PULL_THRESHOLD = 80;

function onTouchStart(e: TouchEvent) {
  touchStartY.value = e.touches[0]?.clientY ?? 0;
}

function onTouchMove(e: TouchEvent) {
  if (refreshing.value || !touchStartY.value) return;
  const scrollEl = document.querySelector("[data-scroll-container]");
  if (!scrollEl || scrollEl.scrollTop > 2) return;
  const dy = (e.touches[0]?.clientY ?? 0) - touchStartY.value;
  if (dy > 0) {
    pullDistance.value = Math.min(120, dy * 0.4);
  }
}

async function onTouchEnd() {
  if (pullDistance.value >= PULL_THRESHOLD && !refreshing.value) {
    refreshing.value = true;
    pullDistance.value = 50;
    await fetchToday();
    refreshing.value = false;
  }
  pullDistance.value = 0;
  touchStartY.value = 0;
}

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
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend="onTouchEnd"
  >
    <!-- Pull-to-refresh drawer -->
    <div
      class="fixed top-0 right-0 left-0 z-20 flex items-center justify-center bg-gray-900/95 backdrop-blur-sm transition-transform duration-200 ease-out"
      :style="{ transform: `translateY(${pullDistance > 0 ? 0 : -100}%)`, height: `${Math.max(40, pullDistance)}px` }"
    >
      <div class="flex items-center gap-2">
        <div
          :class="[
            'h-4 w-4 rounded-full border-2 border-gray-600 border-t-white',
            refreshing ? 'animate-spin' : '',
          ]"
          :style="{ transform: !refreshing ? `rotate(${pullDistance * 3}deg)` : undefined }"
        />
        <span class="text-xs font-medium text-gray-400">{{ pullText }}</span>
      </div>
    </div>

    <!-- Loading skeleton (initial load only) -->
    <div
      v-if="loading && !digest"
      class="h-[100dvh] overflow-hidden pt-16"
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

    <!-- Error/Empty state -->
    <template v-else-if="error">
      <DateHeader
        :date="formattedDate"
        :item-count="0"
        :has-previous="hasPrevious"
        :has-next="hasNext"
        @previous="navPrevious"
        @next="navNext"
      />
      <EmptyState :message="error" />
    </template>

    <!-- Digest content with Swiper -->
    <template v-else-if="digest">
      <Swiper
        :initial-slide="1"
        :speed="300"
        :resistance-ratio="0.6"
        :threshold="10"
        :touch-angle="35"
        :long-swipes-ratio="0.25"
        :no-swiping="true"
        no-swiping-selector=".no-swiper"
        class="h-[100dvh]"
        @swiper="onSwiperInit"
        @slide-change="onSlideChange"
      >
        <SwiperSlide>
          <div class="flex h-full items-center justify-center text-gray-600">
            <span v-if="hasPrevious">Previous digest</span>
          </div>
        </SwiperSlide>

        <SwiperSlide>
          <div
            data-scroll-container
            class="h-full overflow-y-scroll overscroll-contain pb-[calc(2rem+env(safe-area-inset-bottom))]"
          >
            <!-- Date header (scrolls with content) -->
            <DateHeader
              :date="formattedDate"
              :item-count="filteredItems.length"
              :has-previous="hasPrevious"
              :has-next="hasNext"
              @previous="navPrevious"
              @next="navNext"
            />

            <!-- Sticky category filters -->
            <div class="no-swiper sticky top-0 z-10 bg-gray-950/95 px-4 py-2 backdrop-blur-sm">
              <CategoryFilter
                :items="digest.items"
                :active-category="activeCategory"
                @select="(cat) => (activeCategory = cat)"
              />
            </div>

            <!-- Cards -->
            <DigestFeed :items="filteredItems" />
          </div>
        </SwiperSlide>

        <SwiperSlide>
          <div class="flex h-full items-center justify-center text-gray-600">
            <span v-if="hasNext">Next digest</span>
          </div>
        </SwiperSlide>
      </Swiper>
    </template>
  </div>
</template>
