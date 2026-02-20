import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { timeAgo, formatTokens } from "../utils";

describe("timeAgo", () => {
  let now: number;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-28T12:00:00Z"));
    now = Math.floor(Date.now() / 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Never" for null', () => {
    expect(timeAgo(null)).toBe("Never");
  });

  it('returns "Never" for 0', () => {
    expect(timeAgo(0)).toBe("Never");
  });

  it("returns seconds ago for recent timestamps", () => {
    expect(timeAgo(now - 45)).toBe("45s ago");
  });

  it("returns minutes ago", () => {
    expect(timeAgo(now - 120)).toBe("2m ago");
  });

  it("returns hours ago", () => {
    expect(timeAgo(now - 3600 * 8)).toBe("8h ago");
  });

  it("returns days ago", () => {
    expect(timeAgo(now - 86400 * 3)).toBe("3d ago");
  });
});

describe("formatTokens", () => {
  it('returns "-" for null', () => {
    expect(formatTokens(null)).toBe("-");
  });

  it("returns plain number for values under 1000", () => {
    expect(formatTokens(500)).toBe("500");
  });

  it("formats thousands with k suffix", () => {
    expect(formatTokens(1500)).toBe("1.5k");
  });

  it("formats exact thousands", () => {
    expect(formatTokens(2000)).toBe("2.0k");
  });

  it("returns 0 as string", () => {
    expect(formatTokens(0)).toBe("0");
  });
});
