import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useDigest } from "../composables/useDigest";
import { digestFactory, digestItemFactory } from "./factories";
import { stubFetchResponses } from "./helpers";

const DIGEST_JAN_28 = digestFactory.build({
  date: "2025-01-28",
  items: [digestItemFactory.build({ category: "ai", title: "AI News" })],
});

const DIGEST_JAN_27 = digestFactory.build({
  date: "2025-01-27",
  items: [],
});

const DIGEST_LIST = [
  { date: "2025-01-28" },
  { date: "2025-01-27" },
  { date: "2025-01-26" },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-28T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useDigest", () => {
  it("fetchToday loads today's digest when available", async () => {
    stubFetchResponses({
      "/api/digests": { status: 200, body: DIGEST_LIST },
      "/api/digest/2025-01-28": { status: 200, body: DIGEST_JAN_28 },
    });

    const { digest, fetchToday, loading, error } = useDigest();
    await fetchToday();

    expect(digest.value).not.toBeNull();
    expect(digest.value!.date).toBe("2025-01-28");
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it("fetchToday shows empty state when no digest exists today", async () => {
    stubFetchResponses({
      "/api/digests": { status: 200, body: [{ date: "2025-01-27" }] },
    });

    const { digest, error, fetchToday } = useDigest();
    await fetchToday();

    expect(digest.value).toBeNull();
    expect(error.value).toContain("No digest yet today");
  });

  it("fetchDate loads a specific date", async () => {
    stubFetchResponses({
      "/api/digests": { status: 200, body: DIGEST_LIST },
      "/api/digest/2025-01-27": { status: 200, body: DIGEST_JAN_27 },
    });

    const { digest, fetchDate } = useDigest();
    await fetchDate("2025-01-27");

    expect(digest.value).not.toBeNull();
    expect(digest.value!.date).toBe("2025-01-27");
  });

  it("goToPrevious navigates to older digest", async () => {
    stubFetchResponses({
      "/api/digests": { status: 200, body: DIGEST_LIST },
      "/api/digest/2025-01-28": { status: 200, body: DIGEST_JAN_28 },
      "/api/digest/2025-01-27": { status: 200, body: DIGEST_JAN_27 },
    });

    const { fetchToday, goToPrevious, digest } = useDigest();
    await fetchToday();
    expect(digest.value!.date).toBe("2025-01-28");

    const moved = await goToPrevious();
    expect(moved).toBe(true);
    expect(digest.value!.date).toBe("2025-01-27");
  });

  it("goToNext navigates to newer digest", async () => {
    stubFetchResponses({
      "/api/digests": { status: 200, body: DIGEST_LIST },
      "/api/digest/2025-01-28": { status: 200, body: DIGEST_JAN_28 },
      "/api/digest/2025-01-27": { status: 200, body: DIGEST_JAN_27 },
    });

    const { fetchDate, goToNext, digest } = useDigest();
    await fetchDate("2025-01-27");
    expect(digest.value!.date).toBe("2025-01-27");

    const moved = await goToNext();
    expect(moved).toBe(true);
    expect(digest.value!.date).toBe("2025-01-28");
  });

  it("goToNext shows empty state at newest when today has no digest", async () => {
    stubFetchResponses({
      "/api/digests": {
        status: 200,
        body: [{ date: "2025-01-27" }, { date: "2025-01-26" }],
      },
      "/api/digest/2025-01-27": { status: 200, body: DIGEST_JAN_27 },
    });

    const { fetchDate, goToNext, error } = useDigest();
    await fetchDate("2025-01-27");
    const moved = await goToNext();

    expect(moved).toBe(true);
    expect(error.value).toContain("No digest yet today");
  });

  it("goToPrevious returns false at oldest digest", async () => {
    stubFetchResponses({
      "/api/digests": { status: 200, body: [{ date: "2025-01-27" }] },
      "/api/digest/2025-01-27": { status: 200, body: DIGEST_JAN_27 },
    });

    const { fetchDate, goToPrevious } = useDigest();
    await fetchDate("2025-01-27");
    const moved = await goToPrevious();

    expect(moved).toBe(false);
  });

  it("goToNext returns false when viewing today", async () => {
    stubFetchResponses({
      "/api/digests": { status: 200, body: [{ date: "2025-01-27" }] },
    });

    const { fetchToday, goToNext } = useDigest();
    await fetchToday();
    const moved = await goToNext();

    expect(moved).toBe(false);
  });

  it("goToPrevious from empty today goes to newest available", async () => {
    stubFetchResponses({
      "/api/digests": { status: 200, body: [{ date: "2025-01-27" }] },
      "/api/digest/2025-01-27": { status: 200, body: DIGEST_JAN_27 },
    });

    const { fetchToday, goToPrevious, digest } = useDigest();
    await fetchToday();
    const moved = await goToPrevious();

    expect(moved).toBe(true);
    expect(digest.value!.date).toBe("2025-01-27");
  });

  it("hasPrevious and hasNext reflect navigation boundaries", async () => {
    stubFetchResponses({
      "/api/digests": { status: 200, body: DIGEST_LIST },
      "/api/digest/2025-01-28": { status: 200, body: DIGEST_JAN_28 },
    });

    const { fetchToday, hasPrevious, hasNext } = useDigest();
    await fetchToday();

    expect(hasPrevious.value).toBe(true);
    expect(hasNext.value).toBe(false);
  });

  it("handles network errors gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );

    const { fetchToday, error } = useDigest();
    await fetchToday();

    expect(error.value).toBeTruthy();
  });

  it("formattedDate reflects current digest date", async () => {
    stubFetchResponses({
      "/api/digests": { status: 200, body: DIGEST_LIST },
      "/api/digest/2025-01-28": { status: 200, body: DIGEST_JAN_28 },
    });

    const { fetchToday, formattedDate } = useDigest();
    await fetchToday();

    expect(formattedDate.value).toContain("January");
    expect(formattedDate.value).toContain("28");
  });
});
