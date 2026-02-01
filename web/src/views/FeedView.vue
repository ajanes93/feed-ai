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
const activeCategory = ref((route.query.category as string) || "all");

// Outer Swiper: [prev-boundary, current-digest, next-boundary]
const DIGEST_SLIDE = 1;

// Pull-to-refresh
const PULL_THRESHOLD = 80;
const PULL_DEAD_ZONE = 25;

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

// --- Outer Swiper (digest navigation) ---
const transitioning = ref(false);

async function onOuterSlideChange(swiper: Swiper_T) {
  if (transitioning.value) return;
  const idx = swiper.activeIndex;
  if (idx === DIGEST_SLIDE) return;

  const isPrev = idx === 0;
  const canNavigate = isPrev ? hasPrevious.value : hasNext.value;

  transitioning.value = true;
  try {
    if (canNavigate) {
      await (isPrev ? goToPrevious() : goToNext());
      resetCategory(isPrev ? "last" : "first");
    }
    swiper.slideTo(DIGEST_SLIDE, canNavigate ? 0 : 200);
  } finally {
    transitioning.value = false;
  }
}

function resetCategory(position: "first" | "last") {
  const idx = position === "first" ? 0 : CATEGORIES.length - 1;
  activeCategory.value = CATEGORIES[idx];
  innerSwiper?.slideTo(idx, 0);
}

// --- Inner Swiper (category navigation) ---
let innerSwiper: Swiper_T | null = null;

function onInnerInit(swiper: Swiper_T) {
  innerSwiper = swiper;
}

function onInnerSlideChange(swiper: Swiper_T) {
  activeCategory.value = CATEGORIES[swiper.activeIndex];
}

// Track inner Swiper progress for pill indicator interpolation
const swiperProgress = ref(-1);

function onInnerProgress(_swiper: Swiper_T, progress: number) {
  const catFloat = progress * (CATEGORIES.length - 1);
  swiperProgress.value = Math.max(0, Math.min(CATEGORIES.length - 1, catFloat));
}

function onInnerTouchEnd() {
  swiperProgress.value = -1;
}

// Pill tap/drag → slide inner Swiper to that category
function setCategory(cat: string) {
  activeCategory.value = cat;
  innerSwiper?.slideTo(CATEGORIES.indexOf(cat), 250);
}

// Header arrow navigation — always land on "all" category
async function navigateDigest(direction: "prev" | "next") {
  transitioning.value = true;
  try {
    await (direction === "prev" ? goToPrevious() : goToNext());
    activeCategory.value = "all";
    innerSwiper?.slideTo(0, 0);
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
        query:
          activeCategory.value !== "all"
            ? { category: activeCategory.value }
            : {},
      });
    }
  }
);

watch(activeCategory, (cat) => {
  const date = digest.value?.date;
  if (!date) return;
  router.replace({
    name: "digest",
    params: { date },
    query: cat !== "all" ? { category: cat } : {},
  });
});

// Pull-to-refresh state
const pullDistance = ref(0);
const refreshing = ref(false);
const touchStartY = ref(0);
const touchStartX = ref(0);
const pullLocked = ref(false);
const pullText = computed(() => {
  if (refreshing.value) return "Refreshing…";
  return pullDistance.value >= PULL_THRESHOLD
    ? "Release to refresh"
    : "Pull to refresh";
});

function onTouchStart(e: TouchEvent) {
  touchStartY.value = e.touches[0]?.clientY ?? 0;
  touchStartX.value = e.touches[0]?.clientX ?? 0;
  pullLocked.value = false;
}

function onTouchMove(e: TouchEvent) {
  if (refreshing.value || !touchStartY.value || pullLocked.value) return;
  const dy = (e.touches[0]?.clientY ?? 0) - touchStartY.value;
  const dx = (e.touches[0]?.clientX ?? 0) - touchStartX.value;
  if (pullDistance.value === 0 && Math.abs(dx) > Math.abs(dy)) {
    pullLocked.value = true;
    return;
  }
  const activeSlide = innerSwiper?.slides?.[innerSwiper.activeIndex];
  const scrollEl = activeSlide?.querySelector("[data-scroll-container]");
  if (!scrollEl || scrollEl.scrollTop > 2) return;
  if (dy > PULL_DEAD_ZONE) {
    pullDistance.value = Math.min(120, (dy - PULL_DEAD_ZONE) * 0.4);
  }
}

async function onTouchEnd() {
  if (pullDistance.value >= PULL_THRESHOLD && !refreshing.value) {
    refreshing.value = true;
    pullDistance.value = 50;
    window.location.reload();
    return;
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
    class="h-[100dvh] bg-gray-950"
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
          :style="{
            transform: !refreshing
              ? `rotate(${pullDistance * 3}deg)`
              : undefined,
          }"
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

    <!-- Digest / Error with nested Swipers -->
    <template v-else-if="digest || error">
      <!-- Outer Swiper: digest navigation -->
      <Swiper
        :initial-slide="DIGEST_SLIDE"
        :speed="250"
        :resistance-ratio="0.4"
        :threshold="10"
        :touch-angle="35"
        :long-swipes-ratio="0.25"
        :no-swiping="true"
        no-swiping-selector=".no-swiper"
        class="h-full"
        @slide-change="onOuterSlideChange"
      >
        <!-- Prev digest boundary -->
        <SwiperSlide>
          <div class="flex h-full items-center justify-center">
            <div
              v-if="hasPrevious"
              class="h-6 w-6 animate-spin rounded-full border-2 border-gray-700 border-t-gray-400"
            />
          </div>
        </SwiperSlide>

        <!-- Current digest -->
        <SwiperSlide>
          <div class="flex h-full min-h-0 flex-col">
            <DateHeader
              :date="formattedDate"
              :item-count="digest ? itemsForCategory(activeCategory).length : 0"
              :has-previous="hasPrevious"
              :has-next="hasNext"
              @previous="navigateDigest('prev')"
              @next="navigateDigest('next')"
            />

            <!-- Empty/error state -->
            <EmptyState
              v-if="error"
              :message="error"
            />

            <!-- Digest content -->
            <template v-else-if="digest">
              <!-- Fixed filters between header and category Swiper -->
              <div class="no-swiper bg-gray-950 px-4 py-2">
                <CategoryFilter
                  :items="digest.items"
                  :active-category="activeCategory"
                  :swipe-progress="swiperProgress"
                  @select="setCategory"
                />
              </div>

              <!-- Inner Swiper: category navigation -->
              <Swiper
                :initial-slide="CATEGORIES.indexOf(activeCategory)"
                :speed="250"
                :threshold="10"
                :touch-angle="35"
                :long-swipes-ratio="0.25"
                :nested="true"
                :touch-release-on-edges="true"
                class="w-full flex-1"
                @swiper="onInnerInit"
                @slide-change="onInnerSlideChange"
                @progress="onInnerProgress"
                @touch-end="onInnerTouchEnd"
              >
                <SwiperSlide
                  v-for="cat in CATEGORIES"
                  :key="cat"
                >
                  <div
                    data-scroll-container
                    :data-testid="`feed-${cat}`"
                    class="h-full overflow-y-scroll overscroll-contain pb-[calc(2rem+env(safe-area-inset-bottom))]"
                  >
                    <DigestFeed :items="itemsForCategory(cat)" />
                  </div>
                </SwiperSlide>
              </Swiper>
            </template>
          </div>
        </SwiperSlide>

        <!-- Next digest boundary -->
        <SwiperSlide>
          <div class="flex h-full items-center justify-center">
            <div
              v-if="hasNext"
              class="h-6 w-6 animate-spin rounded-full border-2 border-gray-700 border-t-gray-400"
            />
          </div>
        </SwiperSlide>
      </Swiper>
    </template>
  </div>
</template>
