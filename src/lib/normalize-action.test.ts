import { describe, it, expect } from "vitest";
import {
  normalizeActionName,
  normalizeAction,
  normalizeActions,
} from "./normalize-action";

describe("normalizeActionName", () => {
  it("passes through canonical names", () => {
    expect(normalizeActionName("run_playtest")).toBe("run_playtest");
    expect(normalizeActionName("create_instance")).toBe("create_instance");
  });

  it("normalizes the runplaytest family", () => {
    for (const v of ["runplaytest", "run playtest", "runPlaytest", "RUN-PLAYTEST", "playtest", "test"]) {
      expect(normalizeActionName(v)).toBe("run_playtest");
    }
  });

  it("normalizes instance action variants", () => {
    expect(normalizeActionName("createInstance")).toBe("create_instance");
    expect(normalizeActionName("create-instance")).toBe("create_instance");
    expect(normalizeActionName("insert")).toBe("create_instance");
    expect(normalizeActionName("renameInstance")).toBe("rename_instance");
    expect(normalizeActionName("moveInstance")).toBe("move_instance");
  });

  it("maps create/delete synonyms", () => {
    expect(normalizeActionName("write")).toBe("create");
    expect(normalizeActionName("remove")).toBe("delete");
    expect(normalizeActionName("destroy")).toBe("delete");
  });

  it("returns null for unknown actions", () => {
    expect(normalizeActionName("frobnicate")).toBeNull();
    expect(normalizeActionName(42 as any)).toBeNull();
    expect(normalizeActionName(undefined)).toBeNull();
  });
});

describe("normalizeAction", () => {
  it("canonicalizes action + field names", () => {
    const out = normalizeAction({
      action: "createInstance",
      ClassName: "RemoteEvent",
      Name: "BuyEvent",
      parent: "ReplicatedStorage",
    });
    expect(out).not.toBeNull();
    expect(out!.action).toBe("create_instance");
    expect(out!.className).toBe("RemoteEvent");
    expect(out!.name).toBe("BuyEvent");
    expect(out!.instanceName).toBe("BuyEvent");
  });

  it("coerces Source/Content to code and scriptType to type", () => {
    const out = normalizeAction({ action: "create", Source: "print('hi')", scriptType: "LocalScript", name: "X", parent: "StarterGui" });
    expect(out!.code).toBe("print('hi')");
    expect(out!.type).toBe("LocalScript");
  });

  it("drops unrecognized actions (returns null)", () => {
    expect(normalizeAction({ action: "nonsense" })).toBeNull();
  });
});

describe("normalizeActions", () => {
  it("normalizes valid and drops invalid", () => {
    const res = normalizeActions([
      { action: "runplaytest" },
      { action: "???" },
      { action: "create", name: "A", parent: "ServerScriptService", code: "x" },
    ]);
    expect(res.length).toBe(2);
    expect(res[0].action).toBe("run_playtest");
    expect(res[1].action).toBe("create");
  });
});
