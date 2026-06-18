/**
 * Apple Juice Runtime (Node) — `rojo serve` supervisor.
 *
 * Spawns the real Rojo file-sync server against the project folder so the user
 * never touches a terminal. The official Rojo Studio plugin connects to this
 * port and applies file changes into Studio. We do NOT modify our own plugin —
 * Rojo's sync is handled by Rojo's first-party plugin.
 *
 * TS port of runtime-native/src/rojo.rs. Binary resolution: AJ_ROJO_PATH env →
 * a `rojo` next to this process → `rojo` on PATH.
 */

import { type ChildProcess, spawn, spawnSync } from "child_process";
import fs from "fs";
import path from "path";

export const DEFAULT_ROJO_PORT = 34_872;

export class RojoManager {
  private child: ChildProcess | null = null;
  private readonly servePort: number;

  constructor(private readonly rootDir: string) {
    const env = process.env.AJ_ROJO_PORT ? Number(process.env.AJ_ROJO_PORT) : NaN;
    this.servePort = Number.isFinite(env) ? env : DEFAULT_ROJO_PORT;
  }

  get port(): number {
    return this.servePort;
  }

  /** Resolve the rojo executable to launch. */
  static resolve(): string {
    const exeName = process.platform === "win32" ? "rojo.exe" : "rojo";
    const fromEnv = process.env.AJ_ROJO_PATH;
    if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
    try {
      const local = path.join(path.dirname(process.execPath), exeName);
      if (fs.existsSync(local)) return local;
    } catch {
      /* ignore */
    }
    return "rojo"; // PATH
  }

  /** Rojo version string if locatable, else null. */
  static version(): string | null {
    try {
      const res = spawnSync(RojoManager.resolve(), ["--version"], { encoding: "utf8" });
      if (res.status === 0) return (res.stdout || "").trim();
    } catch {
      /* ignore */
    }
    return null;
  }

  isRunning(): boolean {
    return this.child !== null && this.child.exitCode === null && !this.child.killed;
  }

  /** Start `rojo serve` against the project. Idempotent. Returns the port. */
  async start(): Promise<number> {
    if (this.isRunning()) return this.servePort;
    const rojo = RojoManager.resolve();
    const child = spawn(
      rojo,
      ["serve", this.rootDir, "--port", String(this.servePort)],
      { stdio: "ignore", windowsHide: true },
    );

    // Surface an immediate failure (port taken, bad project) instead of faking
    // a running server.
    const earlyExit = await new Promise<string | null>((resolve) => {
      const onExit = (code: number | null) =>
        resolve(`rojo serve exited immediately (code ${code}). Is port ${this.servePort} free?`);
      child.once("exit", onExit);
      child.once("error", (e) => resolve(`could not launch rojo (${rojo}): ${e.message}`));
      setTimeout(() => {
        child.off("exit", onExit);
        resolve(null);
      }, 600);
    });
    if (earlyExit) throw new Error(earlyExit);

    this.child = child;
    child.once("exit", () => {
      this.child = null;
    });
    return this.servePort;
  }

  stop(): void {
    if (this.child) {
      try {
        this.child.kill();
      } catch {
        /* ignore */
      }
      this.child = null;
    }
  }
}
