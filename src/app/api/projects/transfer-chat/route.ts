import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { transferProjectChat } from "@/lib/store";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { sourceProjectId, sourceChatIndex, targetProjectId, targetChatIndex } = await req.json();

    if (!sourceProjectId || !targetProjectId) {
      return Response.json({ error: "Project IDs required" }, { status: 400 });
    }

    const result = await transferProjectChat(
      userId,
      sourceProjectId,
      sourceChatIndex || 0,
      targetProjectId,
      targetChatIndex || 0
    );

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
