import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createOrReplaceSession } from "@/lib/store";

function createPairingCode() {
  const n = Math.floor(100000 + Math.random() * 900000).toString();
  return `${n.slice(0, 3)}-${n.slice(3)}`;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const ownerUserId = (session?.user as { id?: string } | undefined)?.id;

  if (!ownerUserId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pairingCode = createPairingCode();
  const pairToken = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + 1000 * 60 * 30;

  await createOrReplaceSession({
    pairingCode,
    ownerUserId,
    pairToken,
    expiresAt,
    hasNewCode: false,
    code: "",
    messageId: "",
  });

  return Response.json({ pairingCode, pairToken, expiresAt });
}