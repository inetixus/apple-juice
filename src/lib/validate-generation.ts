/**
 * Deterministic post-processing for AI-generated Roblox action plans.
 *
 * Whatever model produced the response, this pass makes the output more
 * reliable before it's synced into Studio:
 *   • orders actions by dependency (instances → modules → scripts → playtest)
 *   • guarantees the mandatory print header on every script
 *   • guarantees a single run_playtest as the final action
 *   • de-duplicates repeated create targets (keeps the last/most complete)
 *
 * It never invents code — it only reorders, lightly annotates, and trims.
 */

export type GenScript = {
  action?: string;
  type?: string;
  scriptType?: string;
  parent?: string;
  name?: string;
  code?: string;
  className?: string;
  instanceName?: string;
  oldPath?: string;
  newName?: string;
  newParentPath?: string;
  assetId?: number | string;
  [key: string]: unknown;
};

const SCRIPT_TYPES = new Set(["Script", "LocalScript", "ModuleScript"]);

function isScriptCreate(s: GenScript): boolean {
  const action = String(s.action ?? "create").toLowerCase();
  return action === "create" && SCRIPT_TYPES.has(String(s.type ?? s.scriptType ?? "Script"));
}

function effectiveType(s: GenScript): string {
  return String(s.type ?? s.scriptType ?? "Script");
}

/**
 * Dependency rank for stable ordering. Lower runs first.
 *  0: instance scaffolding (Folders, RemoteEvents, etc.)
 *  1: ModuleScripts (required by other scripts)
 *  2: Scripts / LocalScripts
 *  3: structural ops (rename/move/delete)
 *  4: run_playtest (always last)
 */
function rankOf(s: GenScript): number {
  const action = String(s.action ?? "create").toLowerCase();
  if (action === "run_playtest" || action === "stop_playtest") return 4;
  if (action === "create_instance") return 0;
  if (action === "rename_instance" || action === "move_instance" || action === "delete") return 3;
  if (isScriptCreate(s)) {
    return effectiveType(s) === "ModuleScript" ? 1 : 2;
  }
  return 2;
}

/** Ensure an executable script begins with the Apple Juice debug print header. */
function ensurePrintHeader(s: GenScript): GenScript {
  if (!isScriptCreate(s) || typeof s.code !== "string") return s;
  // ModuleScripts don't "run" on their own — the print convention is for
  // Scripts / LocalScripts only. Leave modules (incl. pre-built libraries) alone.
  if (effectiveType(s) === "ModuleScript") return s;
  const code = s.code;
  // Already has an AppleJuice print somewhere near the top? Leave it.
  const head = code.slice(0, 400);
  if (/print\s*\(\s*["'`]\[AppleJuice\]/i.test(head)) return s;

  const name = String(s.name ?? "Script");
  const header = `print("[AppleJuice] Running ${name}...")\n`;

  // Insert after a leading block comment / directive if present, else prepend.
  const directiveMatch = code.match(/^\s*(--\[\[[\s\S]*?\]\]|--!.*\n|(?:--[^\n]*\n)+)/);
  if (directiveMatch) {
    const idx = directiveMatch[0].length;
    return { ...s, code: code.slice(0, idx) + header + code.slice(idx) };
  }
  return { ...s, code: header + code };
}

export type ValidationReport = {
  scripts: GenScript[];
  warnings: string[];
  reordered: boolean;
  addedPlaytest: boolean;
  addedHeaders: number;
  dedupedCount: number;
};

export type ValidateOptions = {
  /** Append a run_playtest if none is present. Default: true. */
  ensurePlaytest?: boolean;
};

/**
 * Validate and repair an array of generated actions.
 * Pure: returns a new array, never mutates the input.
 */
export function validateGeneration(
  input: GenScript[],
  opts: ValidateOptions = {},
): ValidationReport {
  const ensurePlaytest = opts.ensurePlaytest ?? true;
  const warnings: string[] = [];

  if (!Array.isArray(input) || input.length === 0) {
    return {
      scripts: [],
      warnings: ["No actions to validate."],
      reordered: false,
      addedPlaytest: false,
      addedHeaders: 0,
      dedupedCount: 0,
    };
  }

  // 1. De-duplicate create targets by parent.name, keeping the LAST occurrence
  //    (models sometimes restate a script — the later one is usually complete).
  const seen = new Map<string, number>();
  const deduped: GenScript[] = [];
  let dedupedCount = 0;
  for (const s of input) {
    if (isScriptCreate(s) && s.name && s.parent) {
      const key = `${s.parent}.${s.name}`;
      if (seen.has(key)) {
        deduped[seen.get(key)!] = s; // replace earlier with later
        dedupedCount++;
        continue;
      }
      seen.set(key, deduped.length);
    }
    deduped.push(s);
  }

  // 2. Ensure print headers on script creates.
  let addedHeaders = 0;
  const headered = deduped.map((s) => {
    const next = ensurePrintHeader(s);
    if (next !== s) addedHeaders++;
    // Flag placeholder/TODO smells so the caller can decide what to do.
    if (isScriptCreate(next) && typeof next.code === "string") {
      if (/--\s*(TODO|FIXME|add code here|rest of|your code|implement)/i.test(next.code)) {
        warnings.push(`Script "${next.name}" may contain placeholder code.`);
      }
      if (next.code.trim().length < 30) {
        warnings.push(`Script "${next.name}" looks suspiciously short.`);
      }
    }
    return next;
  });

  // 3. Strip any model-emitted playtests; we re-add exactly one at the end.
  const playtestPresent = headered.some(
    (s) => String(s.action ?? "").toLowerCase() === "run_playtest",
  );
  const withoutPlaytest = headered.filter(
    (s) => String(s.action ?? "").toLowerCase() !== "run_playtest",
  );

  // 4. Stable sort by dependency rank (preserves original order within a rank).
  const ranked = withoutPlaytest
    .map((s, i) => ({ s, i, r: rankOf(s) }))
    .sort((a, b) => (a.r - b.r) || (a.i - b.i))
    .map((x) => x.s);

  const reordered = ranked.some((s, i) => s !== withoutPlaytest[i]);

  // 5. Append a single run_playtest if appropriate.
  let addedPlaytest = false;
  const hasAnyWork = ranked.some((s) => {
    const a = String(s.action ?? "create").toLowerCase();
    return a === "create" || a === "create_instance" || a === "delete" || a === "rename_instance" || a === "move_instance";
  });
  const out = [...ranked];
  if ((ensurePlaytest || playtestPresent) && hasAnyWork) {
    out.push({ action: "run_playtest" });
    addedPlaytest = !playtestPresent;
  }

  return {
    scripts: out,
    warnings,
    reordered,
    addedPlaytest,
    addedHeaders,
    dedupedCount,
  };
}
