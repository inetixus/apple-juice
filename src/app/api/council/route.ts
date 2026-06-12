import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getSession,
  getUserUsage,
  trackMlUsage,
  calculateMlUsed,
} from "@/lib/store";
import { isAgentLlmConfigured } from "@/lib/agent/llm";
import {
  runCodeCouncil,
  type CouncilProgress,
} from "@/lib/agent/code-council";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type CouncilBody = {
  prompt?: string;
  sessionKey?: string;
  /** Optional model line-up (display labels). */
  models?: string[];
  /** Optional judge model (display label). */
  judge?: string;
  /** MAX mode: top-tier lineup. */
  max?: boolean;
  stream?: boolean;
};

/**
 * POST /api/council
 *
 * Runs the multi-model "code council": several models solve the same prompt,
 * a judge compares them, and the best solution wins. Returns the winning code
 * plus the full scoreboard. Streams progress as SSE when `stream:true`.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  let ownerUserId = (session?.user as { id?: string } | undefined)?.id;

  const body = (await req.json()) as CouncilBody;
  const prompt = body.prompt?.trim() ?? "";
  const sessionKey = body.sessionKey?.trim() ?? "";

  if (!ownerUserId && sessionKey) {
    const pair = await getSession(sessionKey);
    if (pair) ownerUserId = pair.ownerUserId;
  }
  if (!ownerUserId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!prompt) {
    return Response.json({ error: "Missing prompt" }, { status: 400 });
  }
  if (!isAgentLlmConfigured()) {
    return Response.json(
      { error: "Model layer not configured (KIRO_API_KEY)." },
      { status: 503 },
    );
  }

  // Quota check — the council runs several model calls, so make sure the user
  // has Juice left before kicking it off.
  let hasQuota = true;
  try {
    const usage = await getUserUsage(ownerUserId);
    hasQuota = usage.remainingMl > 0;
  } catch {
    /* fail open — billing still tracked after the run */
  }
  if (!hasQuota) {
    return Response.json(
      { error: "Out of Juice. Top up or upgrade to run the council." },
      { status: 402 },
    );
  }

  const bill = async (inTk: number, outTk: number) => {
    try {
      await trackMlUsage(ownerUserId!, calculateMlUsed(inTk, outTk));
    } catch {
      /* best-effort */
    }
  };

  // ── Non-streaming: run and return the full result ──
  if (!body.stream) {
    const result = await runCodeCouncil({
      prompt,
      models: body.models,
      judge: body.judge,
      max: body.max,
      signal: req.signal,
    });
    await bill(result.usage.inputTokens, result.usage.outputTokens);
    return Response.json(result);
  }

  // ── Streaming: relay progress + final result as SSE ──
  const encoder = new TextEncoder();
  const sse = (event: string, data: unknown) =>
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  const stream = new ReadableStream({
    async start(controller) {
      const onProgress = (p: CouncilProgress) => {
        try {
          controller.enqueue(encoder.encode(sse("progress", p)));
        } catch {
          /* closed */
        }
      };

      try {
        const result = await runCodeCouncil({
          prompt,
          models: body.models,
          judge: body.judge,
          max: body.max,
          onProgress,
          signal: req.signal,
        });
        await bill(result.usage.inputTokens, result.usage.outputTokens);
        controller.enqueue(encoder.encode(sse("result", result)));
      } catch (e: any) {
        controller.enqueue(
          encoder.encode(sse("error", { error: e?.message || String(e) })),
        );
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
