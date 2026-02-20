import { describe, it, expect, vi } from "vitest";

// Test the scoring formula logic directly
// These tests don't call AI models — they verify the math

describe("OQ Scoring Formula", () => {
  const clampDelta = (raw: number): number => {
    const clamped = Math.max(-4, Math.min(4, raw));
    const dampened = clamped * 0.3;
    return Math.round(Math.max(-1.2, Math.min(1.2, dampened)) * 10) / 10;
  };

  it("dampens raw deltas by 0.3", () => {
    expect(clampDelta(3)).toBe(0.9);
    expect(clampDelta(-3)).toBe(-0.9);
  });

  it("caps daily movement at ±1.2", () => {
    expect(clampDelta(5)).toBe(1.2);
    expect(clampDelta(-5)).toBe(-1.2);
    expect(clampDelta(10)).toBe(1.2);
  });

  it("allows zero delta", () => {
    expect(clampDelta(0)).toBe(0);
  });

  it("handles small fractional deltas", () => {
    expect(clampDelta(0.5)).toBe(0.2);
    // Math.round(-1.5) = -1 in JS (rounds toward +Infinity)
    expect(clampDelta(-0.5)).toBe(-0.1);
  });

  describe("score bounds", () => {
    const applyDelta = (prev: number, delta: number): number =>
      Math.round(Math.max(5, Math.min(95, prev + delta)));

    it("cannot go below 5", () => {
      expect(applyDelta(5, -1.2)).toBe(5);
    });

    it("cannot exceed 95", () => {
      expect(applyDelta(95, 1.2)).toBe(95);
    });

    it("applies delta normally within bounds", () => {
      expect(applyDelta(32, 0.9)).toBe(33);
      expect(applyDelta(32, -0.9)).toBe(31);
    });
  });

  describe("decay logic", () => {
    const DECAY_TARGET = 40;
    const DECAY_RATE = 0.1;

    function decayDelta(prevScore: number): number {
      return prevScore > DECAY_TARGET
        ? -DECAY_RATE
        : prevScore < DECAY_TARGET
          ? DECAY_RATE
          : 0;
    }

    it("decays toward target when score is above", () => {
      expect(decayDelta(50)).toBe(-0.1);
      expect(decayDelta(95)).toBe(-0.1);
    });

    it("decays toward target when score is below", () => {
      expect(decayDelta(30)).toBe(0.1);
      expect(decayDelta(5)).toBe(0.1);
    });

    it("no decay when at target", () => {
      expect(decayDelta(40)).toBe(0);
    });
  });

  describe("consensus weighting", () => {
    const MODEL_WEIGHTS = { claude: 0.4, gpt4: 0.3, gemini: 0.3 };

    function weightedAvg(scores: { model: string; delta: number }[]): number {
      let total = 0;
      let weightSum = 0;
      for (const s of scores) {
        const w = s.model.includes("claude")
          ? MODEL_WEIGHTS.claude
          : s.model.includes("gpt")
            ? MODEL_WEIGHTS.gpt4
            : MODEL_WEIGHTS.gemini;
        total += s.delta * w;
        weightSum += w;
      }
      return weightSum > 0 ? total / weightSum : 0;
    }

    it("gives Claude 40% weight", () => {
      const result = weightedAvg([
        { model: "claude-sonnet", delta: 2 },
        { model: "gpt-4o", delta: 0 },
        { model: "gemini-flash", delta: 0 },
      ]);
      expect(result).toBeCloseTo(0.8);
    });

    it("calculates weighted average of all models", () => {
      const result = weightedAvg([
        { model: "claude-sonnet", delta: 1 },
        { model: "gpt-4o", delta: 1 },
        { model: "gemini-flash", delta: 1 },
      ]);
      expect(result).toBeCloseTo(1.0);
    });

    it("handles single model", () => {
      const result = weightedAvg([{ model: "gemini-flash", delta: 2 }]);
      expect(result).toBeCloseTo(2.0);
    });
  });

  describe("retry logic", () => {
    const MAX_RETRIES = 3;

    async function callWithRetry<T>(fn: () => Promise<T>): Promise<T | null> {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          return await fn();
        } catch {
          if (attempt < MAX_RETRIES - 1) {
            // In real code: await setTimeout(1000 * 2^attempt)
          }
        }
      }
      return null;
    }

    it("returns result on first success", async () => {
      const fn = vi.fn().mockResolvedValue("ok");
      const result = await callWithRetry(fn);
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries on failure and returns on eventual success", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValue("ok");
      const result = await callWithRetry(fn);
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("returns null after all retries exhausted", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("fail"));
      const result = await callWithRetry(fn);
      expect(result).toBeNull();
      expect(fn).toHaveBeenCalledTimes(MAX_RETRIES);
    });
  });

  describe("model agreement", () => {
    function calculateAgreement(deltas: number[]): {
      agreement: string;
      spread: number;
    } {
      if (deltas.length < 2) return { agreement: "partial", spread: 0 };
      const spread = Math.max(...deltas) - Math.min(...deltas);
      if (spread < 1.0) return { agreement: "agree", spread };
      if (spread <= 2.5) return { agreement: "mostly_agree", spread };
      return { agreement: "disagree", spread };
    }

    it("returns agree when spread < 1.0", () => {
      expect(calculateAgreement([1, 1.5]).agreement).toBe("agree");
    });

    it("returns mostly_agree when spread <= 2.5", () => {
      expect(calculateAgreement([0, 2]).agreement).toBe("mostly_agree");
    });

    it("returns disagree when spread > 2.5", () => {
      expect(calculateAgreement([-2, 2]).agreement).toBe("disagree");
    });

    it("returns partial for single model", () => {
      expect(calculateAgreement([1]).agreement).toBe("partial");
    });
  });
});
