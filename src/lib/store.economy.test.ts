import { describe, it, expect } from "vitest";
import {
  calculateMlUsed,
  calculateMaxOutputTokens,
  OUTPUT_ML_MULTIPLIER,
  PLAN_LIMITS,
  MODEL_MULTIPLIERS,
} from "./store";

describe("calculateMlUsed", () => {
  it("charges output tokens 6x more than input tokens", () => {
    const inputOnly = calculateMlUsed(6000, 0);
    const outputOnly = calculateMlUsed(0, 1000);
    // 6000 input = 6 mL; 1000 output = 6 mL → equal
    expect(inputOnly).toBe(outputOnly);
  });

  it("uses the documented formula ((in + out*6)/1000 * mult), ceiled", () => {
    // 2000 in + 1000 out = 2000 + 6000 = 8000 raw → 8 mL at mult 1
    expect(calculateMlUsed(2000, 1000)).toBe(8);
  });

  it("applies the model multiplier", () => {
    const base = calculateMlUsed(10000, 0); // 10 mL at mult 1
    const premium = calculateMlUsed(10000, 0, "Claude Opus 4.8"); // mult 2.2
    expect(premium).toBe(Math.ceil(base * 2.2));
  });

  it("never charges less than 1 mL for tiny requests", () => {
    expect(calculateMlUsed(1, 0)).toBe(1);
    expect(calculateMlUsed(0, 0)).toBe(1);
  });

  it("defaults unknown models to a 1x multiplier", () => {
    expect(calculateMlUsed(5000, 0, "some-unknown-model")).toBe(
      calculateMlUsed(5000, 0),
    );
  });

  it("ceils fractional mL up", () => {
    // 100 input → 0.1 mL raw → ceil to 1
    expect(calculateMlUsed(100, 0)).toBe(1);
    // 1500 input → 1.5 mL → ceil to 2
    expect(calculateMlUsed(1500, 0)).toBe(2);
  });

  it("keeps OUTPUT_ML_MULTIPLIER at the documented value", () => {
    expect(OUTPUT_ML_MULTIPLIER).toBe(6);
  });
});

describe("calculateMaxOutputTokens", () => {
  it("inverts the output cost (remainingMl * 1000 / 6)", () => {
    expect(calculateMaxOutputTokens(6)).toBe(1000);
    expect(calculateMaxOutputTokens(60)).toBe(10000);
  });

  it("never returns a negative number", () => {
    expect(calculateMaxOutputTokens(-50)).toBe(0);
    expect(calculateMaxOutputTokens(0)).toBe(0);
  });

  it("round-trips approximately with calculateMlUsed for output tokens", () => {
    const remaining = 60;
    const maxOut = calculateMaxOutputTokens(remaining); // 10000
    // Spending exactly maxOut output tokens should cost ~remaining mL
    expect(calculateMlUsed(0, maxOut)).toBe(remaining);
  });
});

describe("PLAN_LIMITS", () => {
  it("escalates daily allowance and project caps by tier", () => {
    expect(PLAN_LIMITS.free.dailyMl).toBeLessThan(PLAN_LIMITS.fresh_pro.dailyMl);
    expect(PLAN_LIMITS.fresh_pro.dailyMl).toBeLessThan(PLAN_LIMITS.pure_ultra.dailyMl);
    expect(PLAN_LIMITS.free.maxProjects).toBeLessThan(PLAN_LIMITS.pure_ultra.maxProjects);
  });

  it("only allows chat transfers on paid plans", () => {
    expect(PLAN_LIMITS.free.maxChatTransfers).toBe(0);
    expect(PLAN_LIMITS.fresh_pro.maxChatTransfers).toBeGreaterThan(0);
  });
});

describe("MODEL_MULTIPLIERS", () => {
  it("prices Opus above the cheap open-weight models", () => {
    expect(MODEL_MULTIPLIERS["Qwen3 Coder Next"]).toBeLessThan(MODEL_MULTIPLIERS["Auto"]);
    expect(MODEL_MULTIPLIERS["Claude Opus 4.8"]).toBeGreaterThan(MODEL_MULTIPLIERS["Claude Haiku 4.5"]);
  });
});
