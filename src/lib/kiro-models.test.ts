import { describe, it, expect } from "vitest";
import {
  KIRO_MODELS,
  findKiroModel,
  resolveKiroModelId,
  kiroMultiplier,
  isKiroModelAvailable,
  kiroModelsForPlan,
  bestKiroModelForPlan,
} from "./kiro-models";

describe("findKiroModel", () => {
  it("matches by display label and by api id, case-insensitively", () => {
    expect(findKiroModel("Claude Opus 4.8")?.id).toBe("claude-opus-4.8");
    expect(findKiroModel("claude-opus-4.8")?.id).toBe("claude-opus-4.8");
    expect(findKiroModel("AUTO")?.label).toBe("Auto");
  });

  it("returns undefined for unknown names", () => {
    expect(findKiroModel("gpt-4o")).toBeUndefined();
    expect(findKiroModel("")).toBeUndefined();
  });
});

describe("resolveKiroModelId", () => {
  it("maps a display label to its api id", () => {
    expect(resolveKiroModelId("Claude Sonnet 4.6")).toBe("claude-sonnet-4.6");
  });
  it("falls back to auto for anything unknown", () => {
    expect(resolveKiroModelId("nonsense-model")).toBe("auto");
  });
});

describe("kiroMultiplier", () => {
  it("returns the published multiplier for known models", () => {
    expect(kiroMultiplier("Claude Opus 4.8")).toBe(2.2);
    expect(kiroMultiplier("Qwen3 Coder Next")).toBe(0.05);
    expect(kiroMultiplier("Auto")).toBe(1.0);
  });
  it("defaults unknown models to 1.0x", () => {
    expect(kiroMultiplier("whatever")).toBe(1.0);
  });
});

describe("plan gating", () => {
  it("free can use Auto/Haiku/Qwen but not Opus or Sonnet", () => {
    expect(isKiroModelAvailable("Auto", "free")).toBe(true);
    expect(isKiroModelAvailable("Claude Haiku 4.5", "free")).toBe(true);
    expect(isKiroModelAvailable("Qwen3 Coder Next", "free")).toBe(true);
    expect(isKiroModelAvailable("Claude Sonnet 4.6", "free")).toBe(false);
    expect(isKiroModelAvailable("Claude Opus 4.8", "free")).toBe(false);
  });

  it("pro can use Sonnet but not Opus", () => {
    expect(isKiroModelAvailable("Claude Sonnet 4.6", "fresh_pro")).toBe(true);
    expect(isKiroModelAvailable("GLM-5", "fresh_pro")).toBe(true);
    expect(isKiroModelAvailable("Claude Opus 4.8", "fresh_pro")).toBe(false);
  });

  it("ultra can use everything", () => {
    for (const m of KIRO_MODELS) {
      expect(isKiroModelAvailable(m.label, "pure_ultra")).toBe(true);
    }
  });

  it("kiroModelsForPlan is monotonic across tiers", () => {
    const free = kiroModelsForPlan("free").length;
    const pro = kiroModelsForPlan("fresh_pro").length;
    const ultra = kiroModelsForPlan("pure_ultra").length;
    expect(free).toBeLessThan(pro);
    expect(pro).toBeLessThan(ultra);
    expect(ultra).toBe(KIRO_MODELS.length);
  });

  it("bestKiroModelForPlan returns a model that tier can actually use", () => {
    for (const plan of ["free", "fresh_pro", "pure_ultra"] as const) {
      const best = bestKiroModelForPlan(plan);
      expect(isKiroModelAvailable(best, plan)).toBe(true);
    }
  });
});
