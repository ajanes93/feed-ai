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

// --- Swiper: digest-only navigation ---
let swiperInstance: Swiper_T | null = null;
const swiperTransitioning = ref(false);

// Only allow Swiper to slide when at category boundary AND there's a digest to go to
const canSlideLeft = computed(() => {
  const atLastCategory = CATEGORIES.indexOf(activeCategory.value) === CATEGORIES.length - 1;
  return atLastCategory && hasNext.value;
});
const canSlideRight = computed(() => {
  const atFirstCategory = CATEGORIES.indexOf(activeCategory.value) === 0;
  return atFirstCategory && hasPrevious.value;
});

function updateSwiperAllowed() {
  if (!swiperInstance) return;
  swiperInstance.allowSlideNext = canSlideLeft.value;
  swiperInstance.allowSlidePrev = canSlideRight.value;
}

function onSwiperInit(swiper: Swiper_T) {
  swiperInstance = swiper;
  updateSwiperAllowed();
}

// When Swiper slides, it's always a digest change (categories are blocked)
async function onSlideChange(swiper: Swiper_T) {
  if (swiperTransitioning.value) return;
  const diff = swiper.activeIndex - 1;
  if (diff === 0) return;

  swiperTransitioning.value = true;
  try {
    if (diff < 0) {
      await goToPrevious();
      activeCategory.value = CATEGORIES[CATEGORIES.length - 1];
    } else {
      await goToNext();
      activeCategory.value = CATEGORIES[0];
    }
  } finally {
    swiper.slideTo(1, 0);
    swiperTransitioning.value = false;
    await nextTick();
    updateSwiperAllowed();
  }
}

// Update swiper allowed state when category changes
watch([activeCategory, hasPrevious, hasNext], () => {
  updateSwiperAllowed();
});

// --- Category swipe on feed content ---
let feedTouchStartX = 0;

function onFeedTouchStart(e: TouchEvent) {
  feedTouchStartX = e.touches[0]?.clientX ?? 0;
}

function onFeedTouchEnd(e: TouchEvent) {
  const dx = (e.changedTouches[0]?.clientX ?? 0) - feedTouchStartX;
  if (Math.abs(dx) < 50) return; // too short

  const catIdx = CATEGORIES.indexOf(activeCategory.value);
  if (dx < 0 && catIdx < CATEGORIES.length - 1) {
    // Swipe left → next category
    activeCategory.value = CATEGORIES[catIdx + 1];
  } else if (dx > 0 && catIdx > 0) {
    // Swipe right → prev category
    activeCategory.value = CATEGORIES[catIdx - 1];
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

// --- URL sync ---
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
const PULL_DEAD_ZONE = 25;

function onTouchStart(e: TouchEvent) {
  touchStartY.value = e.touches[0]?.clientY ?? 0;
}

function onTouchMove(e: TouchEvent) {
  if (refreshing.value || !touchStartY.value) return;
  const scrollEl = document.querySelector("[data-scroll-container]");
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
      class="fixed top-0 right-0 left-0 z-20 flex items-center justify-center bg-gray-900/95 backdrop-blur-sm transition-transform duration-200 ease-out"
      :style="{ transform: `translateY(${pullDistance > 0 || refreshing ? 0 : -100}%)`, height: `${Math.max(40, pullDistance)}px` }"
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

    <!-- Digest content with Swiper (digest nav only) -->
    <template v-else-if="digest">
      <Swiper
        :initial-slide="1"
        :speed="300"
        :resistance-ratio="0.5"
        :threshold="15"
        :touch-angle="30"
        :long-swipes-ratio="0.3"
        :no-swiping="true"
        no-swiping-selector=".no-swiper"
        class="h-[100dvh]"
        @swiper="onSwiperInit"
        @slide-change="onSlideChange"
      >
        <!-- Previous digest placeholder -->
        <SwiperSlide>
          <div class="flex h-full items-center justify-center">
            <div class="h-6 w-6 animate-spin rounded-full border-2 border-gray-700 border-t-gray-400" />
          </div>
        </SwiperSlide>

        <!-- Current digest -->
        <SwiperSlide>
          <div
            data-scroll-container
            class="h-full overflow-y-scroll overscroll-contain pb-[calc(2rem+env(safe-area-inset-bottom))]"
            @touchstart.passive="onFeedTouchStart"
            @touchend="onFeedTouchEnd"
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
                @select="(cat: string) => (activeCategory = cat)"
              />
            </div>

            <!-- Cards -->
            <DigestFeed :items="filteredItems" />
          </div>
        </SwiperSlide>

        <!-- Next digest placeholder -->
        <SwiperSlide>
          <div class="flex h-full items-center justify-center">
            <div class="h-6 w-6 animate-spin rounded-full border-2 border-gray-700 border-t-gray-400" />
          </div>
        </SwiperSlide>
      </Swiper>
    </template>
  </div>
</template>
