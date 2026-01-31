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

const SWIPE_THRESHOLD = 40;
const VELOCITY_THRESHOLD = 0.3; // px/ms
const SPRING_DURATION = 400;
const PULL_THRESHOLD = 80;

export function useSwipeNavigation(options: SwipeNavigationOptions) {
  const swipeOffset = ref(0);
  const swipeAnimating = ref(false);
  const transitioning = ref(false);
  const pullDistance = ref(0);
  const refreshing = ref(false);

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartScrollTop = 0;
  let lastTouchX = 0;
  let lastTouchTime = 0;
  let isHorizontalSwipe: boolean | null = null;

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
    lastTouchX = touch.clientX;
    lastTouchTime = Date.now();
    isHorizontalSwipe = null;
    swipeAnimating.value = false;
    swipeOffset.value = 0;

    const scrollEl = document.querySelector("[data-scroll-container]");
    touchStartScrollTop = scrollEl?.scrollTop ?? 0;
  }

  function getSwipeContext(dx: number) {
    const catIdx = options.categories.indexOf(options.activeCategory.value);
    const goingRight = dx > 0;
    const isDigestNav =
      (goingRight && catIdx === 0 && options.hasPrevious.value) ||
      (!goingRight && catIdx === options.categories.length - 1 && options.hasNext.value);
    return { catIdx, goingRight, isDigestNav };
  }

  function onTouchMove(e: TouchEvent) {
    const touch = e.touches[0];
    if (!touch || transitioning.value) return;

    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    if (isHorizontalSwipe === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      isHorizontalSwipe = Math.abs(dx) > Math.abs(dy);
    }

    if (!isHorizontalSwipe) {
      if (dy > 0 && !refreshing.value && touchStartScrollTop <= 2) {
        const scrollEl = document.querySelector("[data-scroll-container]");
        if (scrollEl && scrollEl.scrollTop <= 2) {
          pullDistance.value = Math.min(120, dy * 0.4);
        }
      }
      return;
    }

    const { isDigestNav } = getSwipeContext(dx);
    swipeOffset.value = dx * (isDigestNav ? 1 : 0.15);

    lastTouchX = touch.clientX;
    lastTouchTime = Date.now();
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

  async function animateSwipeTransition(goingRight: boolean) {
    transitioning.value = true;
    try {
      swipeAnimating.value = true;
      swipeOffset.value = goingRight ? window.innerWidth : -window.innerWidth;

      await new Promise((r) => setTimeout(r, SPRING_DURATION / 2));

      if (goingRight) {
        await options.onSwipeRight();
      } else {
        await options.onSwipeLeft();
      }

      swipeAnimating.value = false;
      swipeOffset.value = goingRight
        ? -window.innerWidth / 3
        : window.innerWidth / 3;

      await new Promise((r) => requestAnimationFrame(r));
      swipeAnimating.value = true;
      swipeOffset.value = 0;

      await new Promise((r) => setTimeout(r, SPRING_DURATION));
    } finally {
      swipeAnimating.value = false;
      transitioning.value = false;
    }
  }

  async function onTouchEnd(e: TouchEvent) {
    const touch = e.changedTouches[0];
    if (!touch || transitioning.value || !isHorizontalSwipe) {
      swipeOffset.value = 0;
      await handlePullRefresh();
      return;
    }

    const dx = touch.clientX - touchStartX;
    const dt = Math.max(1, Date.now() - lastTouchTime);
    const velocity = (touch.clientX - lastTouchX) / dt;

    const shouldAct =
      Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(velocity) > VELOCITY_THRESHOLD;

    if (shouldAct) {
      const { catIdx, goingRight, isDigestNav } = getSwipeContext(dx);

      if (isDigestNav) {
        await animateSwipeTransition(goingRight);
        // Reset to "all" when navigating to a new digest
        options.onCategoryChange(options.categories[0]);
        return;
      }

      // Otherwise, change category
      if (goingRight && catIdx > 0) {
        options.onCategoryChange(options.categories[catIdx - 1]);
      } else if (!goingRight && catIdx < options.categories.length - 1) {
        options.onCategoryChange(options.categories[catIdx + 1]);
      }
    }

    swipeAnimating.value = true;
    swipeOffset.value = 0;
    setTimeout(() => {
      swipeAnimating.value = false;
    }, SPRING_DURATION);
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
