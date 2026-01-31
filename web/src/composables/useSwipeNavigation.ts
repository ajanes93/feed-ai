import { ref, computed, type Ref } from "vue";

interface SwipeNavigationOptions {
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
const VELOCITY_THRESHOLD = 0.25; // px/ms
const PULL_THRESHOLD = 80;

export function useSwipeNavigation(options: SwipeNavigationOptions) {
  const swipeOffset = ref(0);
  const isAnimating = ref(false);
  const transitioning = ref(false);
  const pullDistance = ref(0);
  const refreshing = ref(false);

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartScrollTop = 0;
  let touchStartTime = 0;
  let isHorizontalSwipe: boolean | null = null;
  let rafId = 0;
  let pendingOffset = 0;

  const swipeStyle = computed(() => {
    if (swipeOffset.value === 0 && !isAnimating.value) return {};
    const offset = swipeOffset.value;
    const absOffset = Math.abs(offset);
    const opacity = Math.max(0.3, 1 - absOffset / 400);
    const scale = Math.max(0.95, 1 - absOffset / 3000);

    return {
      transform: `translate3d(${offset}px, 0, 0) scale(${scale})`,
      opacity: String(opacity),
      transition: isAnimating.value
        ? "transform 350ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 350ms cubic-bezier(0.2, 0.9, 0.3, 1)"
        : "none",
      willChange: "transform, opacity",
    };
  });

  function scheduleUpdate(offset: number) {
    pendingOffset = offset;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      swipeOffset.value = pendingOffset;
    });
  }

  function onTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    if (!touch || transitioning.value) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
    isHorizontalSwipe = null;
    isAnimating.value = false;
    swipeOffset.value = 0;

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    const scrollEl = document.querySelector("[data-scroll-container]");
    touchStartScrollTop = scrollEl?.scrollTop ?? 0;
  }

  function getSwipeContext(dx: number) {
    const catIdx = options.categories.indexOf(options.activeCategory.value);
    const goingRight = dx > 0;
    const isDigestNav =
      (goingRight && catIdx === 0 && options.hasPrevious.value) ||
      (!goingRight &&
        catIdx === options.categories.length - 1 &&
        options.hasNext.value);
    return { catIdx, goingRight, isDigestNav };
  }

  function onTouchMove(e: TouchEvent) {
    const touch = e.touches[0];
    if (!touch || transitioning.value) return;

    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    // Determine direction lock on first significant movement
    if (isHorizontalSwipe === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      isHorizontalSwipe = Math.abs(dx) > Math.abs(dy) * 1.2;
    }

    // Pull-to-refresh (vertical)
    if (!isHorizontalSwipe) {
      if (dy > 0 && !refreshing.value && touchStartScrollTop <= 2) {
        const scrollEl = document.querySelector("[data-scroll-container]");
        if (scrollEl && scrollEl.scrollTop <= 2) {
          pullDistance.value = Math.min(120, dy * 0.4);
        }
      }
      return;
    }

    // Prevent vertical scroll while swiping horizontally
    e.preventDefault();

    const { isDigestNav } = getSwipeContext(dx);

    // Full 1:1 tracking for digest nav, damped for category hints
    const offset = isDigestNav ? dx : dx * 0.2;
    scheduleUpdate(offset);
  }

  async function handlePullRefresh() {
    if (pullDistance.value >= PULL_THRESHOLD && !refreshing.value) {
      refreshing.value = true;
      pullDistance.value = 40;
      await options.onPullRefresh();
      refreshing.value = false;
    }
    pullDistance.value = 0;
  }

  function animateOffset(target: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      isAnimating.value = true;
      swipeOffset.value = target;
      setTimeout(() => {
        resolve();
      }, duration);
    });
  }

  async function animateSwipeTransition(goingRight: boolean) {
    transitioning.value = true;
    try {
      // Slide current content off-screen
      await animateOffset(
        goingRight ? window.innerWidth * 0.7 : -window.innerWidth * 0.7,
        300,
      );

      // Perform the data fetch
      if (goingRight) {
        await options.onSwipeRight();
      } else {
        await options.onSwipeLeft();
      }

      // Reset category for new digest
      options.onCategoryChange(options.categories[0]);

      // Position new content on opposite side (no animation)
      isAnimating.value = false;
      swipeOffset.value = goingRight
        ? -window.innerWidth * 0.3
        : window.innerWidth * 0.3;

      // Force layout before animating in
      await new Promise((r) => requestAnimationFrame(r));

      // Animate new content to center
      await animateOffset(0, 350);

      isAnimating.value = false;
    } finally {
      transitioning.value = false;
    }
  }

  async function onTouchEnd(e: TouchEvent) {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }

    const touch = e.changedTouches[0];
    if (!touch || transitioning.value || !isHorizontalSwipe) {
      swipeOffset.value = 0;
      await handlePullRefresh();
      return;
    }

    const dx = touch.clientX - touchStartX;
    const dt = Math.max(1, Date.now() - touchStartTime);
    const velocity = dx / dt;

    const shouldAct =
      Math.abs(dx) > SWIPE_THRESHOLD ||
      Math.abs(velocity) > VELOCITY_THRESHOLD;

    if (shouldAct) {
      const { catIdx, goingRight, isDigestNav } = getSwipeContext(dx);

      if (isDigestNav) {
        await animateSwipeTransition(goingRight);
        return;
      }

      // Category change
      if (goingRight && catIdx > 0) {
        options.onCategoryChange(options.categories[catIdx - 1]);
      } else if (!goingRight && catIdx < options.categories.length - 1) {
        options.onCategoryChange(options.categories[catIdx + 1]);
      }
    }

    // Spring back to center
    await animateOffset(0, 300);
    isAnimating.value = false;
  }

  return {
    swipeStyle,
    pullDistance,
    refreshing,
    pullThreshold: PULL_THRESHOLD,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
