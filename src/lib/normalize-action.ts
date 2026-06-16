/**
 * Single source of truth for normalizing AI-emitted action objects into the
 * strict, canonical shape the Studio plugin understands.
 *
 * The model (across providers / phrasings) frequently emits near-miss variants:
 *   "runplaytest", "run playtest", "runPlaytest"  -> "run_playtest"
 *   "createInstance", "create-instance"           -> "create_instance"
 *   "Source"/"Content"                            -> "code"
 *   "Type"/"ClassName"                            -> "type"/"className"
 * Treating these as errors (the old behavior) made the whole batch fail.
 * Instead we coerce them to canonical form here, used everywhere an action
 * enters the system (client parse, server validate, proxy output).
 */

export const CANONICAL_ACTIONS = [
  "create",
  "delete",
  "create_instance",
  "set_properties",
  "build_model",
  "rename_instance",
  "move_instance",
  "run_playtest",
  "stop_playtest",
  "edit_script",
  "read_script",
] as const;

export type CanonicalAction = (typeof CANONICAL_ACTIONS)[number];

const ACTION_ALIASES: Record<string, CanonicalAction> = {
  // create script
  create: "create",
  createscript: "create",
  newscript: "create",
  write: "create",
  writescript: "create",
  // delete
  delete: "delete",
  remove: "delete",
  destroy: "delete",
  // instances
  createinstance: "create_instance",
  newinstance: "create_instance",
  insert: "create_instance",
  insertinstance: "create_instance",
  renameinstance: "rename_instance",
  rename: "rename_instance",
  moveinstance: "move_instance",
  move: "move_instance",
  reparent: "move_instance",
  // 3D building
  setproperties: "set_properties",
  setprops: "set_properties",
  setproperty: "set_properties",
  updateproperties: "set_properties",
  buildmodel: "build_model",
  build: "build_model",
  createmodel: "build_model",
  makemodel: "build_model",
  // playtest
  runplaytest: "run_playtest",
  playtest: "run_playtest",
  test: "run_playtest",
  runtest: "run_playtest",
  stopplaytest: "stop_playtest",
  stoptest: "stop_playtest",
  // edits / reads
  editscript: "edit_script",
  edit: "edit_script",
  modify: "edit_script",
  readscript: "read_script",
  read: "read_script",
};

/** Normalize a raw action string to canonical form, or null if unrecognized. */
export function normalizeActionName(raw: unknown): CanonicalAction | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase().replace(/[\s\-]+/g, "_");
  if ((CANONICAL_ACTIONS as readonly string[]).includes(key)) {
    return key as CanonicalAction;
  }
  // also try the de-underscored alias form
  const compact = key.replace(/_/g, "");
  return ACTION_ALIASES[key] ?? ACTION_ALIASES[compact] ?? null;
}

/**
 * Normalize a full action object: canonical action name + canonical field
 * names. Returns null if the action is unrecognized (caller decides whether to
 * drop it). Never throws.
 */
export function normalizeAction(input: any): Record<string, any> | null {
  if (!input || typeof input !== "object") return null;
  const action = normalizeActionName(input.action ?? input.Action);
  if (!action) return null;

  // Coerce common field-name variants to canonical names.
  const code = input.code ?? input.Source ?? input.source ?? input.Content ?? input.content;
  const type = input.type ?? input.scriptType ?? input.Type;
  const className = input.className ?? input.ClassName ?? input.class;

  const out: Record<string, any> = { ...input, action };
  if (code !== undefined) out.code = code;
  if (type !== undefined) out.type = type;
  if (className !== undefined) out.className = className;

  // For create_instance/delete, ensure both name + instanceName are present so
  // both the validator and the plugin accept it.
  if (action === "create_instance" || action === "delete") {
    const nm = input.instanceName ?? input.name ?? input.Name;
    if (nm !== undefined) {
      out.name = nm;
      out.instanceName = nm;
    }
  }

  return out;
}

/** Normalize an array of actions, dropping any that can't be recognized. */
export function normalizeActions(actions: any[]): Record<string, any>[] {
  if (!Array.isArray(actions)) return [];
  const out: Record<string, any>[] = [];
  for (const a of actions) {
    const n = normalizeAction(a);
    if (n) out.push(n);
  }
  return out;
}
