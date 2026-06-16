import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory KV stub mirroring the subset of the store the bridge uses.
const store = new Map<string, string>();
const fakeKv = {
  get: async (key: string) => (store.has(key) ? store.get(key)! : null),
  set: async (key: string, value: unknown) => {
    store.set(key, typeof value === "string" ? value : JSON.stringify(value));
  },
};

vi.mock("@/lib/store", () => ({
  getRedis: () => fakeKv,
}));

import {
  enqueueCommand,
  dequeueCommand,
  dequeueCommandWaiting,
  submitResult,
  getResultWaiting,
  awaitResult,
} from "@/lib/mcp-bridge";

beforeEach(() => {
  store.clear();
});

describe("mcp-bridge long-poll", () => {
  it("dequeueCommandWaiting returns immediately when a command is already queued", async () => {
    await enqueueCommand("s1", "studio_get_tree", {});
    const t0 = Date.now();
    const cmd = await dequeueCommandWaiting("s1", 5000);
    expect(cmd?.tool).toBe("studio_get_tree");
    // Fast path: should not have waited anywhere near the hold window.
    expect(Date.now() - t0).toBeLessThan(200);
  });

  it("dequeueCommandWaiting resolves the instant a command lands mid-hold", async () => {
    // Enqueue after ~150ms while a 3s hold is in flight.
    setTimeout(() => void enqueueCommand("s2", "studio_read_script", { path: "X" }), 150);
    const t0 = Date.now();
    const cmd = await dequeueCommandWaiting("s2", 3000, 50);
    const elapsed = Date.now() - t0;
    expect(cmd?.tool).toBe("studio_read_script");
    // Landed well before the 3s hold elapsed.
    expect(elapsed).toBeGreaterThanOrEqual(140);
    expect(elapsed).toBeLessThan(1500);
  });

  it("dequeueCommandWaiting returns null after the hold with no command", async () => {
    const t0 = Date.now();
    const cmd = await dequeueCommandWaiting("s3", 300, 50);
    expect(cmd).toBeNull();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(250);
  });

  it("waitMs<=0 behaves like single-shot dequeue (legacy)", async () => {
    const cmd = await dequeueCommandWaiting("s4", 0);
    expect(cmd).toBeNull(); // nothing queued, no waiting
  });

  it("getResultWaiting resolves the instant a result is submitted", async () => {
    const rid = await enqueueCommand("s5", "studio_get_tree", {});
    setTimeout(
      () => void submitResult("s5", { requestId: rid, ok: true, data: "tree", completedAt: Date.now() }),
      120,
    );
    const res = await getResultWaiting("s5", rid, 3000, 50);
    expect(res?.ok).toBe(true);
    expect(res?.data).toBe("tree");
  });

  it("awaitResult returns a structured timeout when nothing arrives", async () => {
    const res = await awaitResult("s6", "missing", 250, 40);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/timed out/i);
  });

  it("FIFO order is preserved across enqueue/dequeue", async () => {
    await enqueueCommand("s7", "a", {});
    await enqueueCommand("s7", "b", {});
    const first = await dequeueCommand("s7");
    const second = await dequeueCommand("s7");
    expect(first?.tool).toBe("a");
    expect(second?.tool).toBe("b");
  });
});
