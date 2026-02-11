import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAiChat } from "../composables/useAiChat";
import { stubFetchResponses } from "./helpers";

// Mock FingerprintJS
vi.mock("@fingerprintjs/fingerprintjs", () => ({
  default: {
    load: () =>
      Promise.resolve({
        get: () => Promise.resolve({ visitorId: "test-fingerprint-abc" }),
      }),
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useAiChat", () => {
  it("starts with empty messages", () => {
    const { messages } = useAiChat();
    expect(messages.value).toHaveLength(0);
  });

  it("starts with 5 remaining (client-side)", () => {
    const { remaining } = useAiChat();
    expect(remaining.value).toBe(5);
  });

  it("query adds user message and assistant response", async () => {
    // Wait for fingerprint to initialize
    await vi.advanceTimersByTimeAsync(100);

    stubFetchResponses({
      "/api/ai/chat": {
        status: 200,
        body: { text: "## Daily Briefing\nKey stories today.", remaining: 4 },
      },
    });

    const { query, messages } = useAiChat();
    await query("daily", "Today's briefing");

    expect(messages.value).toHaveLength(2);
    expect(messages.value[0].role).toBe("user");
    expect(messages.value[0].text).toBe("Today's briefing");
    expect(messages.value[1].role).toBe("assistant");
    expect(messages.value[1].text).toContain("Daily Briefing");
  });

  it("updates remaining from server response", async () => {
    await vi.advanceTimersByTimeAsync(100);

    stubFetchResponses({
      "/api/ai/chat": {
        status: 200,
        body: { text: "Response", remaining: 3 },
      },
    });

    const { query, remaining } = useAiChat();
    await query("daily", "Today's briefing");

    expect(remaining.value).toBe(3);
  });

  it("handles API errors gracefully", async () => {
    await vi.advanceTimersByTimeAsync(100);

    stubFetchResponses({
      "/api/ai/chat": {
        status: 429,
        body: { error: "Daily limit reached.", remaining: 0 },
      },
    });

    const { query, error, messages } = useAiChat();
    await query("daily", "Today's briefing");

    expect(error.value).toContain("Daily limit");
    // User message should be removed on error
    expect(messages.value).toHaveLength(0);
  });

  it("reset clears messages and error", async () => {
    await vi.advanceTimersByTimeAsync(100);

    stubFetchResponses({
      "/api/ai/chat": {
        status: 200,
        body: { text: "Response", remaining: 4 },
      },
    });

    const { query, reset, messages, error } = useAiChat();
    await query("daily", "Today's briefing");
    expect(messages.value).toHaveLength(2);

    reset();
    expect(messages.value).toHaveLength(0);
    expect(error.value).toBeNull();
  });

  it("tracks used prompt keys", async () => {
    await vi.advanceTimersByTimeAsync(100);

    stubFetchResponses({
      "/api/ai/chat": {
        status: 200,
        body: { text: "Response", remaining: 4 },
      },
    });

    const { query, usedPrompts } = useAiChat();
    await query("daily", "Today's briefing");

    expect(usedPrompts.value.has("daily")).toBe(true);
    expect(usedPrompts.value.has("weekly")).toBe(false);
  });

  it("prevents concurrent queries", async () => {
    await vi.advanceTimersByTimeAsync(100);

    let resolveChat: ((value: unknown) => void) | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveChat = resolve;
          })
      )
    );

    const { query, loading } = useAiChat();
    const p1 = query("daily", "Today's briefing");

    expect(loading.value).toBe(true);
    // Second query should be ignored while loading
    const p2 = query("weekly", "This week");

    // Resolve the pending request
    resolveChat!({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ text: "Response", remaining: 4 }),
    });

    await p1;
    await p2;
    expect(loading.value).toBe(false);
  });
});
