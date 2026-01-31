import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useDigest } from "../composables/useDigest";

const DIGEST_LIST = [
  { date: "2025-01-28" },
  { date: "2025-01-27" },
  { date: "2025-01-26" },
];

const DIGEST_JAN_28 = {
  id: "digest-2025-01-28",
  date: "2025-01-28",
  itemCount: 3,
  items: [
    { id: "1", category: "ai", title: "AI News", summary: "Big", sourceName: "HN", sourceUrl: "https://hn.com/1", position: 0 },
  ],
};

const DIGEST_JAN_27 = {
  id: "digest-2025-01-27",
  date: "2025-01-27",
  itemCount: 2,
  items: [],
};

function mockFetch(responses: Record<string, { status: number; body: unknown }>) {
  return vi.fn().mockImplementation((url: string) => {
    for (const [pattern, response] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        return Promise.resolve({
          ok: response.status >= 200 && response.status < 300,
          status: response.status,
          json: () => Promise.resolve(response.body),
        });
      }
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
}

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
    vi.stubGlobal("fetch", mockFetch({
      "/api/digests": { status: 200, body: DIGEST_LIST },
      "/api/digest/2025-01-28": { status: 200, body: DIGEST_JAN_28 },
    }));

    const { digest, fetchToday, loading, error } = useDigest();

    await fetchToday();

    expect(digest.value).not.toBeNull();
    expect(digest.value!.date).toBe("2025-01-28");
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it("fetchToday shows empty state when no digest exists today", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "/api/digests": { status: 200, body: [{ date: "2025-01-27" }] },
    }));

    const { digest, error, fetchToday } = useDigest();

    await fetchToday();

    expect(digest.value).toBeNull();
    expect(error.value).toContain("No digest yet today");
  });

  it("fetchDate loads a specific date", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "/api/digests": { status: 200, body: DIGEST_LIST },
      "/api/digest/2025-01-27": { status: 200, body: DIGEST_JAN_27 },
    }));

    const { digest, fetchDate } = useDigest();

    await fetchDate("2025-01-27");

    expect(digest.value).not.toBeNull();
    expect(digest.value!.date).toBe("2025-01-27");
  });

  it("goToPrevious navigates to older digest", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "/api/digests": { status: 200, body: DIGEST_LIST },
      "/api/digest/2025-01-28": { status: 200, body: DIGEST_JAN_28 },
      "/api/digest/2025-01-27": { status: 200, body: DIGEST_JAN_27 },
    }));

    const { fetchToday, goToPrevious, digest } = useDigest();

    await fetchToday();
    expect(digest.value!.date).toBe("2025-01-28");

    const moved = await goToPrevious();
    expect(moved).toBe(true);
    expect(digest.value!.date).toBe("2025-01-27");
  });

  it("goToNext navigates to newer digest", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "/api/digests": { status: 200, body: DIGEST_LIST },
      "/api/digest/2025-01-28": { status: 200, body: DIGEST_JAN_28 },
      "/api/digest/2025-01-27": { status: 200, body: DIGEST_JAN_27 },
    }));

    const { fetchDate, goToNext, digest } = useDigest();

    await fetchDate("2025-01-27");
    expect(digest.value!.date).toBe("2025-01-27");

    const moved = await goToNext();
    expect(moved).toBe(true);
    expect(digest.value!.date).toBe("2025-01-28");
  });

  it("goToNext shows empty state at newest when today has no digest", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "/api/digests": { status: 200, body: [{ date: "2025-01-27" }, { date: "2025-01-26" }] },
      "/api/digest/2025-01-27": { status: 200, body: DIGEST_JAN_27 },
    }));

    const { fetchDate, goToNext, error } = useDigest();

    await fetchDate("2025-01-27");
    const moved = await goToNext();

    expect(moved).toBe(true);
    expect(error.value).toContain("No digest yet today");
  });

  it("goToPrevious returns false at oldest digest", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "/api/digests": { status: 200, body: [{ date: "2025-01-27" }] },
      "/api/digest/2025-01-27": { status: 200, body: DIGEST_JAN_27 },
    }));

    const { fetchDate, goToPrevious } = useDigest();

    await fetchDate("2025-01-27");
    const moved = await goToPrevious();

    expect(moved).toBe(false);
  });

  it("goToNext returns false when viewing today", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "/api/digests": { status: 200, body: [{ date: "2025-01-27" }] },
    }));

    const { fetchToday, goToNext } = useDigest();

    await fetchToday(); // shows empty state
    const moved = await goToNext();

    expect(moved).toBe(false);
  });

  it("goToPrevious from empty today goes to newest available", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "/api/digests": { status: 200, body: [{ date: "2025-01-27" }] },
      "/api/digest/2025-01-27": { status: 200, body: DIGEST_JAN_27 },
    }));

    const { fetchToday, goToPrevious, digest } = useDigest();

    await fetchToday(); // empty state
    const moved = await goToPrevious();

    expect(moved).toBe(true);
    expect(digest.value!.date).toBe("2025-01-27");
  });

  it("hasPrevious and hasNext reflect navigation boundaries", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "/api/digests": { status: 200, body: DIGEST_LIST },
      "/api/digest/2025-01-28": { status: 200, body: DIGEST_JAN_28 },
    }));

    const { fetchToday, hasPrevious, hasNext } = useDigest();

    await fetchToday();

    // At newest digest (today exists), can go back but not forward
    expect(hasPrevious.value).toBe(true);
    expect(hasNext.value).toBe(false);
  });

  it("handles network errors gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const { fetchToday, error } = useDigest();

    // fetchDigestList silently fails, then shows empty state
    await fetchToday();

    expect(error.value).toBeTruthy();
  });

  it("formattedDate reflects current digest date", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "/api/digests": { status: 200, body: DIGEST_LIST },
      "/api/digest/2025-01-28": { status: 200, body: DIGEST_JAN_28 },
    }));

    const { fetchToday, formattedDate } = useDigest();

    await fetchToday();

    expect(formattedDate.value).toContain("January");
    expect(formattedDate.value).toContain("28");
  });
});
