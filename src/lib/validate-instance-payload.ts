/**
 * Validation for instance/script payloads sent to /api/insert-instance.
 *
 * The plugin executes these payloads live inside the user's Studio session,
 * so we validate them against a strict allowlist of actions and bounded
 * field sizes before they are ever stored or forwarded.
 */

import { normalizeActionName } from "./normalize-action";

export const ALLOWED_ACTIONS = [
  "create",
  "delete",
  "create_instance",
  "rename_instance",
  "move_instance",
  "run_playtest",
] as const;

export type InstanceAction = (typeof ALLOWED_ACTIONS)[number];

const ALLOWED_SCRIPT_TYPES = ["Script", "LocalScript", "ModuleScript"] as const;

// Generous but bounded limits to prevent abuse / Redis blowups.
const MAX_CODE_LENGTH = 200_000; // ~200 KB per script
const MAX_NAME_LENGTH = 200;
const MAX_PATH_LENGTH = 500;

export type ValidationResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; error: string };

function isString(v: unknown): v is string {
  return typeof v === "string";
}

/**
 * Validate and normalize a single instance payload.
 * Returns a sanitized copy on success, or a descriptive error.
 */
export function validateInstancePayload(input: unknown): ValidationResult {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Payload must be an object" };
  }

  const p = input as Record<string, unknown>;
  // Normalize the action via the shared normalizer (single source of truth):
  // collapses variants like "runplaytest"/"createInstance" to canonical form.
  const normalized = normalizeActionName(p.action);
  const action = normalized ?? String(p.action ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (!ALLOWED_ACTIONS.includes(action as InstanceAction)) {
    return {
      ok: false,
      error: `Unsupported action "${p.action}". Allowed: ${ALLOWED_ACTIONS.join(", ")}`,
    };
  }

  // Field-level bounds shared across actions.
  for (const [field, max] of [
    ["name", MAX_NAME_LENGTH],
    ["instanceName", MAX_NAME_LENGTH],
    ["className", MAX_NAME_LENGTH],
    ["newName", MAX_NAME_LENGTH],
    ["parent", MAX_PATH_LENGTH],
    ["newParentPath", MAX_PATH_LENGTH],
    ["oldPath", MAX_PATH_LENGTH],
  ] as const) {
    const val = p[field];
    if (val !== undefined && (!isString(val) || val.length > max)) {
      return { ok: false, error: `Field "${field}" is invalid or too long` };
    }
  }

  if (p.code !== undefined) {
    if (!isString(p.code)) {
      return { ok: false, error: "Field \"code\" must be a string" };
    }
    if (p.code.length > MAX_CODE_LENGTH) {
      return { ok: false, error: "Script code exceeds the maximum allowed size" };
    }
  }

  // Per-action required fields.
  switch (action as InstanceAction) {
    case "create": {
      const scriptType = String(p.type ?? p.scriptType ?? "Script");
      if (!ALLOWED_SCRIPT_TYPES.includes(scriptType as never)) {
        return { ok: false, error: `Invalid scriptType "${scriptType}"` };
      }
      if (!isString(p.name) || !p.name.trim()) {
        return { ok: false, error: "\"create\" requires a name" };
      }
      if (!isString(p.parent) || !p.parent.trim()) {
        return { ok: false, error: "\"create\" requires a parent" };
      }
      break;
    }
    case "create_instance": {
      if (!isString(p.className) || !p.className.trim()) {
        return { ok: false, error: "\"create_instance\" requires a className" };
      }
      if (!isString(p.instanceName) || !p.instanceName.trim()) {
        return { ok: false, error: "\"create_instance\" requires an instanceName" };
      }
      break;
    }
    case "delete": {
      if (!isString(p.name) || !p.name.trim()) {
        return { ok: false, error: "\"delete\" requires a name" };
      }
      break;
    }
    case "rename_instance": {
      if (!isString(p.oldPath) || !p.oldPath.trim()) {
        return { ok: false, error: "\"rename_instance\" requires an oldPath" };
      }
      if (!isString(p.newName) || !p.newName.trim()) {
        return { ok: false, error: "\"rename_instance\" requires a newName" };
      }
      break;
    }
    case "move_instance": {
      if (!isString(p.oldPath) || !p.oldPath.trim()) {
        return { ok: false, error: "\"move_instance\" requires an oldPath" };
      }
      if (!isString(p.newParentPath) || !p.newParentPath.trim()) {
        return { ok: false, error: "\"move_instance\" requires a newParentPath" };
      }
      break;
    }
    case "run_playtest":
      // No required fields.
      break;
  }

  return { ok: true, payload: { ...p, action } };
}
