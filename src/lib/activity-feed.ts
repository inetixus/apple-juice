/**
 * Turns a parsed AI plan into a real, human-readable activity timeline so the
 * UI can show what the agent is actually doing — reading, thinking, writing a
 * specific file, creating an instance, playtesting — instead of fabricated
 * "thinking…" placeholders.
 *
 * Every step here corresponds to a concrete action the model returned, so the
 * feed reflects reality rather than a random animation.
 */

export type ActivityKind =
  | "thinking"
  | "reading"
  | "writing"
  | "creating"
  | "editing"
  | "deleting"
  | "moving"
  | "playtesting"
  | "done";

export type ActivityStep = {
  kind: ActivityKind;
  label: string;
  /** Optional secondary detail (e.g. the parent path). */
  detail?: string;
  done: boolean;
};

type PlanAction = {
  action?: string;
  type?: string;
  scriptType?: string;
  parent?: string;
  name?: string;
  className?: string;
  instanceName?: string;
  oldPath?: string;
  newName?: string;
  newParentPath?: string;
  [key: string]: unknown;
};

type Plan = {
  thinking?: string;
  message?: string;
  scripts?: PlanAction[];
};

function typeLabel(a: PlanAction): string {
  return String(a.type ?? a.scriptType ?? "Script");
}

/** Map a single plan action to one activity step. */
function actionToStep(a: PlanAction): ActivityStep | null {
  const action = String(a.action ?? "create").toLowerCase();
  switch (action) {
    case "read_script":
      return { kind: "reading", label: `Reading ${a.name ?? "script"}`, detail: a.parent, done: false };
    case "create": {
      const t = typeLabel(a);
      return {
        kind: "writing",
        label: `Writing ${t} ${a.name ?? ""}`.trim(),
        detail: a.parent,
        done: false,
      };
    }
    case "edit_script":
      return { kind: "editing", label: `Editing ${a.name ?? "script"}`, detail: a.parent, done: false };
    case "create_instance":
      return {
        kind: "creating",
        label: `Creating ${a.className ?? "Instance"} ${a.instanceName ?? ""}`.trim(),
        detail: a.parent,
        done: false,
      };
    case "delete":
      return { kind: "deleting", label: `Deleting ${a.name ?? "instance"}`, detail: a.parent, done: false };
    case "rename_instance":
      return {
        kind: "moving",
        label: `Renaming to ${a.newName ?? ""}`.trim(),
        detail: a.oldPath,
        done: false,
      };
    case "move_instance":
      return {
        kind: "moving",
        label: `Moving ${a.oldPath ?? "instance"}`,
        detail: a.newParentPath,
        done: false,
      };
    case "run_playtest":
      return { kind: "playtesting", label: "Running a playtest to verify", done: false };
    case "stop_playtest":
      return null;
    default:
      return null;
  }
}

/**
 * Build the full activity timeline from a finished plan.
 * Optionally lead with a "thinking" step if the model returned reasoning.
 */
export function buildActivityFeed(plan: Plan): ActivityStep[] {
  const steps: ActivityStep[] = [];

  if (plan.thinking && plan.thinking.trim().length > 0) {
    steps.push({ kind: "thinking", label: "Reasoning about the request", done: false });
  }

  const scripts = Array.isArray(plan.scripts) ? plan.scripts : [];
  for (const a of scripts) {
    const step = actionToStep(a);
    if (step) steps.push(step);
  }

  return steps;
}

/**
 * Short present-tense verb for a kind — handy for compact CLI status lines
 * ("✦ Writing…", "✦ Creating…").
 */
export function kindVerb(kind: ActivityKind): string {
  switch (kind) {
    case "thinking": return "Thinking";
    case "reading": return "Reading";
    case "writing": return "Writing";
    case "creating": return "Creating";
    case "editing": return "Editing";
    case "deleting": return "Deleting";
    case "moving": return "Moving";
    case "playtesting": return "Playtesting";
    case "done": return "Done";
  }
}
