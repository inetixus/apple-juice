import { describe, it, expect } from "vitest";
import { ROBLOX_PRODUCTS, findProduct } from "./roblox-products";

describe("roblox-products registry", () => {
  it("resolves products by string and numeric id", () => {
    expect(findProduct("EXP-6181762863565242936")?.plan).toBe("fresh_pro");
    expect(findProduct("EXP-2786378855714259452")?.plan).toBe("pure_ultra");
    expect(findProduct("3585218786")?.bonusMl).toBe(20_000);
    expect(findProduct(3585218786)?.label).toBe("Juice Box");
  });

  it("returns undefined for unknown / empty ids", () => {
    expect(findProduct("nope")).toBeUndefined();
    expect(findProduct("")).toBeUndefined();
    expect(findProduct(null)).toBeUndefined();
    expect(findProduct(undefined)).toBeUndefined();
  });

  it("every product has exactly one grant type (plan XOR bonusMl)", () => {
    for (const p of ROBLOX_PRODUCTS) {
      const hasPlan = !!p.plan;
      const hasMl = !!p.bonusMl && p.bonusMl > 0;
      expect(hasPlan !== hasMl).toBe(true);
    }
  });

  it("subscription products grant plans; developer products grant mL", () => {
    for (const p of ROBLOX_PRODUCTS) {
      if (p.kind === "subscription") expect(p.plan).toBeTruthy();
      if (p.kind === "developerProduct") expect(p.bonusMl).toBeGreaterThan(0);
    }
  });

  it("has no duplicate ids", () => {
    const ids = ROBLOX_PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
