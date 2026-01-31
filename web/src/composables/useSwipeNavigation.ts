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
const VELOCITY_THRESHOLD = 0.3; // px/ms
const PULL_THRESHOLD = 80;

// Clamp helper
function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

// Rubber-band dampening: feels like pulling against resistance
function rubberBand(offset: number, limit: number): number {
  const sign = offset < 0 ? -1 : 1;
  const abs = Math.abs(offset);
  // Asymptotic dampening — never exceeds limit
  return sign * limit * (1 - Math.exp(-abs / limit));
}

export function useSwipeNavigation(options: SwipeNavigationOptions) {
  const swipeOffset = ref(0);
  const isAnimating = ref(false);
  const transitioning = ref(false);
  const pullDistance = ref(0);
  const refreshing = ref(false);

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartScrollTop = 0;
  let isHorizontalSwipe: boolean | null = null;
  let rafId = 0;
  let pendingOffset = 0;

  // Track velocity with last N samples for smoothness
  let velocitySamples: Array<{ x: number; t: number }> = [];

  const swipeStyle = computed(() => {
    if (swipeOffset.value === 0 && !isAnimating.value) return {};
    const offset = swipeOffset.value;
    const absOffset = Math.abs(offset);
    const opacity = clamp(1 - absOffset / 500, 0.2, 1);
    const scale = clamp(1 - absOffset / 4000, 0.93, 1);

    return {
      transform: `translate3d(${offset}px, 0, 0) scale(${scale})`,
      opacity: String(opacity),
      transition: isAnimating.value
        ? "transform 380ms cubic-bezier(0.25, 1, 0.5, 1), opacity 380ms cubic-bezier(0.25, 1, 0.5, 1)"
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

  function recordVelocity(x: number) {
    const now = performance.now();
    velocitySamples.push({ x, t: now });
    // Keep only last 100ms of samples
    const cutoff = now - 100;
    velocitySamples = velocitySamples.filter((s) => s.t >= cutoff);
  }

  function getVelocity(): number {
    if (velocitySamples.length < 2) return 0;
    const first = velocitySamples[0];
    const last = velocitySamples[velocitySamples.length - 1];
    const dt = last.t - first.t;
    if (dt === 0) return 0;
    return (last.x - first.x) / dt; // px/ms
  }

  function onTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    if (!touch || transitioning.value) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    isHorizontalSwipe = null;
    velocitySamples = [];

    // Allow interrupting a spring-back animation
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

    // Can we navigate digests in this direction?
    const canNavDigest =
      (goingRight && options.hasPrevious.value) ||
      (!goingRight && options.hasNext.value);

    // At category boundary heading toward digest nav?
    const atCategoryBoundary =
      (goingRight && catIdx === 0) ||
      (!goingRight && catIdx === options.categories.length - 1);

    const isDigestNav = atCategoryBoundary && canNavDigest;
    const isRubberBand = atCategoryBoundary && !canNavDigest;

    return { catIdx, goingRight, isDigestNav, isRubberBand };
  }

  function onTouchMove(e: TouchEvent) {
    const touch = e.touches[0];
    if (!touch || transitioning.value) return;

    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    // Direction lock on first significant movement
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

    e.preventDefault();
    recordVelocity(touch.clientX);

    const { isDigestNav, isRubberBand } = getSwipeContext(dx);

    let offset: number;
    if (isDigestNav) {
      // 1:1 finger tracking for digest navigation
      offset = dx;
    } else if (isRubberBand) {
      // Rubber-band at boundaries — feels like resistance
      offset = rubberBand(dx, 80);
    } else {
      // Category hint — dampened tracking
      offset = dx * 0.25;
    }

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

  function waitForTransition(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, durationMs + 20); // small buffer for paint
    });
  }

  async function springBack() {
    isAnimating.value = true;
    swipeOffset.value = 0;
    await waitForTransition(380);
    isAnimating.value = false;
  }

  async function animateSwipeTransition(
    goingRight: boolean,
    velocity: number,
  ) {
    transitioning.value = true;
    try {
      // Calculate exit distance based on velocity — faster swipe = further exit
      const exitDistance =
        Math.max(0.6, Math.min(1, Math.abs(velocity) * 2)) *
        window.innerWidth;

      // Slide current content off-screen
      isAnimating.value = true;
      swipeOffset.value = goingRight ? exitDistance : -exitDistance;
      await waitForTransition(380);

      // Fetch new data
      if (goingRight) {
        await options.onSwipeRight();
      } else {
        await options.onSwipeLeft();
      }

      // Reset category
      options.onCategoryChange(options.categories[0]);

      // Position new content on opposite side (instant)
      isAnimating.value = false;
      swipeOffset.value = goingRight
        ? -window.innerWidth * 0.25
        : window.innerWidth * 0.25;

      // Wait one frame for layout
      await new Promise((r) => requestAnimationFrame(r));

      // Animate new content to center
      isAnimating.value = true;
      swipeOffset.value = 0;
      await waitForTransition(380);

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
      if (!transitioning.value) swipeOffset.value = 0;
      await handlePullRefresh();
      return;
    }

    const dx = touch.clientX - touchStartX;
    const velocity = getVelocity();
    velocitySamples = [];

    const shouldAct =
      Math.abs(dx) > SWIPE_THRESHOLD ||
      Math.abs(velocity) > VELOCITY_THRESHOLD;

    if (shouldAct) {
      const { catIdx, goingRight, isDigestNav } = getSwipeContext(dx);

      if (isDigestNav) {
        await animateSwipeTransition(goingRight, velocity);
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
    await springBack();
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
