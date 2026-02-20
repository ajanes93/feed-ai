import { describe, it, expect } from "vitest";
import { formatModelName } from "../utils/format";

describe("formatModelName", () => {
  it("formats claude model names", () => {
    expect(formatModelName("claude-sonnet-4-5-20250929")).toBe("Claude");
    expect(formatModelName("claude-opus")).toBe("Claude");
  });

  it("formats gpt model names", () => {
    expect(formatModelName("gpt-4o")).toBe("GPT-4");
    expect(formatModelName("gpt-4-turbo")).toBe("GPT-4");
  });

  it("formats gemini model names", () => {
    expect(formatModelName("gemini-2.0-flash")).toBe("Gemini");
    expect(formatModelName("gemini-pro")).toBe("Gemini");
  });

  it("returns unknown model names as-is", () => {
    expect(formatModelName("llama-3")).toBe("llama-3");
    expect(formatModelName("unknown")).toBe("unknown");
  });
});
