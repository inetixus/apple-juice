import { describe, it, expect } from "vitest";
import { runPlaytest, type StudioToolResult } from "@/lib/agent/studio-bridge";

// A fake runner lets us drive runPlaytest without the real bridge.
const runnerReturning = (data: string, ok = true) =>
  async (): Promise<StudioToolResult> => ({ ok, data, elapsedMs: 1 });

describe("runPlaytest structured parsing", () => {
  it("parses structured JSON pass", async () => {
    const out = await runPlaytest(
      "s",
      runnerReturning(JSON.stringify({ passed: true, errorCount: 0, errors: [] })),
    );
    expect(out.passed).toBe(true);
  });

  it("formats structured JSON errors with script:line — message", async () => {
    const payload = JSON.stringify({
      passed: false,
      errorCount: 1,
      errors: [
        {
          scriptName: "MainScript",
          scriptPath: "Workspace.MainScript",
          line: 42,
          message: "attempt to index a nil value (local 'playerData')",
          raw: "Workspace.MainScript:42: attempt to index a nil value",
        },
      ],
    });
    const out = await runPlaytest("s", runnerReturning(payload));
    expect(out.passed).toBe(false);
    expect(out.summary).toMatch(/Workspace\.MainScript:42/);
    expect(out.summary).toMatch(/index a nil value/);
    expect(out.errors[0]).toMatch(/Workspace\.MainScript:42/);
  });

  it("falls back to legacy text 'passed' format", async () => {
    const out = await runPlaytest("s", runnerReturning("Playtest passed with no errors."));
    expect(out.passed).toBe(true);
  });

  it("falls back to legacy text error format", async () => {
    const out = await runPlaytest(
      "s",
      runnerReturning("Playtest found 1 error(s):\nSomeScript:3: boom"),
    );
    expect(out.passed).toBe(false);
    expect(out.errors.join("\n")).toMatch(/boom/);
  });

  it("treats a failed round-trip as not-verified", async () => {
    const out = await runPlaytest("s", runnerReturning("", false));
    expect(out.passed).toBe(false);
  });
});
