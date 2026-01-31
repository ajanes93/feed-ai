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

async function onSlideChangeTransitionEnd(swiper: Swiper_T) {
  if (swiperTransitioning.value) return;
  const diff = swiper.activeIndex - 1; // 1 is center
  if (diff === 0) return;

  swiperTransitioning.value = true;
  try {
    if (diff < 0 && hasPrevious.value) {
      await goToPrevious();
      activeCategory.value = "all";
    } else if (diff > 0 && hasNext.value) {
      await goToNext();
      activeCategory.value = "all";
    }
  } finally {
    // Reset to center slide without animation
    swiper.slideToLoop(1, 0);
    swiperTransitioning.value = false;
  }
}

// Navigate via header arrows
async function navPrevious() {
  if (swiperInstance) {
    swiperInstance.slidePrev(300);
  } else {
    await goToPrevious();
  }
}
async function navNext() {
  if (swiperInstance) {
    swiperInstance.slideNext(300);
  } else {
    await goToNext();
  }
}

// --- Category ---
function setCategory(cat: string) {
  activeCategory.value = cat;
}

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
const PULL_THRESHOLD = 80;

function onTouchMove(e: TouchEvent) {
  if (refreshing.value) return;
  const scrollEl = document.querySelector("[data-scroll-container]");
  if (!scrollEl || scrollEl.scrollTop > 2) return;
  const touch = e.touches[0];
  if (!touch) return;
  const startY = (e.target as HTMLElement)?.dataset?.touchStartY;
  if (!startY) return;
  const dy = touch.clientY - Number(startY);
  if (dy > 0) {
    pullDistance.value = Math.min(120, dy * 0.4);
  }
}

function onTouchStart(e: TouchEvent) {
  const touch = e.touches[0];
  if (touch) {
    (e.target as HTMLElement).dataset.touchStartY = String(touch.clientY);
  }
}

async function onTouchEnd() {
  if (pullDistance.value >= PULL_THRESHOLD && !refreshing.value) {
    refreshing.value = true;
    pullDistance.value = 40;
    await fetchToday();
    refreshing.value = false;
  }
  pullDistance.value = 0;
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
          opacity: Math.min(1, pullDistance / PULL_THRESHOLD),
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
        @previous="navPrevious"
        @next="navNext"
      />
      <EmptyState :message="error" />
    </template>

    <!-- Digest content with Swiper -->
    <template v-else-if="digest">
      <DateHeader
        :date="formattedDate"
        :item-count="filteredItems.length"
        :has-previous="hasPrevious"
        :has-next="hasNext"
        @previous="navPrevious"
        @next="navNext"
      >
        <template #filters>
          <CategoryFilter
            :items="digest.items"
            :active-category="activeCategory"
            @select="setCategory"
          />
        </template>
      </DateHeader>

      <Swiper
        :initial-slide="1"
        :slides-per-view="1"
        :speed="300"
        :resistance="true"
        :resistance-ratio="0.6"
        :threshold="10"
        :touch-angle="35"
        :short-swipes="true"
        :long-swipes="true"
        :long-swipes-ratio="0.25"
        :follow-finger="true"
        :css-mode="false"
        class="h-[100dvh]"
        @swiper="onSwiperInit"
        @slide-change-transition-end="onSlideChangeTransitionEnd"
      >
        <!-- Previous slide (placeholder) -->
        <SwiperSlide>
          <div class="flex h-full items-center justify-center text-gray-600">
            <span v-if="hasPrevious">Previous digest</span>
          </div>
        </SwiperSlide>

        <!-- Current digest -->
        <SwiperSlide>
          <DigestFeed :items="filteredItems" />
        </SwiperSlide>

        <!-- Next slide (placeholder) -->
        <SwiperSlide>
          <div class="flex h-full items-center justify-center text-gray-600">
            <span v-if="hasNext">Next digest</span>
          </div>
        </SwiperSlide>
      </Swiper>
    </template>
  </div>
</template>
