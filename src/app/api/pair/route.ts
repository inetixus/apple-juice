import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createOrReplaceSession } from "@/lib/store";

function createPairingCode() {
  const n = Math.floor(100000 + Math.random() * 900000).toString();
  return `${n.slice(0, 3)}-${n.slice(3)}`;
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const ownerUserId = (session?.user as { id?: string } | undefined)?.id;

    if (!ownerUserId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pairingCode = createPairingCode();
    const pairToken = crypto.randomBytes(24).toString("hex");
    const expiresAt = Date.now() + 1000 * 60 * 30;

    try {
      await createOrReplaceSession({
        pairingCode,
        ownerUserId,
        pairToken,
        expiresAt,
        hasNewCode: false,
        code: "",
        messageId: "",
      });
    } catch (err) {
      console.error("Failed to create pairing session", err instanceof Error ? err.message : String(err));
      return Response.json({ error: "Failed to create pairing session" }, { status: 500 });
    }

    return Response.json({ pairingCode, pairToken, expiresAt });
  } catch (err) {
    console.error("/api/pair error", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}