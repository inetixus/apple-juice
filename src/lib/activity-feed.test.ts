import { describe, it, expect } from "vitest";
import { buildActivityFeed, kindVerb } from "./activity-feed";

describe("buildActivityFeed", () => {
  it("leads with a thinking step only when reasoning is present", () => {
    const withThinking = buildActivityFeed({
      thinking: "I should add a remote and a server script.",
      scripts: [{ action: "create", type: "Script", parent: "ServerScriptService", name: "S" }],
    });
    expect(withThinking[0].kind).toBe("thinking");

    const withoutThinking = buildActivityFeed({
      scripts: [{ action: "create", type: "Script", parent: "ServerScriptService", name: "S" }],
    });
    expect(withoutThinking[0].kind).toBe("writing");
  });

  it("maps each action type to the right activity kind", () => {
    const feed = buildActivityFeed({
      scripts: [
        { action: "read_script", name: "Existing" },
        { action: "create_instance", className: "RemoteEvent", instanceName: "Buy", parent: "ReplicatedStorage" },
        { action: "create", type: "ModuleScript", parent: "ReplicatedStorage", name: "Config" },
        { action: "edit_script", name: "Existing", parent: "ServerScriptService" },
        { action: "delete", name: "Old", parent: "Workspace" },
        { action: "move_instance", oldPath: "Workspace.Part", newParentPath: "ServerStorage" },
        { action: "rename_instance", oldPath: "Workspace.A", newName: "B" },
        { action: "run_playtest" },
      ],
    });
    expect(feed.map((s) => s.kind)).toEqual([
      "reading",
      "creating",
      "writing",
      "editing",
      "deleting",
      "moving",
      "moving",
      "playtesting",
    ]);
  });

  it("includes a human-readable label and detail path", () => {
    const [step] = buildActivityFeed({
      scripts: [{ action: "create", type: "LocalScript", parent: "StarterGui", name: "ShopClient" }],
    });
    expect(step.label).toContain("ShopClient");
    expect(step.label.toLowerCase()).toContain("writing");
    expect(step.detail).toBe("StarterGui");
    expect(step.done).toBe(false);
  });

  it("ignores stop_playtest and unknown actions", () => {
    const feed = buildActivityFeed({
      scripts: [
        { action: "stop_playtest" },
        { action: "totally_unknown" },
        { action: "create", type: "Script", parent: "ServerScriptService", name: "Keep" },
      ],
    });
    expect(feed).toHaveLength(1);
    expect(feed[0].label).toContain("Keep");
  });

  it("returns an empty feed for an empty plan", () => {
    expect(buildActivityFeed({})).toEqual([]);
    expect(buildActivityFeed({ scripts: [] })).toEqual([]);
  });

  it("kindVerb gives a present-tense verb", () => {
    expect(kindVerb("writing")).toBe("Writing");
    expect(kindVerb("playtesting")).toBe("Playtesting");
    expect(kindVerb("creating")).toBe("Creating");
  });
});
