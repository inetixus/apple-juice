/**
 * Canonical Kiro model lineup — single source of truth for the model list,
 * credit multipliers, plan gating, and display ↔ API-id mapping.
 *
 * Inference is reached through a Kiro API key over an OpenAI-compatible
 * Chat Completions endpoint, both supplied via environment variables:
 *   KIRO_API_KEY  — the API key generated from the Kiro console
 *   KIRO_API_URL  — base URL of the OpenAI-compatible endpoint
 *                   (defaults to https://api.kiro.dev/v1)
 *
 * Multipliers are relative to "Auto" (1.0x), matching Kiro's published pricing.
 */

export type KiroPlan = "free" | "partner" | "fresh_pro" | "pure_ultra";

export type KiroModel = {
  /** Human-friendly name shown in the UI. */
  label: string;
  /** Model id sent to the inference endpoint. */
  id: string;
  /** Credit cost relative to Auto (1.0x baseline). */
  multiplier: number;
  /** Lowest plan that may use this model. */
  tier: KiroPlan;
  /** Context window, for display. */
  context: string;
  /** Short blurb for UI/tooltips. */
  blurb: string;
};

export const KIRO_MODELS: KiroModel[] = [
  // ── Ultra: Opus family (2.2x) ──
  { label: "Claude Opus 4.8", id: "claude-opus-4.8", multiplier: 2.2, tier: "pure_ultra", context: "1M", blurb: "Highest reliability — flags uncertainty, efficient tool use." },
  { label: "Claude Opus 4.7", id: "claude-opus-4.7", multiplier: 2.2, tier: "pure_ultra", context: "1M", blurb: "Adaptive deep reasoning that scales with task complexity." },
  { label: "Claude Opus 4.6", id: "claude-opus-4.6", multiplier: 2.2, tier: "pure_ultra", context: "1M", blurb: "Top agentic-coding benchmarks; great for long debugging sessions." },
  { label: "Claude Opus 4.5", id: "claude-opus-4.5", multiplier: 2.2, tier: "pure_ultra", context: "200K", blurb: "Cross-system architecture and strong single-shot accuracy." },

  // ── Pro: Sonnet family + Auto + mid open-weight (0.5–1.3x) ──
  { label: "Auto", id: "auto", multiplier: 1.0, tier: "free", context: "—", blurb: "Kiro's router — best quality-to-cost per task. Recommended." },
  { label: "Claude Sonnet 4.6", id: "claude-sonnet-4.6", multiplier: 1.3, tier: "fresh_pro", context: "1M", blurb: "Near-Opus intelligence, more token efficient." },
  { label: "Claude Sonnet 4.5", id: "claude-sonnet-4.5", multiplier: 1.3, tier: "fresh_pro", context: "200K", blurb: "Strong agentic coding with long autonomous operation." },
  { label: "Claude Sonnet 4.0", id: "claude-sonnet-4.0", multiplier: 1.3, tier: "fresh_pro", context: "200K", blurb: "Predictable baseline, same model every time." },
  { label: "GLM-5", id: "glm-5", multiplier: 0.5, tier: "fresh_pro", context: "200K", blurb: "Repo-scale, long-horizon agentic work across big codebases." },
  { label: "MiniMax M2.5", id: "minimax-m2.5", multiplier: 0.25, tier: "fresh_pro", context: "200K", blurb: "Frontier-class coding at a fraction of the cost." },

  // ── Free: efficient open-weight + Haiku (0.05–0.4x) ──
  { label: "Claude Haiku 4.5", id: "claude-haiku-4.5", multiplier: 0.4, tier: "free", context: "200K", blurb: "Near-frontier intelligence, fast and cheap." },
  { label: "DeepSeek 3.2", id: "deepseek-3.2", multiplier: 0.25, tier: "free", context: "128K", blurb: "Agentic workflows and multi-step reasoning at minimal cost." },
  { label: "MiniMax M2.1", id: "minimax-m2.1", multiplier: 0.15, tier: "free", context: "200K", blurb: "Multilingual programming and UI generation." },
  { label: "Qwen3 Coder Next", id: "qwen3-coder-next", multiplier: 0.05, tier: "free", context: "256K", blurb: "256K context, strong error recovery — cheapest option." },
];

/** Default model (Kiro's recommended router). */
export const KIRO_DEFAULT_MODEL = "Auto";

const PLAN_RANK: Record<KiroPlan, number> = {
  free: 0,
  partner: 1,
  fresh_pro: 2,
  pure_ultra: 3,
};

/** Look up a model by its display label OR its api id (case-insensitive). */
export function findKiroModel(nameOrId: string): KiroModel | undefined {
  if (!nameOrId) return undefined;
  const n = nameOrId.trim().toLowerCase();
  return KIRO_MODELS.find(
    (m) => m.label.toLowerCase() === n || m.id.toLowerCase() === n,
  );
}

/** Resolve a display label / loose name to the api id sent to the endpoint. */
export function resolveKiroModelId(nameOrId: string): string {
  return findKiroModel(nameOrId)?.id ?? "auto";
}

/** Credit multiplier for a model (defaults to 1.0x / Auto). */
export function kiroMultiplier(nameOrId: string): number {
  return findKiroModel(nameOrId)?.multiplier ?? 1.0;
}

/** Whether a plan is allowed to use a given model. */
export function isKiroModelAvailable(nameOrId: string, plan: KiroPlan): boolean {
  const m = findKiroModel(nameOrId);
  if (!m) return false;
  return PLAN_RANK[plan] >= PLAN_RANK[m.tier];
}

/** Display labels available to a plan (for the model dropdown). */
export function kiroModelsForPlan(plan: KiroPlan): string[] {
  return KIRO_MODELS.filter((m) => PLAN_RANK[plan] >= PLAN_RANK[m.tier]).map(
    (m) => m.label,
  );
}

/** The best model a plan can fall back to when it requests something gated. */
export function bestKiroModelForPlan(plan: KiroPlan): string {
  if (plan === "pure_ultra") return "Claude Opus 4.8";
  if (plan === "fresh_pro") return "Claude Sonnet 4.6";
  return "Auto";
}

/**
 * Heuristic task-complexity router. Given a prompt, suggests a cheaper/faster
 * model for trivial edits and a stronger one for architecture-level work.
 * Only meant to be applied when the user picked "Auto" (don't override an
 * explicit model choice). Returns a model LABEL gated to the plan.
 */
export function routeModelForPrompt(prompt: string, plan: KiroPlan): string {
  const p = (prompt || "").toLowerCase();
  const len = p.length;

  // Signals of a heavy, architecture-level request.
  const heavySignals = [
    "system", "framework", "architecture", "datastore", "data store",
    "leaderboard", "matchmaking", "round", "inventory", "shop", "economy",
    "multiple scripts", "refactor", "rewrite", "entire", "full game",
    "networking", "replicat", "save data", "profile", "gamepass",
  ];
  // Signals of a trivial, single-edit request.
  const trivialSignals = [
    "rename", "typo", "comment", "print", "change the color", "tweak",
    "adjust", "rename variable", "add a print", "fix the spelling",
  ];

  const isHeavy = heavySignals.some((s) => p.includes(s)) || len > 600;
  const isTrivial =
    !isHeavy && (trivialSignals.some((s) => p.includes(s)) || len < 80);

  let target: string;
  if (isTrivial) {
    target = "Claude Haiku 4.5";   // fast + cheap for small edits
  } else if (isHeavy) {
    target = "Claude Sonnet 4.6";  // strong for architecture
  } else {
    target = "Auto";               // let Kiro's router decide
  }

  // Never exceed what the plan allows; fall back gracefully.
  if (!isKiroModelAvailable(target, plan)) {
    return bestKiroModelForPlan(plan);
  }
  return target;
}

/** All display labels (used as the global fallback list). */
export const KIRO_MODEL_LABELS = KIRO_MODELS.map((m) => m.label);

/**
 * Map a model name/id to a brand logo served from /public/icons.
 * Returns null when no specific brand logo applies (e.g. "Auto").
 */
export function kiroModelLogo(nameOrId: string): string | null {
  const n = (nameOrId || "").toLowerCase();
  if (n.includes("claude") || n.includes("opus") || n.includes("sonnet") || n.includes("haiku") || n.includes("anthropic")) {
    return "/icons/anthropic.png";
  }
  if (n.includes("deepseek")) return "/icons/deepseek.png";
  if (n.includes("minimax")) return "/icons/minimax.png";
  if (n.includes("qwen")) return "/icons/qwen.png";
  if (n.includes("glm") || n.includes("z-ai") || n.includes("zai")) return "/icons/z-ai.png";
  if (n.includes("gpt") || n.includes("openai")) return "/icons/chatgpt.png";
  if (n.includes("gemini") || n.includes("google")) return "/icons/google.webp";
  return null; // Auto / unknown — caller shows a generic mark
}
