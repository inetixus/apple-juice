import { describe, it, expect } from "vitest";
import {
  BYOK_PROVIDERS,
  BYOK_PROVIDER_LIST,
  getByokProvider,
  endpointForProvider,
  extraHeadersForProvider,
  storageKeyFor,
} from "./byok-providers";

describe("byok-providers registry", () => {
  it("exposes every registered provider in the ordered list", () => {
    const listIds = BYOK_PROVIDER_LIST.map((p) => p.id).sort();
    const mapIds = Object.keys(BYOK_PROVIDERS).sort();
    expect(listIds).toEqual(mapIds);
  });

  it("has 12 providers including huggingface", () => {
    expect(BYOK_PROVIDER_LIST).toHaveLength(12);
    expect(getByokProvider("huggingface")).toBeDefined();
    expect(getByokProvider("huggingface")?.label).toBe("Hugging Face");
  });

  it("every OpenAI-compatible provider has a concrete https endpoint", () => {
    for (const p of BYOK_PROVIDER_LIST) {
      if (p.openAiCompatible) {
        expect(p.endpoint).toMatch(/^https:\/\//);
      }
    }
  });

  it("google is the only non-OpenAI-compatible provider and has no endpoint", () => {
    const nonCompat = BYOK_PROVIDER_LIST.filter((p) => !p.openAiCompatible);
    expect(nonCompat.map((p) => p.id)).toEqual(["google"]);
    expect(BYOK_PROVIDERS.google.endpoint).toBe("");
  });

  it("each provider's defaultModel is present in its defaultModels list", () => {
    for (const p of BYOK_PROVIDER_LIST) {
      expect(p.defaultModels).toContain(p.defaultModel);
    }
  });

  it("every provider has a logo path set (no nulls)", () => {
    for (const p of BYOK_PROVIDER_LIST) {
      expect(p.logo).not.toBeNull();
      expect(p.logo).toMatch(/^\/icons\//);
    }
  });

  it("getByokProvider resolves known ids and rejects unknown", () => {
    expect(getByokProvider("anthropic")?.label).toBe("Anthropic");
    expect(getByokProvider("huggingface")?.keyPrefixes).toContain("hf_");
    expect(getByokProvider("kiro")).toBeUndefined();
    expect(getByokProvider("")).toBeUndefined();
    expect(getByokProvider(null)).toBeUndefined();
  });

  it("endpointForProvider falls back to OpenAI for unknown ids", () => {
    expect(endpointForProvider("deepseek")).toBe(BYOK_PROVIDERS.deepseek.endpoint);
    expect(endpointForProvider("huggingface")).toContain("huggingface.co");
    expect(endpointForProvider("nope")).toBe(BYOK_PROVIDERS.openai.endpoint);
  });

  it("openrouter gets attribution headers; anthropic gets a version header", () => {
    const or = extraHeadersForProvider("openrouter");
    expect(or["HTTP-Referer"]).toBeTruthy();
    expect(or["X-Title"]).toBeTruthy();

    const an = extraHeadersForProvider("anthropic");
    expect(an["anthropic-version"]).toBeTruthy();

    expect(extraHeadersForProvider("openai")).toEqual({});
    expect(extraHeadersForProvider("huggingface")).toEqual({});
  });

  it("storageKeyFor is namespaced per provider", () => {
    expect(storageKeyFor("openai")).toBe("apple-juice-byok-openai");
    expect(storageKeyFor("huggingface")).toBe("apple-juice-byok-huggingface");
  });
});
