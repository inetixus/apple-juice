/**
 * Apple Juice Runtime (Node) — durable project layer (the Rojo half).
 *
 * The AI edits SCRIPTS as files here; `rojo serve` (see rojo.ts) watches the
 * folder and live-syncs them into Studio. The Runtime owns the folder + git.
 * The MCP handles the live half (playtest/build/inspect) — never script edits.
 *
 * TS port of runtime-native/src/project.rs so the (Option C) local agent loop
 * can reach it directly without a second process.
 */

import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const PROJECT_FILE = "default.project.json";
const GIT_NAME = "Apple Juice";
const GIT_EMAIL = "runtime@apple-juice.local";

export interface FileEntry {
  path: string; // forward-slash relative path under the project root
  bytes: number;
}

export class ProjectManager {
  constructor(private readonly rootDir: string) {}

  get root(): string {
    return this.rootDir;
  }

  static defaultRoot(): string {
    const home = process.env.USERPROFILE || process.env.HOME || ".";
    return path.join(home, "AppleJuice", "project");
  }

  /** Create folders + Rojo project.json + git repo if missing. Idempotent. */
  openOrCreate(): void {
    for (const sub of ["src/server", "src/client", "src/shared"]) {
      fs.mkdirSync(path.join(this.rootDir, sub), { recursive: true });
    }
    const proj = path.join(this.rootDir, PROJECT_FILE);
    if (!fs.existsSync(proj)) fs.writeFileSync(proj, defaultProjectJson());

    const gitignore = path.join(this.rootDir, ".gitignore");
    if (!fs.existsSync(gitignore)) {
      fs.writeFileSync(gitignore, "# Apple Juice project\n*.rbxl\n*.rbxlx\n");
    }
    if (!fs.existsSync(path.join(this.rootDir, ".git"))) {
      this.git(["init", "-q"]);
    }
  }

  /** Resolve a caller path safely under the root (no abs, no `..`). */
  private resolve(rel: string): string {
    const norm = rel.replace(/\\/g, "/");
    if (path.isAbsolute(norm)) throw new Error("absolute paths are not allowed");
    if (norm.split("/").some((seg) => seg === "..")) {
      throw new Error("path traversal is not allowed");
    }
    return path.join(this.rootDir, norm);
  }

  listFiles(): FileEntry[] {
    const base = path.join(this.rootDir, "src");
    const out: FileEntry[] = [];
    if (fs.existsSync(base)) walk(base, this.rootDir, out);
    out.sort((a, b) => a.path.localeCompare(b.path));
    return out;
  }

  readFile(rel: string): string {
    return fs.readFileSync(this.resolve(rel), "utf8");
  }

  writeFile(rel: string, content: string): void {
    const p = this.resolve(rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }

  deleteFile(rel: string): void {
    const p = this.resolve(rel);
    if (fs.existsSync(p)) fs.rmSync(p);
  }

  /** Porcelain git status ("" = clean). */
  status(): string {
    return this.git(["status", "--porcelain"]);
  }

  /** Stage all + commit with inline identity (never touches git config). */
  commit(message: string): string {
    this.git(["add", "-A"]);
    const staged = this.git(["diff", "--cached", "--name-only"]);
    if (!staged.trim()) return "nothing to commit";
    this.git([
      "-c",
      `user.name=${GIT_NAME}`,
      "-c",
      `user.email=${GIT_EMAIL}`,
      "commit",
      "-q",
      "-m",
      message,
    ]);
    return this.git(["rev-parse", "--short", "HEAD"]);
  }

  private git(args: string[]): string {
    const res = spawnSync("git", ["-C", this.rootDir, ...args], {
      encoding: "utf8",
    });
    if (res.error) throw new Error(`git not available: ${res.error.message}`);
    if (res.status !== 0) throw new Error((res.stderr || "git failed").trim());
    return (res.stdout || "").trim();
  }
}

function walk(dir: string, root: string, out: FileEntry[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, root, out);
    } else if (entry.isFile()) {
      const rel = path.relative(root, full).replace(/\\/g, "/");
      let bytes = 0;
      try {
        bytes = fs.statSync(full).size;
      } catch {
        /* ignore */
      }
      out.push({ path: rel, bytes });
    }
  }
}

function defaultProjectJson(): string {
  // NOTE: each service entry carries an explicit "$className". Without it, older
  // Rojo (6.x) creates NEW Folder instances named after the services instead of
  // binding to the real ones (scripts land in game.Workspace-level folders, not
  // the actual ServerScriptService/ReplicatedStorage). The className makes Rojo
  // reconcile against the existing services. Verified on Rojo 6.2.
  return `{
  "name": "apple-juice-project",
  "tree": {
    "$className": "DataModel",
    "ServerScriptService": {
      "$className": "ServerScriptService",
      "$path": "src/server"
    },
    "ReplicatedStorage": {
      "$className": "ReplicatedStorage",
      "$path": "src/shared"
    },
    "StarterPlayer": {
      "$className": "StarterPlayer",
      "StarterPlayerScripts": {
        "$className": "StarterPlayerScripts",
        "$path": "src/client"
      }
    }
  }
}
`;
}
