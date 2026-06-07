import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { submitBanAppeal, checkRateLimit, extractIp } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * POST /api/account/appeal — a banned (appealable) user submits an appeal.
 * Body: { text }
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const ip = extractIp(req);
  const limit = await checkRateLimit("appeal", userId + ip, 5, 60 * 60 * 24);
  if (!limit.allowed) {
    return Response.json(
      { error: "You've already submitted an appeal recently." },
      { status: 429 },
    );
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const text = (body.text || "").trim();
  if (text.length < 10) {
    return Response.json(
      { error: "Please write a bit more about why you're appealing." },
      { status: 400 },
    );
  }

  const ok = await submitBanAppeal(userId, text);
  if (!ok) {
    return Response.json(
      { error: "This ban can't be appealed." },
      { status: 403 },
    );
  }
  return Response.json({ success: true, message: "Appeal submitted. An admin will review it." });
}
