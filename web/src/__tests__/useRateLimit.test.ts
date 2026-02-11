import { describe, it, expect, beforeEach, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { mockTimestamps } = vi.hoisted((): { mockTimestamps: any } => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require("vue");
  return { mockTimestamps: ref([]) };
});
vi.mock("@vueuse/core", () => ({
  useSessionStorage: () => mockTimestamps,
}));

import { useRateLimit } from "../composables/useRateLimit";

beforeEach(() => {
  mockTimestamps.value = [];
});

describe("useRateLimit", () => {
  it("starts with 5 remaining", () => {
    const { remaining } = useRateLimit();
    expect(remaining.value).toBe(5);
  });

  it("allows first request", () => {
    const { check } = useRateLimit();
    expect(check().ok).toBe(true);
  });

  it("decrements remaining after record", () => {
    const { record, remaining } = useRateLimit();
    record();
    expect(remaining.value).toBe(4);
  });

  it("blocks after 5 requests", () => {
    const { check, record } = useRateLimit();

    for (let i = 0; i < 5; i++) {
      expect(check().ok).toBe(true);
      record();
    }

    const result = check();
    expect(result.ok).toBe(false);
    expect(result.waitSeconds).toBeGreaterThan(0);
  });

  it("expires old timestamps", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    const { record, remaining, check } = useRateLimit();

    for (let i = 0; i < 5; i++) {
      record();
    }
    expect(remaining.value).toBe(0);
    expect(check().ok).toBe(false);

    // Advance past 24h window
    vi.setSystemTime(now + 86400001);
    expect(check().ok).toBe(true);
    expect(remaining.value).toBe(5);

    vi.useRealTimers();
  });

  it("stores timestamps in the ref", () => {
    const { record } = useRateLimit();
    record();
    expect(mockTimestamps.value).toHaveLength(1);
  });
});
