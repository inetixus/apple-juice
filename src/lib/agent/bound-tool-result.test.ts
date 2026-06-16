import { describe, it, expect } from "vitest";
import { boundToolResult } from "@/lib/agent/agent-loop";

describe("boundToolResult", () => {
  it("returns short content unchanged (no notice)", () => {
    const s = "hello world";
    expect(boundToolResult(s)).toBe(s);
    expect(boundToolResult(s)).not.toMatch(/TRUNCATED/);
  });

  it("returns content exactly at the limit unchanged", () => {
    const s = "x".repeat(100);
    expect(boundToolResult(s, 100)).toBe(s);
  });

  it("truncates and appends an explicit notice when over the limit", () => {
    const s = "x".repeat(250);
    const out = boundToolResult(s, 100);
    // Keeps the first `limit` chars of payload.
    expect(out.startsWith("x".repeat(100))).toBe(true);
    // Adds a clear, model-readable truncation warning with the real total.
    expect(out).toMatch(/OUTPUT TRUNCATED at 100 chars/);
    expect(out).toMatch(/250 total/);
    expect(out).toMatch(/NOT the full content/);
  });
});
