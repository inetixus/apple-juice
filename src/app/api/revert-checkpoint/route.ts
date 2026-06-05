import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getRedis,
  getSession,
  upsertGeneratedCode,
  checkRateLimit,
  extractIp,
} from "@/lib/store";
import { validateInstancePayload } from "@/lib/validate-instance-payload";
import crypto from "crypto";

/**
 * Stage 2 checkpoint revert.
 *
 * Given a sessionKey + checkpointId, loads the stored inverse patch (computed
 * by the agent proxy when the prompt ran) and pushes it through the normal
 * generated-code sync so the Studio plugin applies it — restoring the project
 * to its pre-prompt state.
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionKey, checkpointId } = await req.json();

    if (!sessionKey || typeof sessionKey !== "string" || sessionKey.length > 128) {
      return Response.json({ error: "Invalid sessionKey" }, { status: 400 });
    }
    if (!checkpointId || typeof checkpointId !== "string" || checkpointId.length > 128) {
      return Response.json({ error: "Invalid checkpointId" }, { status: 400 });
    }

    // Rate limit reverts per IP.
    const ip = extractIp(req);
    const limit = await checkRateLimit("revert-checkpoint-ip", ip, 30, 60);
    if (!limit.allowed) {
      return Response.json({ error: "Too many requests." }, { status: 429 });
    }

    // Authorize: the caller must own this session.
    const session = await getSession(sessionKey);
    if (!session || Date.now() > session.expiresAt) {
      return Response.json({ error: "Invalid or expired session" }, { status: 401 });
    }
    const authSession = await getServerSession(authOptions);
    const ownerUserId = (authSession?.user as { id?: string } | undefined)?.id;
    if (ownerUserId && session.ownerUserId !== ownerUserId) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Load the stored inverse patch.
    const redis = getRedis();
    const raw = await redis.get<string>(`checkpoint:${sessionKey}:${checkpointId}`);
    if (!raw) {
      return Response.json(
        { error: "Checkpoint not found or expired" },
        { status: 404 },
      );
    }

    let parsed: { revert?: unknown };
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : (raw as any);
    } catch {
      return Response.json({ error: "Corrupt checkpoint" }, { status: 500 });
    }

    const revert = parsed.revert;
    if (!Array.isArray(revert) || revert.length === 0 || revert.length > 200) {
      return Response.json({ error: "Checkpoint has no revertable actions" }, { status: 400 });
    }

    // Validate every action against the allowlist before syncing.
    for (const s of revert) {
      const v = validateInstancePayload(s);
      if (!v.ok) {
        return Response.json({ error: `Invalid revert action: ${v.error}` }, { status: 400 });
      }
    }

    const payload = JSON.stringify({ scripts: revert });
    const messageId = crypto.randomUUID();
    const updated = await upsertGeneratedCode(sessionKey, payload, messageId, true);
    if (!updated) {
      return Response.json({ error: "Session not found or failed" }, { status: 404 });
    }

    // One-shot: consume the checkpoint so it can't be double-applied.
    await redis.del(`checkpoint:${sessionKey}:${checkpointId}`);

    return Response.json({ ok: true, reverted: revert.length });
  } catch (err) {
    console.error("revert-checkpoint error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
