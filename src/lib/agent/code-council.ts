/**
 * Code Council — "an AI that compares the other AIs to find the best, most
 * effective code." (idea.txt)
 *
 * Given a coding prompt, it:
 *   1. Asks several different models the SAME question in parallel, each
 *      producing a candidate Luau solution.
 *   2. Hands all candidates (anonymized) to a strong judge model, which scores
 *      each on correctness, efficiency, robustness, and Roblox best-practice,
 *      then names a winner with reasoning.
 *   3. Returns the winning code plus the full scoreboard.
 *
 * This is provider-agnostic over the Kiro lineup and reuses the same
 * OpenAI-compatible endpoint as the rest of the app.
 */

import { runPlainCompletion } from "@/lib/agent/llm";
import { resolveKiroModelId, findKiroModel } from "@/lib/kiro-models";

export type CouncilCandidate = {
  /** Display label of the model that produced this candidate. */
  model: string;
  /** Extracted Luau code (best-effort). */
  code: string;
  /** The raw model output (code + any notes). */
  raw: string;
  /** True if the model call failed. */
  failed: boolean;
  error?: string;
};

export type CouncilScore = {
  model: string;
  /** 0–100 overall. */
  score: number;
  correctness: number;
  efficiency: number;
  robustness: number;
  /** One-line justification from the judge. */
  notes: string;
};

export type CouncilResult = {
  prompt: string;
  candidates: CouncilCandidate[];
  scores: CouncilScore[];
  /** Display label of the winning model. */
  winner: string;
  /** The chosen code. */
  winningCode: string;
  /** Judge's overall reasoning for the pick. */
  verdict: string;
  usage: { inputTokens: number; outputTokens: number };
  error?: string;
};

export type CouncilProgress =
  | { kind: "candidate_start"; model: string }
  | { kind: "candidate_done"; model: string; ok: boolean }
  | { kind: "judging" }
  | { kind: "winner"; model: string };

const CANDIDATE_SYSTEM = `You are an expert Roblox (Luau) engineer. Produce the single best, complete, production-ready solution to the user's request.

Rules:
- Output ONLY Luau code in one \`\`\`lua code block. No explanation before or after.
- Complete, working code — no placeholders, no "TODO", no partial snippets.
- Idiomatic Luau: task.* (never legacy wait/spawn), :GetService(), :WaitForChild with a timeout on the client, type-safe, server-authoritative where relevant.
- Robust: guard nil access, validate RemoteEvent args server-side, clean up connections.`;

/** Pull the first fenced Luau block, else return the whole trimmed text. */
function extractCode(text: string): string {
  const m =
    text.match(/```(?:luau|lua)\s*\n([\s\S]*?)```/i) ||
    text.match(/```\s*\n([\s\S]*?)```/i);
  return (m ? m[1] : text).trim();
}

/**
 * Default council line-up. A spread of architectures so the comparison is
 * meaningful (not three near-identical Claude tiers). Falls back gracefully if
 * a label isn't found in the lineup.
 */
const DEFAULT_COUNCIL = [
  "Claude Sonnet 4.6",
  "GLM-5",
  "MiniMax M2.5",
] as const;

/**
 * MAX line-up — the strongest, most diverse models we have, for when quality
 * matters more than cost. Pits frontier reasoning (Opus), a different frontier
 * (Sonnet), and a long-horizon repo-scale model (GLM-5) against each other,
 * judged by the very top model.
 */
const MAX_COUNCIL = [
  "Claude Opus 4.8",
  "Claude Opus 4.7",
  "Claude Sonnet 4.6",
  "GLM-5",
] as const;

const DEFAULT_JUDGE = "Claude Opus 4.8";

export type RunCouncilOptions = {
  prompt: string;
  /** Model display labels to compete. Defaults to a diverse trio. */
  models?: string[];
  /** Judge model display label. Defaults to the strongest available. */
  judge?: string;
  /** MAX mode: use the strongest, most diverse top-tier lineup. Overridden by
   *  an explicit `models` array if one is provided. */
  max?: boolean;
  onProgress?: (p: CouncilProgress) => void;
  signal?: AbortSignal;
};

/** Run the full compare-and-pick flow. */
export async function runCodeCouncil(
  opts: RunCouncilOptions,
): Promise<CouncilResult> {
  const {
    prompt,
    models,
    judge = DEFAULT_JUDGE,
    max = false,
    onProgress = () => {},
    signal,
  } = opts;

  const usage = { inputTokens: 0, outputTokens: 0 };

  // Resolve the lineup: explicit models win, else MAX or default presets.
  const requested =
    models && models.length > 0
      ? models
      : max
        ? [...MAX_COUNCIL]
        : [...DEFAULT_COUNCIL];

  // Keep only models we actually know; de-dupe.
  const lineup = Array.from(
    new Set(requested.filter((m) => findKiroModel(m))),
  );
  if (lineup.length === 0) lineup.push(...DEFAULT_COUNCIL);

  // ── 1. Generate candidates in parallel ──────────────────────────────────
  const candidates: CouncilCandidate[] = await Promise.all(
    lineup.map(async (label) => {
      onProgress({ kind: "candidate_start", model: label });
      const res = await runPlainCompletion({
        modelId: resolveKiroModelId(label),
        system: CANDIDATE_SYSTEM,
        user: prompt,
        temperature: 0.4,
        signal,
      });
      usage.inputTokens += res.usage.inputTokens;
      usage.outputTokens += res.usage.outputTokens;
      const failed = !!res.error || !res.content.trim();
      onProgress({ kind: "candidate_done", model: label, ok: !failed });
      return {
        model: label,
        code: failed ? "" : extractCode(res.content),
        raw: res.content,
        failed,
        error: res.error,
      };
    }),
  );

  const valid = candidates.filter((c) => !c.failed && c.code.length > 0);

  // If only one (or none) produced code, there's nothing to compare.
  if (valid.length === 0) {
    return {
      prompt,
      candidates,
      scores: [],
      winner: "",
      winningCode: "",
      verdict: "No model produced a usable candidate.",
      usage,
      error: "All candidate generations failed.",
    };
  }
  if (valid.length === 1) {
    onProgress({ kind: "winner", model: valid[0].model });
    return {
      prompt,
      candidates,
      scores: [
        {
          model: valid[0].model,
          score: 100,
          correctness: 100,
          efficiency: 100,
          robustness: 100,
          notes: "Only candidate that produced usable code.",
        },
      ],
      winner: valid[0].model,
      winningCode: valid[0].code,
      verdict: "Selected by default — the only model that returned valid code.",
      usage,
    };
  }

  // ── 2. Judge the candidates ─────────────────────────────────────────────
  onProgress({ kind: "judging" });

  // Anonymize so the judge scores the CODE, not the model's reputation.
  const labelByLetter = new Map<string, string>();
  const blocks = valid
    .map((c, i) => {
      const letter = String.fromCharCode(65 + i); // A, B, C…
      labelByLetter.set(letter, c.model);
      return `### Candidate ${letter}\n\`\`\`lua\n${c.code}\n\`\`\``;
    })
    .join("\n\n");

  const judgeSystem = `You are a meticulous principal Roblox engineer acting as a judge. You compare candidate Luau solutions to the SAME task and choose the most correct and effective one.

Score each candidate 0–100 on:
- correctness: does it actually fulfil the request and run without errors?
- efficiency: algorithmic + runtime efficiency, no needless work, good event/connection hygiene.
- robustness: nil-safety, server authority, input validation, cleanup, edge cases.

Prefer code that is complete and would PASS a playtest. Penalize placeholders, unsafe client trust, infinite-yield WaitForChild, legacy wait/spawn, and missing cleanup.

Respond with STRICT JSON only, no prose, in this exact shape:
{"scores":[{"candidate":"A","correctness":0-100,"efficiency":0-100,"robustness":0-100,"overall":0-100,"notes":"one line"}],"winner":"A","verdict":"2-3 sentences on why the winner is best and the runners-up fall short"}`;

  const judgeUser = `TASK:\n${prompt}\n\nCANDIDATES:\n${blocks}`;

  const judgeRes = await runPlainCompletion({
    modelId: resolveKiroModelId(judge),
    system: judgeSystem,
    user: judgeUser,
    temperature: 0.1,
    signal,
  });
  usage.inputTokens += judgeRes.usage.inputTokens;
  usage.outputTokens += judgeRes.usage.outputTokens;

  const parsed = parseJudge(judgeRes.content);

  // Map the judge's letters back to model labels.
  const scores: CouncilScore[] = (parsed?.scores ?? []).map((s) => ({
    model: labelByLetter.get(s.candidate) ?? s.candidate,
    score: clamp(s.overall),
    correctness: clamp(s.correctness),
    efficiency: clamp(s.efficiency),
    robustness: clamp(s.robustness),
    notes: s.notes ?? "",
  }));

  // Determine the winner: prefer the judge's pick, else highest overall score.
  let winnerLabel =
    (parsed?.winner && labelByLetter.get(parsed.winner)) || "";
  if (!winnerLabel && scores.length > 0) {
    winnerLabel = [...scores].sort((a, b) => b.score - a.score)[0].model;
  }
  if (!winnerLabel) winnerLabel = valid[0].model;

  const winningCandidate =
    valid.find((c) => c.model === winnerLabel) ?? valid[0];

  onProgress({ kind: "winner", model: winnerLabel });

  return {
    prompt,
    candidates,
    scores:
      scores.length > 0
        ? scores
        : valid.map((c) => ({
            model: c.model,
            score: 0,
            correctness: 0,
            efficiency: 0,
            robustness: 0,
            notes: "Judge did not return a score.",
          })),
    winner: winnerLabel,
    winningCode: winningCandidate.code,
    verdict:
      parsed?.verdict ||
      (judgeRes.error
        ? `Judge call failed (${judgeRes.error}); picked the top-scoring candidate.`
        : "Selected the highest-scoring candidate."),
    usage,
  };
}

function clamp(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

type JudgeJson = {
  scores?: {
    candidate: string;
    correctness: number;
    efficiency: number;
    robustness: number;
    overall: number;
    notes?: string;
  }[];
  winner?: string;
  verdict?: string;
};

/** Parse the judge's JSON, tolerating fences / surrounding prose. */
function parseJudge(text: string): JudgeJson | null {
  if (!text) return null;
  const tryParse = (s: string): JudgeJson | null => {
    try {
      return JSON.parse(s) as JudgeJson;
    } catch {
      return null;
    }
  };
  let out = tryParse(text.trim());
  if (out) return out;
  const fence = text.match(/```(?:json)?\s*\n([\s\S]*?)```/i);
  if (fence) {
    out = tryParse(fence[1].trim());
    if (out) return out;
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    out = tryParse(text.slice(start, end + 1));
    if (out) return out;
  }
  return null;
}
