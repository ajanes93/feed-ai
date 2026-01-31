<script setup lang="ts">
import { onMounted, ref, computed, watch, nextTick } from "vue";
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
const activeCategory = ref((route.query.category as string) || "all");

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

function itemsForCategory(cat: string) {
  if (!digest.value) return [];
  if (cat === "all") return digest.value.items;
  return digest.value.items.filter((i) => i.category === cat);
}

// --- Swiper: slides = [prev-digest, all, ai, dev, jobs, next-digest] ---
// Category slides at indices 1–4, boundary slides at 0 and 5
const CAT_OFFSET = 1;
const SLIDE_COUNT = CATEGORIES.length + 2;
const LAST_CAT_INDEX = CATEGORIES.length; // index 4

let swiperInstance: Swiper_T | null = null;
const transitioning = ref(false);

function onSwiperInit(swiper: Swiper_T) {
  swiperInstance = swiper;
}

function categorySlideIndex(cat: string) {
  return CATEGORIES.indexOf(cat) + CAT_OFFSET;
}

async function onSlideChange(swiper: Swiper_T) {
  if (transitioning.value) return;
  const idx = swiper.activeIndex;

  // Category slide — just update active category
  if (idx >= CAT_OFFSET && idx <= LAST_CAT_INDEX) {
    activeCategory.value = CATEGORIES[idx - CAT_OFFSET];
    return;
  }

  // Boundary slide — navigate digest
  transitioning.value = true;
  try {
    if (idx === 0 && hasPrevious.value) {
      await goToPrevious();
      activeCategory.value = CATEGORIES[CATEGORIES.length - 1];
      swiper.slideTo(LAST_CAT_INDEX, 0);
    } else if (idx === SLIDE_COUNT - 1 && hasNext.value) {
      await goToNext();
      activeCategory.value = CATEGORIES[0];
      swiper.slideTo(CAT_OFFSET, 0);
    } else {
      // At boundary but nothing to navigate to — bounce back
      const nearest = idx === 0 ? CAT_OFFSET : LAST_CAT_INDEX;
      swiper.slideTo(nearest, 200);
    }
  } finally {
    transitioning.value = false;
  }
}

// Track Swiper progress for pill indicator interpolation
const swiperProgress = ref(-1); // -1 means not swiping

function onSwiperProgress(_swiper: Swiper_T, progress: number) {
  // progress: 0 = first slide, 1 = last slide
  // Map to category float index (0..CATEGORIES.length-1)
  const totalSlides = CATEGORIES.length + 2;
  const slidePos = progress * (totalSlides - 1); // 0..5
  const catFloat = slidePos - CAT_OFFSET; // -1..4
  // Only send progress within category range
  if (catFloat >= -0.5 && catFloat <= CATEGORIES.length - 0.5) {
    swiperProgress.value = Math.max(0, Math.min(CATEGORIES.length - 1, catFloat));
  }
}

function onTouchEndSwiper() {
  swiperProgress.value = -1;
}

// Pill tap/drag → slide Swiper to that category
function setCategory(cat: string) {
  activeCategory.value = cat;
  swiperInstance?.slideTo(categorySlideIndex(cat), 250);
}

// Header arrow → digest navigation
async function navPrevious() {
  transitioning.value = true;
  try {
    await goToPrevious();
    activeCategory.value = CATEGORIES[0];
    swiperInstance?.slideTo(CAT_OFFSET, 0);
  } finally {
    transitioning.value = false;
  }
}
async function navNext() {
  transitioning.value = true;
  try {
    await goToNext();
    activeCategory.value = CATEGORIES[0];
    swiperInstance?.slideTo(CAT_OFFSET, 0);
  } finally {
    transitioning.value = false;
  }
}

// --- URL sync ---
watch(
  () => digest.value?.date,
  (date) => {
    if (!date) return;
    if ((route.params.date as string) !== date) {
      router.replace({
        name: "digest",
        params: { date },
        query: activeCategory.value !== "all" ? { category: activeCategory.value } : {},
      });
    }
  },
);

watch(activeCategory, (cat) => {
  router.replace({ ...route, query: cat !== "all" ? { category: cat } : {} });
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
const PULL_DEAD_ZONE = 25;

function onTouchStart(e: TouchEvent) {
  touchStartY.value = e.touches[0]?.clientY ?? 0;
}

function onTouchMove(e: TouchEvent) {
  if (refreshing.value || !touchStartY.value) return;
  // Query the currently active slide's scroll container
  const activeSlide = swiperInstance?.slides?.[swiperInstance.activeIndex];
  const scrollEl = activeSlide?.querySelector("[data-scroll-container]");
  if (!scrollEl || scrollEl.scrollTop > 2) return;
  const dy = (e.touches[0]?.clientY ?? 0) - touchStartY.value;
  if (dy > PULL_DEAD_ZONE) {
    pullDistance.value = Math.min(120, (dy - PULL_DEAD_ZONE) * 0.4);
  }
}

async function onTouchEnd() {
  if (pullDistance.value >= PULL_THRESHOLD && !refreshing.value) {
    refreshing.value = true;
    pullDistance.value = 50;
    await fetchToday();
    refreshing.value = false;
    await nextTick();
    swiperInstance?.slideTo(CAT_OFFSET, 0);
    activeCategory.value = CATEGORIES[0];
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
      v-if="pullDistance > 0 || refreshing"
      class="fixed top-0 right-0 left-0 z-20 flex items-center justify-center bg-gray-900/95 backdrop-blur-sm"
      :style="{ height: `${Math.max(40, pullDistance)}px` }"
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
    <div v-if="loading && !digest" class="h-[100dvh] overflow-hidden pt-16">
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

    <!-- Digest with Swiper -->
    <template v-else-if="digest">
      <!-- Sticky filters above Swiper -->
      <div class="no-swiper fixed top-0 right-0 left-0 z-10 bg-gray-950/95 px-4 py-2 backdrop-blur-sm">
        <CategoryFilter
          :items="digest.items"
          :active-category="activeCategory"
          :swipe-progress="swiperProgress"
          @select="setCategory"
        />
      </div>

      <Swiper
        :initial-slide="categorySlideIndex(activeCategory)"
        :speed="250"
        :resistance-ratio="0.4"
        :threshold="10"
        :touch-angle="35"
        :long-swipes-ratio="0.25"
        :no-swiping="true"
        no-swiping-selector=".no-swiper"
        class="h-[100dvh]"
        @swiper="onSwiperInit"
        @slide-change="onSlideChange"
        @progress="onSwiperProgress"
        @touch-end="onTouchEndSwiper"
      >
        <!-- Prev digest boundary -->
        <SwiperSlide>
          <div class="flex h-full items-center justify-center">
            <div v-if="hasPrevious" class="h-6 w-6 animate-spin rounded-full border-2 border-gray-700 border-t-gray-400" />
          </div>
        </SwiperSlide>

        <!-- Category slides -->
        <SwiperSlide v-for="cat in CATEGORIES" :key="cat">
          <div
            data-scroll-container
            class="h-full overflow-y-scroll overscroll-contain pt-12 pb-[calc(2rem+env(safe-area-inset-bottom))]"
          >
            <DateHeader
              :date="formattedDate"
              :item-count="itemsForCategory(cat).length"
              :has-previous="hasPrevious"
              :has-next="hasNext"
              @previous="navPrevious"
              @next="navNext"
            />
            <DigestFeed :items="itemsForCategory(cat)" />
          </div>
        </SwiperSlide>

        <!-- Next digest boundary -->
        <SwiperSlide>
          <div class="flex h-full items-center justify-center">
            <div v-if="hasNext" class="h-6 w-6 animate-spin rounded-full border-2 border-gray-700 border-t-gray-400" />
          </div>
        </SwiperSlide>
      </Swiper>
    </template>
  </div>
</template>
