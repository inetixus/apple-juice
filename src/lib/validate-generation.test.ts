import { describe, it, expect } from "vitest";
import { validateGeneration, type GenScript } from "./validate-generation";

describe("validateGeneration — ordering", () => {
  it("orders instances → modules → scripts → playtest", () => {
    const input: GenScript[] = [
      { action: "create", type: "Script", parent: "ServerScriptService", name: "Server", code: "print(1)" },
      { action: "run_playtest" },
      { action: "create", type: "ModuleScript", parent: "ReplicatedStorage", name: "Config", code: "return {}" },
      { action: "create_instance", className: "RemoteEvent", instanceName: "Buy", parent: "ReplicatedStorage" },
    ];
    const { scripts } = validateGeneration(input);
    const kinds = scripts.map((s) =>
      s.action === "run_playtest"
        ? "playtest"
        : s.action === "create_instance"
          ? "instance"
          : s.type === "ModuleScript"
            ? "module"
            : "script",
    );
    expect(kinds).toEqual(["instance", "module", "script", "playtest"]);
  });

  it("keeps a single trailing playtest even if several are present", () => {
    const input: GenScript[] = [
      { action: "run_playtest" },
      { action: "create", type: "Script", parent: "ServerScriptService", name: "A", code: "print('a')" },
      { action: "run_playtest" },
    ];
    const { scripts } = validateGeneration(input);
    const playtests = scripts.filter((s) => s.action === "run_playtest");
    expect(playtests).toHaveLength(1);
    expect(scripts[scripts.length - 1].action).toBe("run_playtest");
  });

  it("is a stable sort within the same rank", () => {
    const input: GenScript[] = [
      { action: "create", type: "Script", parent: "ServerScriptService", name: "First", code: "print('1')" },
      { action: "create", type: "Script", parent: "ServerScriptService", name: "Second", code: "print('2')" },
    ];
    const { scripts } = validateGeneration(input, { ensurePlaytest: false });
    expect(scripts.map((s) => s.name)).toEqual(["First", "Second"]);
  });

  it("runs set_properties after all create actions so its target exists", () => {
    const input: GenScript[] = [
      { action: "set_properties", path: "Workspace.Tower.Base", properties: { Color: [255, 0, 0] } },
      { action: "create", type: "Script", parent: "ServerScriptService", name: "Main", code: "print('m')" },
      { action: "build_model", name: "Tower", parent: "Workspace", parts: [] },
      { action: "create_instance", className: "Part", instanceName: "Base", parent: "Workspace.Tower" },
    ];
    const { scripts } = validateGeneration(input, { ensurePlaytest: false });
    const setPropsIdx = scripts.findIndex((s) => s.action === "set_properties");
    const lastCreateIdx = Math.max(
      scripts.findIndex((s) => s.action === "build_model"),
      scripts.findIndex((s) => s.action === "create_instance"),
      scripts.findIndex((s) => s.action === "create" || s.action === undefined),
    );
    expect(setPropsIdx).toBeGreaterThan(lastCreateIdx);
  });
});

describe("validateGeneration — print headers", () => {
  it("adds the AppleJuice print header to scripts missing it", () => {
    const { scripts, addedHeaders } = validateGeneration(
      [{ action: "create", type: "Script", parent: "ServerScriptService", name: "Greeter", code: "local x = 1\nprint(x)" }],
      { ensurePlaytest: false },
    );
    expect(addedHeaders).toBe(1);
    expect(scripts[0].code).toContain('print("[AppleJuice] Running Greeter...")');
  });

  it("does not double-add a header that already exists", () => {
    const code = 'print("[AppleJuice] Running X...")\nlocal y = 2';
    const { scripts, addedHeaders } = validateGeneration(
      [{ action: "create", type: "Script", parent: "ServerScriptService", name: "X", code }],
      { ensurePlaytest: false },
    );
    expect(addedHeaders).toBe(0);
    expect(scripts[0].code).toBe(code);
  });

  it("inserts the header after a leading block comment", () => {
    const code = "--[[ My module header ]]\nlocal z = 3";
    const { scripts } = validateGeneration(
      [{ action: "create", type: "Script", parent: "ServerScriptService", name: "Z", code }],
      { ensurePlaytest: false },
    );
    expect(scripts[0].code!.indexOf("--[[")).toBe(0);
    expect(scripts[0].code).toContain('print("[AppleJuice] Running Z...")');
  });

  it("leaves ModuleScripts untouched (they don't self-run)", () => {
    const code = "local M = {}\nreturn M";
    const { scripts, addedHeaders } = validateGeneration(
      [{ action: "create", type: "ModuleScript", parent: "ReplicatedStorage", name: "Mod", code }],
      { ensurePlaytest: false },
    );
    expect(addedHeaders).toBe(0);
    expect(scripts[0].code).toBe(code);
  });
});

describe("validateGeneration — dedupe & warnings", () => {
  it("dedupes repeated create targets, keeping the later (more complete) one", () => {
    const input: GenScript[] = [
      { action: "create", type: "Script", parent: "ServerScriptService", name: "Dup", code: "print('old')" },
      { action: "create", type: "Script", parent: "ServerScriptService", name: "Dup", code: "print('new and longer version here')" },
    ];
    const { scripts, dedupedCount } = validateGeneration(input, { ensurePlaytest: false });
    const dups = scripts.filter((s) => s.name === "Dup");
    expect(dups).toHaveLength(1);
    expect(dedupedCount).toBe(1);
    expect(dups[0].code).toContain("new and longer");
  });

  it("flags placeholder/TODO code with a warning", () => {
    const { warnings } = validateGeneration(
      [{ action: "create", type: "Script", parent: "ServerScriptService", name: "Stub", code: "-- TODO: add the rest of the implementation here later" }],
      { ensurePlaytest: false },
    );
    expect(warnings.some((w) => /placeholder/i.test(w))).toBe(true);
  });

  it("handles an empty action list gracefully", () => {
    const { scripts, addedPlaytest } = validateGeneration([]);
    expect(scripts).toEqual([]);
    expect(addedPlaytest).toBe(false);
  });

  it("does not append a playtest when there is no real work", () => {
    const { scripts, addedPlaytest } = validateGeneration(
      [{ action: "read_script", name: "Something" }],
      { ensurePlaytest: true },
    );
    expect(addedPlaytest).toBe(false);
    expect(scripts.some((s) => s.action === "run_playtest")).toBe(false);
  });
});
