import { describe, it, expect } from "vitest";
import {
  SCRIPT_SNIPPETS,
  getRelevantSnippets,
  buildSnippetsContextBlock,
} from "./snippets";

describe("SCRIPT_SNIPPETS", () => {
  it("registers every script from the list", () => {
    expect(SCRIPT_SNIPPETS.length).toBe(62);
  });

  it("every snippet has code, keywords, and a valid scriptType + parent", () => {
    for (const s of SCRIPT_SNIPPETS) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.code.trim().length).toBeGreaterThan(0);
      expect(s.keywords.length).toBeGreaterThan(0);
      expect(["Script", "LocalScript", "ModuleScript"]).toContain(s.scriptType);
      expect(s.parent.length).toBeGreaterThan(0);
    }
  });

  it("snippet names are unique", () => {
    const names = SCRIPT_SNIPPETS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("retrieves the kill brick for a kill-brick prompt", () => {
    const hits = getRelevantSnippets("make a kill brick that kills players");
    expect(hits[0]?.name).toBe("Kill Brick");
  });

  it("retrieves a teleporter for a teleport prompt", () => {
    const hits = getRelevantSnippets("add a teleporter pad");
    expect(hits.some((s) => s.name === "Teleporter Pair")).toBe(true);
  });

  it("returns empty for an unrelated prompt", () => {
    expect(getRelevantSnippets("")).toEqual([]);
  });

  it("builds a context block only when something matches", () => {
    expect(buildSnippetsContextBlock("sprint system")).toContain("Sprint");
    expect(buildSnippetsContextBlock("")).toBe("");
  });
});
