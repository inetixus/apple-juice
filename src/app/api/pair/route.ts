import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createOrReplaceSession, extractIp } from "@/lib/store";

function createSessionKey() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const ownerUserId = (session?.user as { id?: string } | undefined)?.id;

    if (!ownerUserId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientIp = extractIp(req);
    const sessionKey = createSessionKey();
    const expiresAt = Date.now() + 1000 * 60 * 60; // 1 hour

    try {
      await createOrReplaceSession({
        sessionKey,
        ownerUserId,
        clientIp,
        expiresAt,
        hasNewCode: false,
        code: "",
        messageId: "",
      });
    } catch (err) {
      const details = err instanceof Error ? err.message : String(err);
      console.error("Failed to create session", details);
      return Response.json(
        { error: "Failed to create session", details },
        { status: 500 },
      );
    }

    return Response.json({ sessionKey, expiresAt, clientIp });
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    console.error("/api/pair error", details);
    return Response.json({ error: "Internal server error", details }, { status: 500 });
  }
}