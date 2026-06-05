import { describe, it, expect } from "vitest";
import {
  validateInstancePayload,
  ALLOWED_ACTIONS,
} from "./validate-instance-payload";

describe("validateInstancePayload", () => {
  it("rejects non-objects", () => {
    expect(validateInstancePayload(null).ok).toBe(false);
    expect(validateInstancePayload("nope").ok).toBe(false);
    expect(validateInstancePayload(42).ok).toBe(false);
  });

  it("rejects unknown actions", () => {
    const res = validateInstancePayload({ action: "drop_database" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Unsupported action/);
  });

  it("accepts a well-formed create payload and lowercases the action", () => {
    const res = validateInstancePayload({
      action: "CREATE",
      scriptType: "Script",
      parent: "ServerScriptService",
      name: "MyScript",
      code: "print('hi')",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.payload.action).toBe("create");
  });

  it("normalizes action aliases to canonical snake_case", () => {
    for (const variant of ["runplaytest", "run playtest", "runPlaytest", "RUN_PLAYTEST"]) {
      const res = validateInstancePayload({ action: variant });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.payload.action).toBe("run_playtest");
    }
    const ci = validateInstancePayload({
      action: "createInstance",
      className: "RemoteEvent",
      instanceName: "Evt",
    });
    expect(ci.ok).toBe(true);
    if (ci.ok) expect(ci.payload.action).toBe("create_instance");
  });

  it("requires name and parent for create", () => {
    expect(validateInstancePayload({ action: "create", parent: "X" }).ok).toBe(false);
    expect(validateInstancePayload({ action: "create", name: "Y" }).ok).toBe(false);
  });

  it("rejects invalid script types", () => {
    const res = validateInstancePayload({
      action: "create",
      scriptType: "MalwareScript",
      parent: "ServerScriptService",
      name: "X",
    });
    expect(res.ok).toBe(false);
  });

  it("requires className and instanceName for create_instance", () => {
    expect(
      validateInstancePayload({ action: "create_instance", className: "RemoteEvent" }).ok,
    ).toBe(false);
    expect(
      validateInstancePayload({
        action: "create_instance",
        className: "RemoteEvent",
        instanceName: "BuyItem",
        parent: "ReplicatedStorage",
      }).ok,
    ).toBe(true);
  });

  it("requires oldPath + newName for rename_instance", () => {
    expect(validateInstancePayload({ action: "rename_instance", oldPath: "A" }).ok).toBe(false);
    expect(
      validateInstancePayload({ action: "rename_instance", oldPath: "A", newName: "B" }).ok,
    ).toBe(true);
  });

  it("allows run_playtest with no extra fields", () => {
    expect(validateInstancePayload({ action: "run_playtest" }).ok).toBe(true);
  });

  it("rejects oversized code", () => {
    const huge = "x".repeat(200_001);
    const res = validateInstancePayload({
      action: "create",
      scriptType: "Script",
      parent: "ServerScriptService",
      name: "Big",
      code: huge,
    });
    expect(res.ok).toBe(false);
  });

  it("rejects non-string code", () => {
    const res = validateInstancePayload({
      action: "create",
      scriptType: "Script",
      parent: "ServerScriptService",
      name: "X",
      code: { evil: true },
    });
    expect(res.ok).toBe(false);
  });

  it("rejects overly long names", () => {
    const res = validateInstancePayload({
      action: "create",
      scriptType: "Script",
      parent: "ServerScriptService",
      name: "n".repeat(201),
      code: "",
    });
    expect(res.ok).toBe(false);
  });

  it("exposes exactly the six supported actions", () => {
    expect([...ALLOWED_ACTIONS].sort()).toEqual(
      ["create", "create_instance", "delete", "move_instance", "rename_instance", "run_playtest"].sort(),
    );
  });
});
