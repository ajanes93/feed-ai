import { describe, it, expect } from "vitest";
import { parseAmount, fundingDedupeKey, bucketAmount } from "../index";

describe("parseAmount", () => {
  it("parses dollar billions", () => {
    expect(parseAmount("$2.1B")).toBe(2100);
    expect(parseAmount("$1B")).toBe(1000);
  });

  it("parses dollar millions", () => {
    expect(parseAmount("$500M")).toBe(500);
    expect(parseAmount("$12.5M")).toBe(12.5);
  });

  it("parses dollar thousands", () => {
    expect(parseAmount("$800K")).toBe(0.8);
  });

  it("handles lowercase units", () => {
    expect(parseAmount("$2.1b")).toBe(2100);
    expect(parseAmount("$500m")).toBe(500);
    expect(parseAmount("$800k")).toBe(0.8);
  });

  it("handles amounts without dollar sign", () => {
    expect(parseAmount("500M")).toBe(500);
    expect(parseAmount("2.1B")).toBe(2100);
  });

  it("handles small plain numbers as millions", () => {
    expect(parseAmount("500")).toBe(500);
    expect(parseAmount("$100")).toBe(100);
  });

  it("treats large bare numbers as raw dollars", () => {
    // "$500,000" → comma-stripped "500000" → 0.5M
    expect(parseAmount("$500,000")).toBeCloseTo(0.5);
    expect(parseAmount("$2,000,000")).toBe(2);
    expect(parseAmount("50000000")).toBe(50);
  });

  it("strips commas with explicit units", () => {
    expect(parseAmount("$1,500M")).toBe(1500);
    expect(parseAmount("$2,100M")).toBe(2100);
  });

  it("returns 0 for null/undefined/empty", () => {
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
    expect(parseAmount("")).toBe(0);
  });

  it("returns 0 for non-numeric strings", () => {
    expect(parseAmount("unknown")).toBe(0);
    expect(parseAmount("N/A")).toBe(0);
  });

  it("ignores non-USD currency symbols", () => {
    expect(parseAmount("€500M")).toBe(0);
    expect(parseAmount("£200M")).toBe(0);
  });

  it("parses spelled-out billion", () => {
    expect(parseAmount("$100 billion")).toBe(100_000);
    expect(parseAmount("$6.6 billion")).toBe(6600);
    expect(parseAmount("100 billion")).toBe(100_000);
    expect(parseAmount("$2.1 Billion")).toBe(2100);
  });

  it("parses spelled-out million", () => {
    expect(parseAmount("$500 million")).toBe(500);
    expect(parseAmount("$12.5 million")).toBe(12.5);
    expect(parseAmount("250 Million")).toBe(250);
  });

  it("parses spelled-out thousand", () => {
    expect(parseAmount("$800 thousand")).toBe(0.8);
    expect(parseAmount("500 Thousand")).toBe(0.5);
  });

  it("parses trillion amounts", () => {
    expect(parseAmount("$1T")).toBe(1_000_000);
    expect(parseAmount("$1.5 trillion")).toBe(1_500_000);
    expect(parseAmount("$0.5T")).toBe(500_000);
    expect(parseAmount("2 Trillion")).toBe(2_000_000);
  });

  it("handles leading whitespace", () => {
    expect(parseAmount("  $500M")).toBe(500);
    expect(parseAmount("  $2.1B  ")).toBe(2100);
  });

  it("returns 0 for 'up to' prefix (stripped by fundingDedupeKey, not parseAmount)", () => {
    expect(parseAmount("up to $500M")).toBe(0);
  });
});

describe("fundingDedupeKey", () => {
  it("normalises company name to lowercase", () => {
    expect(fundingDedupeKey("OpenAI", "$500M")).toBe("openai|500");
  });

  it("strips 'up to' prefix from amount", () => {
    expect(fundingDedupeKey("Acme", "up to $500M")).toBe("acme|500");
    expect(fundingDedupeKey("Acme", "Up To $500M")).toBe("acme|500");
  });

  it("handles null/undefined amount", () => {
    expect(fundingDedupeKey("Acme", null)).toBe("acme|");
    expect(fundingDedupeKey("Acme", undefined)).toBe("acme|");
  });

  it("trims whitespace", () => {
    expect(fundingDedupeKey("  Acme  ", "  $500M  ")).toBe("acme|500");
  });

  it("produces same key for equivalent entries", () => {
    const a = fundingDedupeKey("OpenAI", "$500M");
    const b = fundingDedupeKey("openai", "up to $500M");
    expect(a).toBe(b);
  });

  it("normalises different amount formats to same key", () => {
    // $100B, $100 billion, $100,000M should all produce the same key
    const a = fundingDedupeKey("Meta", "$100B");
    const b = fundingDedupeKey("Meta", "$100 billion");
    const c = fundingDedupeKey("Meta", "$100,000M");
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toBe("meta|100000"); // 100B = 100,000M
  });

  it("falls back to lowercased string for unparseable amounts", () => {
    expect(fundingDedupeKey("Acme", "undisclosed")).toBe("acme|undisclosed");
    expect(fundingDedupeKey("Acme", "N/A")).toBe("acme|n/a");
  });

  it("strips 'more than' prefix from amount", () => {
    expect(fundingDedupeKey("OpenAI", "more than $100 billion")).toBe(
      "openai|100000"
    );
  });

  it("strips 'at least' prefix from amount", () => {
    expect(fundingDedupeKey("Acme", "at least $500M")).toBe("acme|500");
  });

  it("strips 'approximately' prefix from amount", () => {
    expect(fundingDedupeKey("Acme", "approximately $2B")).toBe("acme|2000");
  });

  it("strips 'nearly' and 'almost' prefixes", () => {
    expect(fundingDedupeKey("Acme", "nearly $1B")).toBe("acme|1000");
    expect(fundingDedupeKey("Acme", "almost $1B")).toBe("acme|1000");
  });

  it("strips 'over' and 'around' and 'about' prefixes", () => {
    expect(fundingDedupeKey("Acme", "over $500M")).toBe("acme|500");
    expect(fundingDedupeKey("Acme", "around $500M")).toBe("acme|500");
    expect(fundingDedupeKey("Acme", "about $500M")).toBe("acme|500");
  });

  it("strips 'roughly' prefix from amount", () => {
    expect(fundingDedupeKey("Acme", "roughly $2.5B")).toBe("acme|2500");
  });

  it("deduplicates 'more than $100 billion' vs '$100B'", () => {
    const a = fundingDedupeKey("OpenAI", "more than $100 billion");
    const b = fundingDedupeKey("OpenAI", "$100B");
    expect(a).toBe(b);
  });
});

describe("bucketAmount", () => {
  it("returns 0 for zero or negative", () => {
    expect(bucketAmount(0)).toBe(0);
    expect(bucketAmount(-5)).toBe(0);
  });

  it("rounds small amounts (<10M) to nearest integer", () => {
    expect(bucketAmount(7.3)).toBe(7);
    expect(bucketAmount(1.5)).toBe(2);
    expect(bucketAmount(0.8)).toBe(1);
  });

  it("rounds 10-100M to nearest 5", () => {
    expect(bucketAmount(12)).toBe(10);
    expect(bucketAmount(13)).toBe(15);
    expect(bucketAmount(50)).toBe(50);
    expect(bucketAmount(73)).toBe(75);
  });

  it("rounds 100-1000M to nearest 25", () => {
    expect(bucketAmount(500)).toBe(500);
    expect(bucketAmount(112)).toBe(100);
    expect(bucketAmount(113)).toBe(125);
    expect(bucketAmount(988)).toBe(1000);
  });

  it("rounds 1B-10B (1000-10000M) to nearest 250", () => {
    expect(bucketAmount(2100)).toBe(2000);
    expect(bucketAmount(2200)).toBe(2250);
    expect(bucketAmount(6500)).toBe(6500);
    expect(bucketAmount(6600)).toBe(6500);
  });

  it("rounds >=10B (10000M+) to nearest 1000", () => {
    expect(bucketAmount(100_000)).toBe(100_000);
    expect(bucketAmount(105_000)).toBe(105_000);
    expect(bucketAmount(10_500)).toBe(11_000);
  });

  it("buckets $6.5B and $6.6B together", () => {
    expect(bucketAmount(6500)).toBe(bucketAmount(6600));
  });
});
