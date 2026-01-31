import { ref, computed, type Ref, type MaybeRefOrGetter } from "vue";
import { useSwipe } from "@vueuse/core";

interface SwipeNavigationOptions {
  el: MaybeRefOrGetter<HTMLElement | null | undefined>;
  hasPrevious: Ref<boolean>;
  hasNext: Ref<boolean>;
  categories: string[];
  activeCategory: Ref<string>;
  onSwipeRight: () => Promise<unknown>;
  onSwipeLeft: () => Promise<unknown>;
  onPullRefresh: () => Promise<unknown>;
  onCategoryChange: (category: string) => void;
}

const SWIPE_THRESHOLD = 50;
const PULL_THRESHOLD = 80;
const ANIM_MS = 350;
const EASE = "cubic-bezier(0.25, 1, 0.5, 1)";

export function useSwipeNavigation(options: SwipeNavigationOptions) {
  const swipeOffset = ref(0);
  const animating = ref(false);
  const transitioning = ref(false);
  const pullDistance = ref(0);
  const refreshing = ref(false);

  // --- Swipe style applied to content container ---
  const swipeStyle = computed(() => {
    const off = swipeOffset.value;
    if (off === 0 && !animating.value) return {};
    return {
      transform: `translate3d(${off}px, 0, 0)`,
      opacity: String(Math.max(0.3, 1 - Math.abs(off) / 500)),
      transition: animating.value
        ? `transform ${ANIM_MS}ms ${EASE}, opacity ${ANIM_MS}ms ${EASE}`
        : "none",
      willChange: "transform, opacity",
    };
  });

  // --- Helpers ---
  function getCategoryIndex() {
    return options.categories.indexOf(options.activeCategory.value);
  }

  function canDigestNav(right: boolean) {
    const idx = getCategoryIndex();
    const atBoundary = right ? idx === 0 : idx === options.categories.length - 1;
    const hasDigest = right ? options.hasPrevious.value : options.hasNext.value;
    return atBoundary && hasDigest;
  }

  function animate(target: number): Promise<void> {
    return new Promise((resolve) => {
      animating.value = true;
      swipeOffset.value = target;
      setTimeout(() => {
        animating.value = false;
        resolve();
      }, ANIM_MS + 10);
    });
  }

  // --- Main swipe via @vueuse/core ---
  const { lengthX, lengthY, direction, isSwiping } = useSwipe(options.el, {
    threshold: 10,
    onSwipe() {
      if (transitioning.value) return;

      const dx = -lengthX.value; // lengthX is inverted (positive = left)
      const dy = -lengthY.value;

      // Pull-to-refresh check (vertical, at top of scroll)
      if (!isSwiping.value) return;
      if (direction.value === "down" && !refreshing.value) {
        const scrollEl = document.querySelector("[data-scroll-container]");
        if (scrollEl && scrollEl.scrollTop <= 2) {
          pullDistance.value = Math.min(120, Math.abs(dy) * 0.4);
          return;
        }
      }

      // Only handle horizontal swipes
      if (direction.value !== "left" && direction.value !== "right") return;

      const right = dx > 0;
      if (canDigestNav(right)) {
        swipeOffset.value = dx; // 1:1 tracking
      } else {
        // Dampened hint for category change, rubber-band at edges
        const idx = getCategoryIndex();
        const atEdge =
          (right && idx === 0) ||
          (!right && idx === options.categories.length - 1);
        swipeOffset.value = atEdge
          ? dx * 0.15 // rubber-band feel
          : dx * 0.25; // category hint
      }
    },
    async onSwipeEnd() {
      if (transitioning.value) return;

      // Handle pull-to-refresh
      if (pullDistance.value >= PULL_THRESHOLD && !refreshing.value) {
        refreshing.value = true;
        pullDistance.value = 40;
        await options.onPullRefresh();
        refreshing.value = false;
      }
      pullDistance.value = 0;

      const dx = -lengthX.value;
      if (Math.abs(dx) < SWIPE_THRESHOLD) {
        await animate(0);
        return;
      }

      const right = dx > 0;

      // Digest navigation
      if (canDigestNav(right)) {
        transitioning.value = true;
        try {
          // Slide off
          await animate(right ? window.innerWidth * 0.7 : -window.innerWidth * 0.7);

          // Fetch new digest
          if (right) await options.onSwipeRight();
          else await options.onSwipeLeft();
          options.onCategoryChange(options.categories[0]);

          // Slide in from opposite side
          animating.value = false;
          swipeOffset.value = right ? -window.innerWidth * 0.25 : window.innerWidth * 0.25;
          await new Promise((r) => requestAnimationFrame(r));
          await animate(0);
        } finally {
          transitioning.value = false;
        }
        return;
      }

      // Category change
      const idx = getCategoryIndex();
      if (right && idx > 0) {
        options.onCategoryChange(options.categories[idx - 1]);
      } else if (!right && idx < options.categories.length - 1) {
        options.onCategoryChange(options.categories[idx + 1]);
      }

      await animate(0);
    },
  });

  return {
    swipeStyle,
    pullDistance,
    refreshing,
    pullThreshold: PULL_THRESHOLD,
    isSwiping,
  };
}
