import { getSession, updateSession } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const { key, fileName } = await req.json();
    if (!key || !fileName) {
      return Response.json({ error: "Missing key or fileName" }, { status: 400 });
    }

    const session = await getSession(key);
    if (!session) return Response.json({ error: "Session not found" }, { status: 404 });

    await updateSession(key, { 
      requestedFile: fileName,
      fileResponse: undefined // clear old response
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
