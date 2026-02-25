import { describe, it, expect } from "vitest";
import { parseAmount, fundingDedupeKey } from "../index";

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

  it("handles plain numbers as millions", () => {
    expect(parseAmount("500")).toBe(500);
    expect(parseAmount("$100")).toBe(100);
  });

  it("strips commas", () => {
    expect(parseAmount("$1,500M")).toBe(1500);
    expect(parseAmount("$2,100")).toBe(2100);
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
});

describe("fundingDedupeKey", () => {
  it("normalises company name to lowercase", () => {
    expect(fundingDedupeKey("OpenAI", "$500M")).toBe("openai|$500m");
  });

  it("strips 'up to' prefix from amount", () => {
    expect(fundingDedupeKey("Acme", "up to $500M")).toBe("acme|$500m");
    expect(fundingDedupeKey("Acme", "Up To $500M")).toBe("acme|$500m");
  });

  it("handles null/undefined amount", () => {
    expect(fundingDedupeKey("Acme", null)).toBe("acme|");
    expect(fundingDedupeKey("Acme", undefined)).toBe("acme|");
  });

  it("trims whitespace", () => {
    expect(fundingDedupeKey("  Acme  ", "  $500M  ")).toBe("acme|$500m");
  });

  it("produces same key for equivalent entries", () => {
    const a = fundingDedupeKey("OpenAI", "$500M");
    const b = fundingDedupeKey("openai", "up to $500M");
    expect(a).toBe(b);
  });
});
